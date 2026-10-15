import { describe, expect, it, vi } from "vitest";
import { APP_URL } from "@/lib/shared/constants";
import { ArchivosCuentaCorrienteApplicationService } from "../archivos-cuenta-service";
import type { IFacturacionRepository, FacturacionRow } from "@/domain/ports/facturacion-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IReservaIimpClient, ReservaIimpArchivo } from "@/domain/ports/reserva-iimp-client";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

const ident = { userId: "u1", email: "cliente@empresa.com" };

const factRow = { id: "f1", solicitudId: "s1", cuotas: [{ id: "c1", numero: 1 }] } as unknown as FacturacionRow;

const datosBase = {
  iimpContrato: "0000000001",
  iimpCuentaCorriente: "7",
  email: "cliente@empresa.com",
  tipoEvento: 2,
  codigoEvento: 19,
  stands: ["01"],
  planCuotas: { modalidad: "cuotas", cuotas: [{ numero: 1 }, { numero: 2 }] },
  datosFacturacion: null,
} as unknown as NonNullable<Awaited<ReturnType<ISolicitudesRepository["datosReservaIImp"]>>>;

const ARCHIVOS: ReservaIimpArchivo[] = [
  { item: 1, tipo: "OC", cuota: null, link: "https://web.iimp.org/archivos/oc-1.pdf", nombre: "OC 1", fecha: "2026-10-13T18:40:05" },
];

function mocks() {
  const facturacion = {
    esPropietarioDeCuota: vi.fn(async () => true),
    facturacionDeCuota: vi.fn(async () => factRow),
  } as unknown as IFacturacionRepository;
  const solicitudes = {
    datosReservaIImp: vi.fn(async () => datosBase),
  } as unknown as ISolicitudesRepository;
  const reserva = {
    agregarArchivos: vi.fn(async () => ARCHIVOS),
    listarArchivos: vi.fn(async () => ARCHIVOS),
    eliminarArchivo: vi.fn(async () => []),
  } as unknown as IReservaIimpClient;
  return { facturacion, solicitudes, reserva };
}

function servicio(m: ReturnType<typeof mocks>) {
  return new ArchivosCuentaCorrienteApplicationService(m.facturacion, m.solicitudes, m.reserva);
}

describe("ArchivosCuentaCorrienteApplicationService", () => {
  it("lista los archivos de la cuenta corriente de una cuota propia", async () => {
    const m = mocks();
    const r = await servicio(m).listar("c1", ident);

    expect(m.reserva.listarArchivos).toHaveBeenCalledWith({ numeroSolicitud: "CTRS-s1" });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ item: 1, tipo: "OC" });
  });

  it("agrega un archivo OC (sin cuota) a la cuenta", async () => {
    const m = mocks();
    await servicio(m).agregar("c1", { tipo: "OC", link: "https://web.iimp.org/archivos/oc-1.pdf", nombre: "OC 1" }, ident);

    expect(m.reserva.agregarArchivos).toHaveBeenCalledWith({
      numeroSolicitud: "CTRS-s1",
      archivos: [{ tipo: "OC", link: "https://web.iimp.org/archivos/oc-1.pdf", nombre: "OC 1" }],
    });
  });

  it("agrega la constancia de detraccion con su numero de cuota", async () => {
    const m = mocks();
    await servicio(m).agregar("c1", { tipo: "DETRACCION", cuota: 1, link: "https://web.iimp.org/archivos/det-1.pdf" }, ident);

    expect(m.reserva.agregarArchivos).toHaveBeenCalledWith(expect.objectContaining({
      archivos: [{ tipo: "DETRACCION", cuota: 1, link: "https://web.iimp.org/archivos/det-1.pdf" }],
    }));
  });

  it("normaliza un link relativo /uploads a URL absoluta antes de enviarlo", async () => {
    const m = mocks();
    await servicio(m).agregar("c1", { tipo: "OC", link: "/uploads/oc-1.pdf" }, ident);

    expect(m.reserva.agregarArchivos).toHaveBeenCalledWith(expect.objectContaining({
      archivos: [{ tipo: "OC", link: `${APP_URL}/uploads/oc-1.pdf` }],
    }));
  });

  it("un link vacio devuelve la lista actual sin llamar a agregar (v3)", async () => {
    const m = mocks();
    const r = await servicio(m).agregar("c1", { tipo: "OC", link: "   " }, ident);

    expect(m.reserva.agregarArchivos).not.toHaveBeenCalled();
    expect(m.reserva.listarArchivos).toHaveBeenCalledWith({ numeroSolicitud: "CTRS-s1" });
    expect(r).toEqual(ARCHIVOS);
  });

  it("rechaza tipo invalido, link no http y pago sin cuota", async () => {
    const m = mocks();
    await expect(servicio(m).agregar("c1", { tipo: "OTRO", link: "https://x/a.pdf" }, ident)).rejects.toMatchObject({ status: 400 });
    await expect(servicio(m).agregar("c1", { tipo: "OC", link: "ftp://x/a.pdf" }, ident)).rejects.toMatchObject({ status: 400 });
    await expect(servicio(m).agregar("c1", { tipo: "DIFERENCIA", link: "https://x/a.pdf" }, ident)).rejects.toMatchObject({ status: 400 });
    expect(m.reserva.agregarArchivos).not.toHaveBeenCalled();
  });

  it("rechaza una cuota fuera del rango de la cuenta", async () => {
    const m = mocks();
    await expect(servicio(m).agregar("c1", { tipo: "DETRACCION", cuota: 3, link: "https://x/a.pdf" }, ident)).rejects.toMatchObject({ status: 400 });
    expect(m.reserva.agregarArchivos).not.toHaveBeenCalled();
  });

  it("409 si la reserva aun no esta registrada en el IIMP", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({ ...datosBase, iimpContrato: null, iimpCuentaCorriente: null } as never);
    await expect(servicio(m).listar("c1", ident)).rejects.toMatchObject({ status: 409 });
    expect(m.reserva.listarArchivos).not.toHaveBeenCalled();
  });

  it("elimina un archivo por su item", async () => {
    const m = mocks();
    const r = await servicio(m).eliminar("c1", 3, ident);

    expect(m.reserva.eliminarArchivo).toHaveBeenCalledWith({ numeroSolicitud: "CTRS-s1", item: 3 });
    expect(r).toEqual([]);
  });

  it("rechaza un item invalido (400)", async () => {
    const m = mocks();
    await expect(servicio(m).eliminar("c1", 0, ident)).rejects.toMatchObject({ status: 400 });
    expect(m.reserva.eliminarArchivo).not.toHaveBeenCalled();
  });

  it("403 cuando la cuota no es del cliente", async () => {
    const m = mocks();
    vi.mocked(m.facturacion.esPropietarioDeCuota).mockResolvedValue(false);
    await expect(servicio(m).listar("c1", ident)).rejects.toMatchObject({ status: 403 });
    expect(m.reserva.listarArchivos).not.toHaveBeenCalled();
  });
});
