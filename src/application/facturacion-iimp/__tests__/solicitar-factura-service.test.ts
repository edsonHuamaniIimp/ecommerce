import { describe, expect, it, vi } from "vitest";
import { SolicitarFacturaApplicationService } from "../solicitar-factura-service";
import type { IFacturacionRepository, FacturacionRow } from "@/domain/ports/facturacion-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IPersonaClient } from "@/domain/ports/persona-client";
import type { IReservaIimpClient, ReservaIimpResponse } from "@/domain/ports/reserva-iimp-client";
import type { EmpresaEntity } from "@/domain/models/empresa";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

vi.mock("@/lib/server/email", () => ({
  enviarEmailPlantilla: vi.fn(async () => true),
  sendEmail: vi.fn(async () => true),
}));

const ident = { userId: "u1", email: "cliente@empresa.com" };

const empresa = {
  id: "emp-1",
  ruc: "20100171814",
  razonSocial: "HIDROSTAL S.A.",
  nombreComercial: "HIDROSTAL",
  direccionFiscal: "CAL. PORTADA DEL SOL 722",
  telefono: "51-1-3191000",
  sitioWeb: "https://www.hidrostal.com.pe",
  emailContacto: "contacto@hidrostal.com.pe",
  emailFacturacion: "facturacion@hidrostal.com.pe",
  representanteLegalNombre: "Manuel Mendieta",
  representanteLegalDni: "10295079",
  tipoComprobante: "factura",
} as unknown as EmpresaEntity;

const factRow = {
  id: "f1",
  solicitudId: "s1",
  cuotas: [{ id: "c1", numero: 1 }],
} as unknown as FacturacionRow;

/** Snapshot del paso 1 del wizard (fuente del payload). */
const snapshotFactura = {
  tipoComprobante: "factura",
  tipoDocumento: "RUC",
  numeroDocumento: "20100171814",
  razonSocial: "HIDROSTAL S.A.",
  direccion: "CAL. PORTADA DEL SOL 722",
  telefono: "51-1-3191000",
  contacto: "Manuel Mendieta",
  email: "cliente@empresa.com",
};

const snapshotBoleta = {
  tipoComprobante: "boleta",
  tipoDocumento: "DNI",
  numeroDocumento: "48570568",
  razonSocial: "",
  direccion: "MOTUPE",
  telefono: "918874873",
  contacto: "EDSON JORDAN HUAMANI",
  email: "cliente@empresa.com",
};

const datosBase = {
  iimpContrato: null,
  email: "cliente@empresa.com",
  tipoEvento: 2,
  codigoEvento: 19,
  stands: ["01", "21"],
  planCuotas: {
    modalidad: "cuotas",
    cuotas: [
      { numero: 1, porcentaje: 40, monto: 3696, fechaVencimiento: "2026-12-01T00:00:00.000Z" },
      { numero: 2, porcentaje: 60, monto: 5544, fechaVencimiento: "2027-01-15T00:00:00.000Z" },
    ],
  },
  datosFacturacion: snapshotFactura,
} as unknown as NonNullable<Awaited<ReturnType<ISolicitudesRepository["datosReservaIImp"]>>>;

const respuesta = {
  contrato: "0000000001",
  cuentaCorriente: 1,
  cliente: { tipo: "E", codigo: "E0000001153", nombre: "HIDROSTAL S.A.", tipDocumento: "6", numDocumento: "20100171814" },
  moneda: "USD",
  stands: [],
  cuotas: [
    { cuota: 1, porcentaje: "40", fecha: "2026-12-01", baseImponible: "3696.00", igv: "665.28", total: "4361.28", documento: { tipoDocumento: "01", serie: "FRS1", numero: 1, fechaEmision: "2026-10-05", tipoCambio: "3.442", igv: "665.28", total: "4361.28" } },
    { cuota: 2, porcentaje: "60", fecha: "2027-01-15", baseImponible: "5544.00", igv: "997.92", total: "6541.92", documento: null },
  ],
  baseImponible: "9240.00",
  igv: "1663.20",
  total: "10903.20",
} as ReservaIimpResponse;

const persona = {
  nombres: "EDSON JORDAN",
  apellido_paterno: "HUAMANI",
  apellido_materno: "ÑAHUIN",
  correo: "edson@persona.pe",
  celular: "918874873",
};

function mocks() {
  const facturacion = {
    esPropietarioDeCuota: vi.fn(async () => true),
    facturacionDeCuota: vi.fn(async () => factRow),
    guardarDocumentoIImp: vi.fn(async () => {}),
  } as unknown as IFacturacionRepository;
  const solicitudes = {
    datosReservaIImp: vi.fn(async () => datosBase),
    guardarReservaIImp: vi.fn(async () => {}),
  } as unknown as ISolicitudesRepository;
  const auth = { findEmpresaIdDeUsuario: vi.fn(async () => "emp-1") } as unknown as IAuthRepository;
  const empresas = { findById: vi.fn(async () => empresa) } as unknown as IEmpresaRepository;
  const reserva = { reservar: vi.fn(async () => respuesta) } as unknown as IReservaIimpClient;
  const personas = { buscarPorDocumento: vi.fn(async () => persona) } as unknown as IPersonaClient;
  return { facturacion, solicitudes, auth, empresas, reserva, personas };
}

function servicio(m: ReturnType<typeof mocks>) {
  return new SolicitarFacturaApplicationService(m.facturacion, m.solicitudes, m.auth, m.empresas, m.reserva, m.personas);
}

describe("SolicitarFacturaApplicationService", () => {
  it("arma la factura desde el snapshot del wizard y persiste contrato, cuenta y documento", async () => {
    const m = mocks();
    const r = await servicio(m).solicitar("c1", ident);

    expect(m.reserva.reservar).toHaveBeenCalledWith(expect.objectContaining({
      tipEvCod: 2,
      evenCod: 19,
      stands: ["01", "21"],
      tipoFacturacion: "01",
      tipDocFacturacion: "6",
      numDocFacturacion: "20100171814",
      razonSocial: "HIDROSTAL S.A.",
      dirFacturacion: "CAL. PORTADA DEL SOL 722",
      cuotas: [
        { porcentaje: 40, fecha: "2026-12-01" },
        { porcentaje: 60, fecha: "2027-01-15" },
      ],
    }));
    expect(m.solicitudes.guardarReservaIImp).toHaveBeenCalledWith("s1", expect.objectContaining({
      contrato: "0000000001",
      cuentaCorriente: "1",
      clienteCodigo: "E0000001153",
    }));
    expect(m.facturacion.guardarDocumentoIImp).toHaveBeenCalledWith("f1", 1, expect.objectContaining({ serie: "FRS1", numero: 1 }), expect.any(Date));
    expect(r).toMatchObject({ contrato: "0000000001", cuentaCorriente: 1 });
    expect(r.documento?.serie).toBe("FRS1");
  });

  it("factura sin empresa vinculada: el snapshot alcanza", async () => {
    const m = mocks();
    vi.mocked(m.auth.findEmpresaIdDeUsuario).mockResolvedValue(null);
    const r = await servicio(m).solicitar("c1", ident);

    expect(m.reserva.reservar).toHaveBeenCalledWith(expect.objectContaining({
      razonSocial: "HIDROSTAL S.A.",
      numDocFacturacion: "20100171814",
      dirFacturacion: "CAL. PORTADA DEL SOL 722",
    }));
    expect(r.contrato).toBe("0000000001");
  });

  it("boleta a persona natural: completa nombres/apellidos desde servicio-persona", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({ ...datosBase, datosFacturacion: snapshotBoleta } as never);
    await servicio(m).solicitar("c1", ident);

    expect(m.personas.buscarPorDocumento).toHaveBeenCalledWith("48570568");
    expect(m.reserva.reservar).toHaveBeenCalledWith(expect.objectContaining({
      tipoFacturacion: "03",
      tipDocFacturacion: "1",
      numDocFacturacion: "48570568",
      apellidoPaternoFact: "HUAMANI",
      apellidoMaternoFact: "ÑAHUIN",
      nombresFact: "EDSON JORDAN",
      dirFacturacion: "MOTUPE",
    }));
    const input = vi.mocked(m.reserva.reservar).mock.calls[0]?.[0];
    expect(input?.razonSocial).toBeUndefined();
  });

  it("boleta sin datos en el padron de personas: 400", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({ ...datosBase, datosFacturacion: snapshotBoleta } as never);
    vi.mocked(m.personas.buscarPorDocumento).mockResolvedValue(null);
    await expect(servicio(m).solicitar("c1", ident)).rejects.toMatchObject({ status: 400 });
  });

  it("ajusta porcentajes a enteros que suman 100 (el ultimo absorbe el redondeo)", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      planCuotas: {
        modalidad: "cuotas",
        cuotas: [
          { numero: 1, porcentaje: 33.33, monto: 1, fechaVencimiento: "2026-12-01T00:00:00.000Z" },
          { numero: 2, porcentaje: 33.33, monto: 1, fechaVencimiento: "2027-01-15T00:00:00.000Z" },
          { numero: 3, porcentaje: 33.34, monto: 1, fechaVencimiento: "2027-02-15T00:00:00.000Z" },
        ],
      },
    } as never);
    await servicio(m).solicitar("c1", ident);

    expect(m.reserva.reservar).toHaveBeenCalledWith(expect.objectContaining({
      cuotas: [
        { porcentaje: 33, fecha: "2026-12-01" },
        { porcentaje: 33, fecha: "2027-01-15" },
        { porcentaje: 34, fecha: "2027-02-15" },
      ],
    }));
  });

  it("no repite la reserva si ya tiene contrato IIMP", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({ ...datosBase, iimpContrato: "0000000009" } as never);
    await expect(servicio(m).solicitar("c1", ident)).rejects.toMatchObject({ status: 409 });
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });

  it("sin snapshot ni empresa vinculada: 400 (solicitudes viejas)", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({ ...datosBase, datosFacturacion: null } as never);
    vi.mocked(m.auth.findEmpresaIdDeUsuario).mockResolvedValue(null);
    await expect(servicio(m).solicitar("c1", ident)).rejects.toMatchObject({ status: 400 });
  });

  it("solicitud vieja sin snapshot: usa la empresa vinculada como respaldo", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({ ...datosBase, datosFacturacion: null } as never);
    await servicio(m).solicitar("c1", ident);

    expect(m.reserva.reservar).toHaveBeenCalledWith(expect.objectContaining({
      tipoFacturacion: "01",
      numDocFacturacion: "20100171814",
      razonSocial: "HIDROSTAL S.A.",
      dirFacturacion: "CAL. PORTADA DEL SOL 722",
    }));
  });

  it("propaga el 409 del IIMP (stand tomado) sin persistir", async () => {
    const m = mocks();
    vi.mocked(m.reserva.reservar).mockRejectedValue(Object.assign(new Error("Stands ya reservados: 01"), { status: 409 }));
    await expect(servicio(m).solicitar("c1", ident)).rejects.toMatchObject({ status: 409 });
    expect(m.solicitudes.guardarReservaIImp).not.toHaveBeenCalled();
  });

  it("exige direccion fiscal en la solicitud", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      datosFacturacion: { ...snapshotFactura, direccion: null },
    } as never);
    vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, direccionFiscal: null } as EmpresaEntity);
    await expect(servicio(m).solicitar("c1", ident)).rejects.toMatchObject({ status: 400 });
  });
});
