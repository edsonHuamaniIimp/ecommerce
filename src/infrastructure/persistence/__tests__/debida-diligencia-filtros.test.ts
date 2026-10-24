import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  debidaDiligencia: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  empresa: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  solicitud: {
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/server/db", () => ({ prisma: prismaMock }));

import { DebidaDiligenciaPrismaRepository } from "../debida-diligencia-repository";
import {
  DD_ASIGNACION_FILTRO,
  DD_DOCUMENTOS,
  DD_DOCUMENTOS_FILTRO,
  DD_ESTADOS,
  DD_FILTRO_POR_VENCER,
  DD_FILTRO_REQUIERE_DECLARACION_VIGENCIA,
  DD_FILTRO_SIN_INICIAR,
  DD_FILTRO_TODAS,
  DD_FILTRO_VENCIDA,
  DD_MULTIPLES_FILTRO,
  DD_ORIGENES,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_FILTRO_PENDIENTE,
  DD_SOLICITUDES_FILTRO,
  DD_VINCULOS,
} from "@/lib/shared/constants";

type Diccionario = Record<string, unknown>;

const params = (overrides: Diccionario = {}) => ({
  eventoId: "evento-1",
  page: 1,
  perPage: 20,
  ...overrides,
});

function whereBandeja(): Diccionario {
  const llamada = prismaMock.debidaDiligencia.findMany.mock.calls.at(-1)?.[0] as
    | { where?: Diccionario }
    | undefined;
  return llamada?.where ?? {};
}

function whereMatriz(): Diccionario {
  const llamada = prismaMock.empresa.findMany.mock.calls.at(-1)?.[0] as
    | { where?: Diccionario }
    | undefined;
  return llamada?.where ?? {};
}

function conAnd(where: Diccionario): Diccionario[] {
  return Array.isArray(where.AND) ? (where.AND as Diccionario[]) : [];
}

const row = {
  id: "exp-1",
  codigo: "DD-2026-0001",
  estado: DD_ESTADOS.APROBADA,
  origen: DD_ORIGENES.FLUJO_REGULAR,
  estadoOrigen: null,
  eventoProyecto: null,
  motivoImportacion: null,
  tipoRelacionComercial: [],
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  fechaEnvio: null,
  fechaAprobacion: null,
  fechaVencimiento: null,
  revisadoPor: null,
  motivoRechazo: null,
  beneficiarios: [],
  documentos: [],
  observaciones: [],
  reputacion: [],
  empresa: {
    id: "emp-1",
    ruc: "20100000001",
    tipoDocumento: "6",
    razonSocial: "EMPRESA UNO",
    nombreComercial: null,
    sitioWeb: null,
    emailContacto: null,
    representanteLegalNombre: null,
    representanteLegalDni: null,
    representanteCorreo: null,
    logoUrl: null,
  },
  evento: { anio: "2026", eventoPadre: { nombre: "PERUMIN" } },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.debidaDiligencia.findMany.mockResolvedValue([]);
  prismaMock.debidaDiligencia.count.mockResolvedValue(0);
  prismaMock.debidaDiligencia.groupBy.mockResolvedValue([]);
  prismaMock.empresa.findMany.mockResolvedValue([]);
  prismaMock.empresa.count.mockResolvedValue(0);
  prismaMock.solicitud.findMany.mockResolvedValue([]);
  prismaMock.$queryRaw.mockResolvedValue([]);
});

describe("filtros de bandeja", () => {
  it("sin evento consulta todos los eventos", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(params({ eventoId: undefined }));

    expect(whereBandeja()).not.toHaveProperty("eventoId");
    expect(prismaMock.debidaDiligencia.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("con evento limita la consulta y el resumen al evento", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(params());

    expect(whereBandeja().eventoId).toBe("evento-1");
    expect(prismaMock.debidaDiligencia.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventoId: "evento-1" } }),
    );
  });

  it("Pendientes incluye borrador y pendiente", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(params({ estado: DD_ESTADOS.PENDIENTE }));

    expect(whereBandeja().estado).toEqual({
      in: [DD_ESTADOS.BORRADOR, DD_ESTADOS.PENDIENTE],
    });
  });

  it.each([
    DD_ESTADOS.EN_REVISION,
    DD_ESTADOS.OBSERVADA,
    DD_ESTADOS.APROBADA,
    DD_ESTADOS.RECHAZADA,
  ])("estado %s usa coincidencia exacta", async (estado) => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(params({ estado }));

    expect(whereBandeja().estado).toBe(estado);
  });

  it("Por vencer exige APROBADA y fecha de cese dentro de la ventana", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(params({ estado: DD_FILTRO_POR_VENCER }));
    const where = whereBandeja();

    expect(where.estado).toBe(DD_ESTADOS.APROBADA);
    expect(Array.isArray(where.OR)).toBe(true);
    expect((where.OR as Diccionario[])[0]).toHaveProperty("fechaVencimiento");
  });

  it("Vencidas exige APROBADA y cese anterior a ahora", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(params({ estado: DD_FILTRO_VENCIDA }));
    const where = whereBandeja();

    expect(where.estado).toBe(DD_ESTADOS.APROBADA);
    expect((where.OR as Diccionario[])[0]).toHaveProperty("fechaVencimiento");
  });

  it("Vigentes sin declaracion exige vigencia y ausencia del documento", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(
      params({ estado: DD_FILTRO_REQUIERE_DECLARACION_VIGENCIA }),
    );
    const where = whereBandeja();

    expect(where.estado).toBe(DD_ESTADOS.APROBADA);
    expect(where.documentos).toEqual({
      none: { tipo: DD_DOCUMENTOS.DECLARACION_VIGENCIA },
    });
    expect(Array.isArray(where.OR)).toBe(true);
  });

  it("la busqueda no borra el filtro de estado", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(
      params({ estado: DD_FILTRO_POR_VENCER, search: "20549974342" }),
    );
    const where = whereBandeja();
    const and = conAnd(where);

    expect(where.estado).toBe(DD_ESTADOS.APROBADA);
    expect(where.OR).toEqual(expect.any(Array));
    expect(and.some((condicion) => Array.isArray(condicion.OR))).toBe(true);
  });

  it("filtra por origen, vinculo, documentos y no asignado", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(
      params({
        origen: DD_ORIGENES.IMPORTADO,
        vinculo: DD_VINCULOS.EXHIBIDOR,
        documentos: DD_DOCUMENTOS_FILTRO.SIN,
        asignacion: DD_ASIGNACION_FILTRO.SIN_ASIGNAR,
      }),
    );
    const where = whereBandeja();

    expect(where.origen).toBe(DD_ORIGENES.IMPORTADO);
    expect(where.tipoRelacionComercial).toEqual({ has: DD_VINCULOS.EXHIBIDOR });
    expect(where.documentos).toEqual({ none: {} });
    expect(where.revisadoPor).toBeNull();
  });

  it("filtra documentos cargados", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(params({ documentos: DD_DOCUMENTOS_FILTRO.CON }));

    expect(whereBandeja().documentos).toEqual({ some: {} });
  });

  it("filtra reputacion pendiente y revisor asignado", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(
      params({
        reputacion: DD_REPUTACION_FILTRO_PENDIENTE,
        asignacion: DD_ASIGNACION_FILTRO.REVISOR,
      }),
    );
    const where = whereBandeja();
    const and = conAnd(where);

    expect(and.some((condicion) => Array.isArray(condicion.OR))).toBe(true);
    expect(where.revisadoPor).toEqual({ not: null, notIn: ["importacion_masiva"] });
  });

  it("multiples consulta empresas con mas de una DD", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(params({ multiples: DD_MULTIPLES_FILTRO.CON }));

    expect(prismaMock.$queryRaw).toHaveBeenCalled();
    expect(whereBandeja().empresaId).toEqual({ in: [] });
  });

  it("filtra solicitudes de exhibidores despues de consultar", async () => {
    prismaMock.debidaDiligencia.findMany.mockResolvedValue([row]);
    prismaMock.debidaDiligencia.count.mockResolvedValue(1);
    prismaMock.debidaDiligencia.groupBy.mockResolvedValue([
      { estado: DD_ESTADOS.APROBADA, _count: { _all: 1 } },
    ]);
    prismaMock.solicitud.findMany.mockResolvedValue([
      { datosFacturacion: { numeroDocumento: row.empresa.ruc } },
    ]);

    const repo = new DebidaDiligenciaPrismaRepository();
    const resultado = await repo.listarBandeja(
      params({ solicitudes: DD_SOLICITUDES_FILTRO.CON }),
    );

    expect(resultado.data).toHaveLength(1);
    expect(resultado.data[0]?.solicitudesAlquiler).toBe(1);
  });

  it("excluye registros sin solicitudes cuando corresponde", async () => {
    prismaMock.debidaDiligencia.findMany.mockResolvedValue([row]);
    prismaMock.debidaDiligencia.count.mockResolvedValue(1);
    prismaMock.debidaDiligencia.groupBy.mockResolvedValue([
      { estado: DD_ESTADOS.APROBADA, _count: { _all: 1 } },
    ]);
    prismaMock.solicitud.findMany.mockResolvedValue([]);

    const repo = new DebidaDiligenciaPrismaRepository();
    const resultado = await repo.listarBandeja(
      params({ solicitudes: DD_SOLICITUDES_FILTRO.SIN }),
    );

    expect(resultado.data).toHaveLength(1);
    expect(resultado.data[0]?.solicitudesAlquiler).toBe(0);
  });

  it("no aplica filtros con valor 'todas'", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarBandeja(
      params({
        estado: DD_FILTRO_TODAS,
        origen: DD_FILTRO_TODAS,
        vinculo: DD_FILTRO_TODAS,
        documentos: DD_FILTRO_TODAS,
        reputacion: DD_FILTRO_TODAS,
        asignacion: DD_FILTRO_TODAS,
        multiples: DD_FILTRO_TODAS,
      }),
    );
    const where = whereBandeja();

    expect(where).not.toHaveProperty("estado");
    expect(where).not.toHaveProperty("origen");
    expect(where).not.toHaveProperty("tipoRelacionComercial");
    expect(where).not.toHaveProperty("revisadoPor");
  });
});

describe("filtros de matriz del panel", () => {
  const matriz = (overrides: Diccionario = {}) => ({
    eventoId: "evento-1",
    page: 1,
    perPage: 20,
    ...overrides,
  });

  it("Pendientes incluye borrador y pendiente", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarMatriz(matriz({ estado: DD_ESTADOS.PENDIENTE }));
    const ddWhere = whereMatriz().debidasDiligencias as {
      some?: Diccionario;
    };

    expect(ddWhere.some?.estado).toEqual({
      in: [DD_ESTADOS.BORRADOR, DD_ESTADOS.PENDIENTE],
    });
  });

  it("Por vencer aplica fecha de cese y estado aprobado", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarMatriz(matriz({ estado: DD_FILTRO_POR_VENCER }));
    const ddWhere = whereMatriz().debidasDiligencias as {
      some?: Diccionario;
    };

    expect(ddWhere.some?.estado).toBe(DD_ESTADOS.APROBADA);
    expect(ddWhere.some?.fechaVencimiento).toEqual({
      gte: expect.any(Date),
      lte: expect.any(Date),
    });
  });

  it("vinculo y busqueda no se mezclan con estados incompatibles", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarMatriz(
      matriz({ vinculo: DD_VINCULOS.PROVEEDOR, search: "EMPRESA" }),
    );
    const where = whereMatriz();
    const ddWhere = where.debidasDiligencias as { some?: Diccionario };

    expect(ddWhere.some?.tipoRelacionComercial).toEqual({
      has: DD_VINCULOS.PROVEEDOR,
    });
    expect(Array.isArray(where.OR)).toBe(true);
  });

  it("Sin iniciar excluye empresas con expediente en el evento", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarMatriz(matriz({ estado: DD_FILTRO_SIN_INICIAR }));

    expect(whereMatriz().debidasDiligencias).toEqual({
      none: { eventoId: "evento-1" },
    });
  });

  it("multiples usa empresas con mas de una DD", async () => {
    const repo = new DebidaDiligenciaPrismaRepository();
    await repo.listarMatriz(matriz({ multiples: DD_MULTIPLES_FILTRO.CON }));

    expect(prismaMock.$queryRaw).toHaveBeenCalled();
    expect(whereMatriz().id).toEqual({ in: [] });
  });

  it("filtrar por reputacion pendiente no interpreta una DD aprobada como pendiente", async () => {
    expect(DD_REPUTACION_ESTADOS.POR_REVISAR).not.toBe(DD_ESTADOS.APROBADA);
    expect(DD_REPUTACION_ESTADOS.EN_ANALISIS).not.toBe(DD_ESTADOS.APROBADA);
  });
});
