import { beforeEach, describe, expect, it, vi } from "vitest";

interface Fila {
  id: string;
  expedienteId: string;
  documento: string;
  nombre: string;
}

const estado = vi.hoisted(() => ({ filas: [] as Fila[], siguiente: 1 }));

const tx = vi.hoisted(() => ({
  debidaDiligencia: {
    update: vi.fn(async () => undefined),
    findUniqueOrThrow: vi.fn(async () => {
      throw new Error("fin-de-prueba");
    }),
  },
  debidaDiligenciaBeneficiario: {
    findMany: vi.fn(async ({ where }: { where: { expedienteId: string } }) =>
      estado.filas.filter((f) => f.expedienteId === where.expedienteId).map((f) => ({ id: f.id, documento: f.documento })),
    ),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Fila> }) => {
      const fila = estado.filas.find((f) => f.id === where.id)!;
      Object.assign(fila, data);
    }),
    create: vi.fn(async ({ data }: { data: Omit<Fila, "id"> }) => {
      const fila = { id: `b${estado.siguiente++}`, ...data } as Fila;
      estado.filas.push(fila);
      return { id: fila.id };
    }),
    deleteMany: vi.fn(async ({ where }: { where: { expedienteId: string; id?: { notIn: string[] } } }) => {
      estado.filas = estado.filas.filter(
        (f) => !(f.expedienteId === where.expedienteId && (!where.id || !where.id.notIn.includes(f.id))),
      );
    }),
  },
}));

vi.mock("@/lib/server/db", () => ({
  prisma: { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) },
}));

import { DebidaDiligenciaPrismaRepository } from "../debida-diligencia-repository";

const base = {
  tipoRelacionComercial: ["exhibidor"],
  tipoRelacionComercialOtro: null,
  actividadEconomica: "Servicios",
  actividadEconomicaOtro: null,
  paisConstitucion: "Perú",
  sitioWeb: "https://x.com",
  emailRepresentante: "a@b.com",
  aceptaDatos: true,
  aceptaVerificacion: true,
  declaraVerdad: true,
  representanteNombre: "REP",
  representanteTipoDocumento: "DNI",
  representanteDocumento: "41234567",
  representanteNacionalidad: "Perú",
  documentos: [],
};

const benef = (documento: string, nombre: string) => ({
  nombre,
  documento,
  tipoDocumento: "DNI",
  nacionalidad: "Perú",
  porcentaje: 50,
  tipoVinculoPersona: "beneficiario_final",
});

/** `guardarFormulario` termina mapeando una fila completa; aqui solo importa lo que quedo persistido. */
async function guardar(beneficiarios: ReturnType<typeof benef>[]): Promise<void> {
  await new DebidaDiligenciaPrismaRepository()
    .guardarFormulario("exp-1", { ...base, beneficiarios } as never, "cliente@x.com")
    .catch((e: Error) => {
      if (e.message !== "fin-de-prueba") throw e;
    });
}

describe("guardarFormulario - beneficiarios", () => {
  beforeEach(() => {
    estado.filas = [];
    estado.siguiente = 1;
  });

  it("conserva los beneficiarios que se crean en el primer guardado", async () => {
    await guardar([benef("45871236", "SOCIO 1"), benef("45871237", "SOCIO 2")]);
    expect(estado.filas.map((f) => f.documento).sort()).toEqual(["45871236", "45871237"]);
  });

  it("al reenviar actualiza los existentes y agrega los nuevos sin perder ninguno", async () => {
    await guardar([benef("45871236", "SOCIO 1")]);
    await guardar([benef("45871236", "SOCIO 1 EDITADO"), benef("45871238", "SOCIO NUEVO")]);
    expect(estado.filas.map((f) => `${f.documento}:${f.nombre}`).sort()).toEqual([
      "45871236:SOCIO 1 EDITADO",
      "45871238:SOCIO NUEVO",
    ]);
  });

  it("elimina los beneficiarios que el cliente quito", async () => {
    await guardar([benef("45871236", "SOCIO 1"), benef("45871237", "SOCIO 2")]);
    await guardar([benef("45871237", "SOCIO 2")]);
    expect(estado.filas.map((f) => f.documento)).toEqual(["45871237"]);
  });

  it("sin beneficiarios en el envio deja el expediente sin beneficiarios", async () => {
    await guardar([benef("45871236", "SOCIO 1")]);
    await guardar([]);
    expect(estado.filas).toHaveLength(0);
  });
});
