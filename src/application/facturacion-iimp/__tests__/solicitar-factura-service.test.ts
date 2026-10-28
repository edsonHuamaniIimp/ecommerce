import { describe, expect, it, vi } from "vitest";
import { APP_URL, TIPOS_DOCUMENTO_PERSONA } from "@/lib/shared/constants";
import { SolicitarFacturaApplicationService } from "../solicitar-factura-service";
import type { IFacturacionRepository, FacturacionRow } from "@/domain/ports/facturacion-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IPersonaClient } from "@/domain/ports/persona-client";
import type { IConsultaDocumentoClient } from "@/domain/ports/consulta-documento-client";
import type { IReservaIimpClient, ReservaIimpArchivoInput, ReservaIimpResponse } from "@/domain/ports/reserva-iimp-client";
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

/** Requisito del flujo: OC + HES para solicitar la factura. */
const ADJUNTO_OC: ReservaIimpArchivoInput = { tipo: "OC", link: "https://web.iimp.org/archivos/oc-1.pdf", nombre: "OC 1" };
const ADJUNTO_HES: ReservaIimpArchivoInput = { tipo: "HES", link: "https://web.iimp.org/archivos/hes-1.pdf", nombre: "HES 1" };
const ADJUNTOS: ReservaIimpArchivoInput[] = [ADJUNTO_OC, ADJUNTO_HES];

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
  numeroSolicitud: "CTRS-s1",
  contrato: "0000000001",
  cuentaCorriente: 1,
  cliente: { tipo: "E", codigo: "E0000001153", nombre: "HIDROSTAL S.A.", tipDocumento: "6", numDocumento: "20100171814" },
  moneda: "USD",
  stands: [],
  cuotas: [
    { cuota: 1, porcentaje: "40", fecha: "2026-12-01", baseImponible: "3696.00", igv: "665.28", total: "4361.28", documento: { tipoDocumento: "01", serie: "FRS1", numero: 1, fechaEmision: "2026-10-05", tipoCambio: "3.442", igv: "665.28", total: "4361.28" } },
    { cuota: 2, porcentaje: "60", fecha: "2027-01-15", baseImponible: "5544.00", igv: "997.92", total: "6541.92", documento: null },
  ],
  archivos: [],
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
  const consultaDocumento = { consultarDni: vi.fn(async () => null) } as unknown as IConsultaDocumentoClient;
  return { facturacion, solicitudes, auth, empresas, reserva, personas, consultaDocumento };
}

function servicio(m: ReturnType<typeof mocks>) {
  return new SolicitarFacturaApplicationService(m.facturacion, m.solicitudes, m.auth, m.empresas, m.reserva, m.personas, m.consultaDocumento);
}

describe("SolicitarFacturaApplicationService", () => {
  it("arma la factura desde el snapshot del wizard y persiste contrato, cuenta y documento", async () => {
    const m = mocks();
    const r = await servicio(m).solicitar("c1", ident, ADJUNTOS);

    expect(m.reserva.reservar).toHaveBeenCalledWith(expect.objectContaining({
      numeroSolicitud: "CTRS-s1",
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
    expect(r).toMatchObject({ numeroSolicitud: "CTRS-s1", contrato: "0000000001", cuentaCorriente: 1 });
    expect(r.documento?.serie).toBe("FRS1");
  });

  it("exige al menos una OC y una HES para la primera cuota (400)", async () => {
    const m = mocks();
    /* Sin documentos. */
    await expect(servicio(m).solicitar("c1", ident)).rejects.toMatchObject({ status: 400 });
    /* Solo OC. */
    await expect(servicio(m).solicitar("c1", ident, [ADJUNTO_OC])).rejects.toMatchObject({ status: 400 });
    /* Solo HES. */
    await expect(servicio(m).solicitar("c1", ident, [ADJUNTO_HES])).rejects.toMatchObject({ status: 400 });
    /* OC y HES solo de la cuota 2: la primera cuota sigue sin sus documentos. */
    await expect(servicio(m).solicitar("c1", ident, [
      { tipo: "OC", cuota: 2, link: "https://web.iimp.org/archivos/oc-2.pdf" },
      { tipo: "HES", cuota: 2, link: "https://web.iimp.org/archivos/hes-2.pdf" },
    ])).rejects.toMatchObject({ status: 400 });
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });

  it("acepta la OC y la HES asociadas a la primera cuota", async () => {
    const m = mocks();
    await expect(servicio(m).solicitar("c1", ident, [
      { tipo: "OC", cuota: 1, link: "https://web.iimp.org/archivos/oc-1.pdf" },
      { tipo: "HES", cuota: 1, link: "https://web.iimp.org/archivos/hes-1.pdf" },
    ])).resolves.toMatchObject({ numeroSolicitud: "CTRS-s1" });
  });

  it("factura sin empresa vinculada: el snapshot alcanza", async () => {
    const m = mocks();
    vi.mocked(m.auth.findEmpresaIdDeUsuario).mockResolvedValue(null);
    const r = await servicio(m).solicitar("c1", ident, ADJUNTOS);

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
    await servicio(m).solicitar("c1", ident, ADJUNTOS);

    expect(m.personas.buscarPorDocumento).toHaveBeenCalledWith("48570568", TIPOS_DOCUMENTO_PERSONA.DNI);
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
    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS)).rejects.toMatchObject({ status: 400 });
  });

  it("boleta sin datos en el padron: completa desde RENIEC (respaldo)", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({ ...datosBase, datosFacturacion: snapshotBoleta } as never);
    vi.mocked(m.personas.buscarPorDocumento).mockResolvedValue(null);
    vi.mocked(m.consultaDocumento.consultarDni).mockResolvedValue({
      nombres: "ENRIQUE",
      apellidoPaterno: "VILLAFANA",
      apellidoMaterno: "IZAGUIRRE",
      nombreCompleto: "ENRIQUE VILLAFANA IZAGUIRRE",
    });
    await servicio(m).solicitar("c1", ident, ADJUNTOS);

    expect(m.consultaDocumento.consultarDni).toHaveBeenCalledWith("48570568");
    expect(m.reserva.reservar).toHaveBeenCalledWith(expect.objectContaining({
      tipoFacturacion: "03",
      tipDocFacturacion: "1",
      numDocFacturacion: "48570568",
      apellidoPaternoFact: "VILLAFANA",
      apellidoMaternoFact: "IZAGUIRRE",
      nombresFact: "ENRIQUE",
    }));
  });

  it("comprobante ausente o invalido: 400 (no asume factura en silencio)", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      datosFacturacion: { ...snapshotFactura, tipoComprobante: "" },
    } as never);
    vi.mocked(m.auth.findEmpresaIdDeUsuario).mockResolvedValue(null);
    vi.mocked(m.empresas.findById).mockResolvedValue(null);
    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS)).rejects.toMatchObject({ status: 400 });
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
    await servicio(m).solicitar("c1", ident, ADJUNTOS);

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
    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS)).rejects.toMatchObject({ status: 409 });
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });

  it("sin snapshot ni empresa vinculada: 400 (solicitudes viejas)", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({ ...datosBase, datosFacturacion: null } as never);
    vi.mocked(m.auth.findEmpresaIdDeUsuario).mockResolvedValue(null);
    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS)).rejects.toMatchObject({ status: 400 });
  });

  it("solicitud vieja sin snapshot: usa la empresa vinculada como respaldo", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({ ...datosBase, datosFacturacion: null } as never);
    await servicio(m).solicitar("c1", ident, ADJUNTOS);

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
    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS)).rejects.toMatchObject({ status: 409 });
    expect(m.solicitudes.guardarReservaIImp).not.toHaveBeenCalled();
  });

  it("exige direccion fiscal en la solicitud", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      datosFacturacion: { ...snapshotFactura, direccion: null },
    } as never);
    vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, direccionFiscal: null } as EmpresaEntity);
    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS)).rejects.toMatchObject({ status: 400 });
  });

  it("usa un NumeroSolicitud determinista de la solicitud (max 30 chars)", async () => {
    const m = mocks();
    vi.mocked(m.facturacion.facturacionDeCuota).mockResolvedValue({
      id: "f1",
      solicitudId: "0f8a1b2c-3d4e-5f60-7182-93040a5b6c7d",
      cuotas: [{ id: "c1", numero: 1 }],
    } as unknown as FacturacionRow);

    await servicio(m).solicitar("c1", ident, ADJUNTOS);

    const input = vi.mocked(m.reserva.reservar).mock.calls[0]?.[0];
    expect(input?.numeroSolicitud).toBe("CTRS-0f8a1b2c3d4e5f60718293040");
    expect(input?.numeroSolicitud.length).toBeLessThanOrEqual(30);
  });

  it("respuesta v2 sin comprobante: no persiste documento y el resultado lo refleja", async () => {
    const m = mocks();
    vi.mocked(m.reserva.reservar).mockResolvedValue({
      ...respuesta,
      cuotas: respuesta.cuotas.map((c) => ({ ...c, documento: null })),
    });

    const r = await servicio(m).solicitar("c1", ident, ADJUNTOS);

    expect(m.facturacion.guardarDocumentoIImp).not.toHaveBeenCalled();
    expect(r.documento).toBeNull();
  });

  it("envía la OC y la HES de la cuenta corriente", async () => {
    const m = mocks();
    await servicio(m).solicitar("c1", ident, ADJUNTOS);

    expect(m.reserva.reservar).toHaveBeenCalledWith(expect.objectContaining({
      archivos: ADJUNTOS,
    }));
  });

  it("rechaza archivos invalidos antes de llamar al IIMP (400)", async () => {
    const m = mocks();
    /* Tipo desconocido. */
    await expect(servicio(m).solicitar("c1", ident, [{ tipo: "OTRO", link: "https://x/a.pdf" }])).rejects.toMatchObject({ status: 400 });
    /* Detraccion sin numero de cuota. */
    await expect(servicio(m).solicitar("c1", ident, [ADJUNTO_OC, { tipo: "DETRACCION", link: "https://x/a.pdf" }])).rejects.toMatchObject({ status: 400 });
    /* Link que no es http(s). */
    await expect(servicio(m).solicitar("c1", ident, [{ tipo: "OC", link: "ftp://x/a.pdf" }, ADJUNTO_HES])).rejects.toMatchObject({ status: 400 });
    /* Cuota fuera del rango del plan (2 cuotas). */
    await expect(servicio(m).solicitar("c1", ident, [ADJUNTO_OC, ADJUNTO_HES, { tipo: "DIFERENCIA", cuota: 5, link: "https://x/a.pdf" }])).rejects.toMatchObject({ status: 400 });
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });

  it("normaliza links relativos /uploads a URL absoluta antes de enviarlos al IIMP", async () => {
    const m = mocks();
    await servicio(m).solicitar("c1", ident, [
      { tipo: "OC", cuota: 1, link: "/uploads/1791940172580.pdf", nombre: "OC 1" },
      ADJUNTO_HES,
    ]);

    const input = vi.mocked(m.reserva.reservar).mock.calls[0]?.[0];
    expect(input?.archivos?.[0]?.link).toBe(`${APP_URL}/uploads/1791940172580.pdf`);
  });

  it("descarta los elementos sin link y valida el requisito con los restantes (v3)", async () => {
    const m = mocks();
    await servicio(m).solicitar("c1", ident, [{ tipo: "OC", link: "   " }, ...ADJUNTOS]);

    const input = vi.mocked(m.reserva.reservar).mock.calls[0]?.[0];
    expect(input?.archivos).toEqual(ADJUNTOS);
  });
});

describe("SolicitarFacturaApplicationService.requisitos de facturacion", () => {
  it("permite solicitar sin OC/HES cuando el cliente declara ninguna de las anteriores", async () => {
    const m = mocks();
    await expect(servicio(m).solicitar("c1", ident, [], { ninguna: true })).resolves.toMatchObject({ numeroSolicitud: "CTRS-s1" });
    expect(m.solicitudes.guardarReservaIImp).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      requisitos: expect.objectContaining({ ninguna: true, cuota: 1 }),
    }));
  });

  it("guarda la declaracion de requisitos con la cuota de origen", async () => {
    const m = mocks();
    await servicio(m).solicitar("c1", ident, ADJUNTOS, {
      oc: true, hes: true, plataforma: true, plataformaNombre: "SAP Ariba", plataformaUrl: "https://ariba.example.com",
      valorizacion: true, otros: "Carta de conformidad",
    });
    expect(m.solicitudes.guardarReservaIImp).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      requisitos: {
        oc: true, hes: true, plataforma: true, plataformaNombre: "SAP Ariba", plataformaUrl: "https://ariba.example.com",
        valorizacion: true, otros: "Carta de conformidad", ninguna: false, cuota: 1,
      },
    }));
  });

  it("rechaza un enlace de plataforma que no es http(s) (400)", async () => {
    const m = mocks();
    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS, { plataforma: true, plataformaUrl: "ftp://x/a" })).rejects.toMatchObject({ status: 400 });
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });
});
