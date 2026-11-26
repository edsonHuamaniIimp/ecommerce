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
import { DomainError } from "@/lib/server/router";
import type { RegistrarIntentoFacturaData } from "@/domain/ports/facturacion-intento-repository";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400, public readonly detalle?: unknown) {
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
    actualizarRequisitosFacturacion: vi.fn(async () => {}),
  } as unknown as ISolicitudesRepository;
  const auth = { findEmpresaIdDeUsuario: vi.fn(async () => "emp-1") } as unknown as IAuthRepository;
  const empresas = { findById: vi.fn(async () => empresa) } as unknown as IEmpresaRepository;
  const reserva = {
    reservar: vi.fn(async () => respuesta),
    agregarArchivos: vi.fn(async () => []),
  } as unknown as IReservaIimpClient;
  const personas = {
    buscarPorDocumento: vi.fn(async () => persona),
    listarPaises: vi.fn(async () => [
      { codigo: 5, nombre: "ALEMANIA" },
      { codigo: 39, nombre: "CHILE" },
      { codigo: 81, nombre: "ITALIA" },
      { codigo: 75, nombre: "PERU" },
    ]),
  } as unknown as IPersonaClient;
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

  it("permite solicitar sin OC/HES: la declaracion de requisitos es referencial", async () => {
    const m = mocks();
    await expect(servicio(m).solicitar("c1", ident)).resolves.toMatchObject({ numeroSolicitud: "CTRS-s1" });
    expect(m.solicitudes.guardarReservaIImp).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ requisitos: null }));
  });

  it("rechaza una declaracion de requisitos vacia (400)", async () => {
    const m = mocks();
    await expect(servicio(m).solicitar("c1", ident, [], {})).rejects.toMatchObject({ status: 400 });
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });

  it("rechaza solicitar la cuota 2 fuera de la ventana de 30 dias (409)", async () => {
    const m = mocks();
    vi.mocked(m.facturacion.facturacionDeCuota).mockResolvedValue({
      ...factRow,
      cuotas: [
        { id: "c1", numero: 1, fechaVencimiento: "2026-11-15" },
        { id: "c2", numero: 2, fechaVencimiento: "2099-01-01" },
      ],
    } as never);

    await expect(servicio(m).solicitar("c2", ident, [], { ninguna: true })).rejects.toMatchObject({ status: 409 });
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });

  it("permite solicitar la cuota 1 aunque su fecha este lejos", async () => {
    const m = mocks();
    vi.mocked(m.facturacion.facturacionDeCuota).mockResolvedValue({
      ...factRow,
      cuotas: [{ id: "c1", numero: 1, fechaVencimiento: "2099-01-01" }],
    } as never);

    await expect(servicio(m).solicitar("c1", ident, [], { ninguna: true }))
      .resolves.toMatchObject({ numeroSolicitud: "CTRS-s1" });
  });

  it("envia la descripcion de la factura como TextoLibre de la cuota de origen", async () => {
    const m = mocks();
    await servicio(m).solicitar("c1", ident, [], { ninguna: true, descripcionFactura: "OC 4501 - 1ra cuota" });

    const payload = vi.mocked(m.reserva.reservar).mock.calls[0]?.[0];
    expect(payload?.cuotas[0]).toEqual(expect.objectContaining({ textoLibre: "OC 4501 - 1ra cuota" }));
    expect(payload?.cuotas[1]?.textoLibre).toBeUndefined();
  });

  it("rechaza una descripcion de factura de mas de 100 caracteres (400)", async () => {
    const m = mocks();
    await expect(
      servicio(m).solicitar("c1", ident, [], { ninguna: true, descripcionFactura: "x".repeat(101) }),
    ).rejects.toMatchObject({ status: 400 });
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });

  it("Facturacion registra la solicitud en nombre del cliente", async () => {
    const m = mocks();
    const r = await servicio(m).solicitarComoStaff("c1", [], { ninguna: true });

    expect(m.reserva.reservar).toHaveBeenCalled();
    expect(m.solicitudes.guardarReservaIImp).toHaveBeenCalled();
    expect(r.numeroSolicitud).toBe("CTRS-s1");
  });

  it("Facturacion completa requisitos en nombre del cliente", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      iimpContrato: "0000000008",
      iimpCuentaCorriente: "8",
      requisitosFacturacion: { oc: false, hes: false, plataforma: false, valorizacion: false, otros: null, ninguna: false, cuota: 1 },
    } as never);

    await servicio(m).completarRequisitosComoStaff("c1", [], { ninguna: true });

    expect(m.solicitudes.actualizarRequisitosFacturacion).toHaveBeenCalledWith("s1", expect.objectContaining({ ninguna: true }));
  });

  it("completa requisitos de una solicitud ya enviada y sube documentos a la cuenta", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      iimpContrato: "0000000008",
      iimpCuentaCorriente: "8",
      requisitosFacturacion: { oc: false, hes: false, plataforma: false, valorizacion: false, otros: null, ninguna: false, cuota: 1 },
    } as never);

    await servicio(m).completarRequisitos(
      "c1",
      ident,
      [{ tipo: "OC", cuota: 1, link: "https://web.iimp.org/archivos/oc-1.pdf" }],
      { oc: true },
    );

    expect(m.reserva.reservar).not.toHaveBeenCalled();
    expect(m.reserva.agregarArchivos).toHaveBeenCalledWith({
      numeroSolicitud: "CTRS-s1",
      archivos: [expect.objectContaining({ tipo: "OC", cuota: 1 })],
    });
    expect(m.solicitudes.actualizarRequisitosFacturacion).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ oc: true, cuota: 1 }),
    );
  });

  it("no permite completar requisitos si la reserva aun no se registro (409)", async () => {
    const m = mocks();
    await expect(servicio(m).completarRequisitos("c1", ident, [], { ninguna: true })).rejects.toMatchObject({ status: 409 });
    expect(m.solicitudes.actualizarRequisitosFacturacion).not.toHaveBeenCalled();
  });

  it("no permite sobrescribir requisitos ya declarados (409)", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      iimpContrato: "0000000008",
      iimpCuentaCorriente: "8",
      requisitosFacturacion: { oc: true, cuota: 1 },
    } as never);

    await expect(servicio(m).completarRequisitos("c1", ident, [], { hes: true })).rejects.toMatchObject({ status: 409 });
    expect(m.solicitudes.actualizarRequisitosFacturacion).not.toHaveBeenCalled();
  });

  it("rechaza completar sin declarar ningun requisito (400)", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      iimpContrato: "0000000008",
      iimpCuentaCorriente: "8",
      requisitosFacturacion: { oc: false, hes: false, plataforma: false, valorizacion: false, otros: null, ninguna: false, cuota: 1 },
    } as never);

    await expect(servicio(m).completarRequisitos("c1", ident, [], {})).rejects.toMatchObject({ status: 400 });
    expect(m.solicitudes.actualizarRequisitosFacturacion).not.toHaveBeenCalled();
  });

  it("acepta la OC y la HES asociadas a la primera cuota", async () => {
    const m = mocks();
    await expect(servicio(m).solicitar("c1", ident, [
      { tipo: "OC", cuota: 1, link: "https://web.iimp.org/archivos/oc-1.pdf" },
      { tipo: "HES", cuota: 1, link: "https://web.iimp.org/archivos/hes-1.pdf" },
    ])).resolves.toMatchObject({ numeroSolicitud: "CTRS-s1" });
  });

  it("empresa extranjera (no domiciliada): TipDocFacturacion 0, documento alfanumerico y pais", async () => {
    const m = mocks();
    vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, ruc: "76123456K", tipoDocumento: "0", pais: "CL", razonSocial: "EMPRESA CHILE SPA" } as unknown as EmpresaEntity);
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      datosFacturacion: { ...snapshotFactura, tipoDocumento: "0", numeroDocumento: "76.123.456-K", razonSocial: "EMPRESA CHILE SPA" },
    } as typeof datosBase);
    await servicio(m).solicitar("c1", ident, ADJUNTOS);

    const enviado = vi.mocked(m.reserva.reservar).mock.calls[0]?.[0];
    expect(enviado).toMatchObject({ tipoFacturacion: "03", tipDocFacturacion: "0", numDocFacturacion: "76123456K", razonSocial: "EMPRESA CHILE SPA", pais: 39 });
    expect(enviado?.contactos.contrato).not.toHaveProperty("tipoDocumento");
  });

  it("boleta de empresa extranjera: va a la EMPRESA (03, tipo 0, razon social y pais), no a su representante", async () => {
    const m = mocks();
    vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, ruc: "DE119360948", tipoDocumento: "0", pais: "DE", razonSocial: "MESSE DUSSELDORF GMBH", representanteLegalNombre: "BERLEMANN, MARIUS" } as unknown as EmpresaEntity);
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      datosFacturacion: { ...snapshotFactura, tipoComprobante: "boleta", tipoDocumento: "0", numeroDocumento: "DE119360948", razonSocial: "MESSE DUSSELDORF GMBH", contacto: "BERLEMANN, MARIUS" },
    } as typeof datosBase);
    await servicio(m).solicitar("c1", ident, ADJUNTOS);

    const enviado = vi.mocked(m.reserva.reservar).mock.calls[0]?.[0];
    expect(enviado).toMatchObject({ tipoFacturacion: "03", tipDocFacturacion: "0", numDocFacturacion: "DE119360948", razonSocial: "MESSE DUSSELDORF GMBH", pais: 5 });
    expect(enviado).not.toHaveProperty("nombresFact");
    expect(enviado).not.toHaveProperty("apellidoPaternoFact");
    expect(m.personas.buscarPorDocumento).not.toHaveBeenCalled();
  });

  it("empresa extranjera: el pais viaja como codigo numerico del catalogo del SIE (Alemania = 5), no como ISO", async () => {
    const m = mocks();
    vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, ruc: "DE119360948", tipoDocumento: "0", pais: "DE", razonSocial: "MESSE DUSSELDORF GMBH" } as unknown as EmpresaEntity);
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      datosFacturacion: { ...snapshotFactura, tipoComprobante: "boleta", tipoDocumento: "0", numeroDocumento: "DE119360948", razonSocial: "MESSE DUSSELDORF GMBH" },
    } as typeof datosBase);
    await servicio(m).solicitar("c1", ident, ADJUNTOS);

    const enviado = vi.mocked(m.reserva.reservar).mock.calls[0]?.[0];
    expect(enviado?.pais).toBe(5);
    expect(typeof enviado?.pais).toBe("number");
  });

  it("empresa extranjera: si el pais no figura en el catalogo del SIE no se envia y se explica", async () => {
    const m = mocks();
    vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, ruc: "JP123456789", tipoDocumento: "0", pais: "JP", razonSocial: "EMPRESA JAPON KK" } as unknown as EmpresaEntity);
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      datosFacturacion: { ...snapshotFactura, tipoComprobante: "boleta", tipoDocumento: "0", numeroDocumento: "JP123456789", razonSocial: "EMPRESA JAPON KK" },
    } as typeof datosBase);

    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS)).rejects.toThrow(/JP.*catalogo del SIE/);
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });

  it("empresa extranjera: si el catalogo de paises no responde no se envia al SIE", async () => {
    const m = mocks();
    vi.mocked(m.personas.listarPaises).mockRejectedValue(new Error("timeout"));
    vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, ruc: "DE119360948", tipoDocumento: "0", pais: "DE", razonSocial: "MESSE DUSSELDORF GMBH" } as unknown as EmpresaEntity);
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      datosFacturacion: { ...snapshotFactura, tipoComprobante: "boleta", tipoDocumento: "0", numeroDocumento: "DE119360948", razonSocial: "MESSE DUSSELDORF GMBH" },
    } as typeof datosBase);

    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS)).rejects.toThrow(/catalogo de paises/);
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });

  it("boleta de empresa extranjera: si el correo de la solicitud no tiene usuario, la empresa se ubica por su documento", async () => {
    const m = mocks();
    vi.mocked(m.auth.findEmpresaIdDeUsuario).mockResolvedValue(null);
    (m.empresas as unknown as { findByRuc: unknown }).findByRuc = vi.fn(async () => ({ ...empresa, ruc: "699035009", tipoDocumento: "0", pais: "CL", razonSocial: "ITALIAN TRADE AGENCY - ICE AGENCIA" }));
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      datosFacturacion: { ...snapshotFactura, tipoComprobante: "boleta", tipoDocumento: "0", numeroDocumento: "699035009", razonSocial: "ITALIAN TRADE AGENCY - ICE AGENCIA" },
    } as typeof datosBase);
    await servicio(m).solicitar("c1", ident, ADJUNTOS);
    expect(vi.mocked(m.reserva.reservar).mock.calls[0]?.[0]).toMatchObject({ tipoFacturacion: "03", tipDocFacturacion: "0", pais: 39 });
  });

  it("empresa extranjera sin pais: 400 antes de llamar al SIE", async () => {
    const m = mocks();
    vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, ruc: "76123456K", tipoDocumento: "0", pais: "" } as unknown as EmpresaEntity);
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      datosFacturacion: { ...snapshotFactura, tipoDocumento: "0", numeroDocumento: "76123456K" },
    } as typeof datosBase);
    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS)).rejects.toMatchObject({ status: 400 });
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });

  it("RUC peruano invalido sigue siendo rechazado (no se trata como extranjera)", async () => {
    const m = mocks();
    vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, ruc: "123" } as unknown as EmpresaEntity);
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      datosFacturacion: { ...snapshotFactura, tipoDocumento: "RUC", numeroDocumento: "123" },
    } as typeof datosBase);
    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS)).rejects.toMatchObject({ status: 400 });
  });

  describe("bitacora de solicitudes fallidas", () => {
    const REQ = { oc: true, descripcionFactura: "L-07 - CUOTA 1" };

    function conBitacora(m: ReturnType<typeof mocks>) {
      const intentos = { registrarFallo: vi.fn(async (_d: RegistrarIntentoFacturaData) => {}) };
      const s = new SolicitarFacturaApplicationService(m.facturacion, m.solicitudes, m.auth, m.empresas, m.reserva, m.personas, m.consultaDocumento, false, intentos);
      return { s, intentos };
    }

    it("si el SIE falla con 500, guarda lo declarado, el payload y el identificador (y relanza el error)", async () => {
      const m = mocks();
      vi.mocked(m.reserva.reservar).mockRejectedValue(new DomainError("Error del API de reserva del IIMP (5d71cefe)", "INTERNAL", 502, { httpStatus: 500, cuerpo: { identificador: "5d71cefe" } }));
      const { s, intentos } = conBitacora(m);
      await expect(s.solicitar("c1", ident, ADJUNTOS, REQ)).rejects.toMatchObject({ status: 502 });

      expect(intentos.registrarFallo).toHaveBeenCalledTimes(1);
      const dato = vi.mocked(intentos.registrarFallo).mock.calls[0]?.[0];
      expect(dato).toMatchObject({ solicitudId: "s1", cuotaId: "c1", origen: "cliente", resultado: "error_sie", httpStatus: 500, identificadorSie: "5d71cefe" });
      expect(dato?.requisitos).toMatchObject({ oc: true, descripcionFactura: "L-07 - CUOTA 1" });
      expect(dato?.archivos).toEqual(expect.any(Array));
      expect(dato?.payload).toMatchObject({ numeroSolicitud: expect.any(String), stands: expect.any(Array) });
    });

    it("Facturacion que la programo: origen programada y actor", async () => {
      const m = mocks();
      vi.mocked(m.reserva.reservar).mockRejectedValue(new DomainError("SIE caido", "INTERNAL", 502));
      const { s, intentos } = conBitacora(m);
      await expect(s.solicitar("c1", ident, ADJUNTOS, REQ, { registradoPor: "admin@iimp.org.pe", programadaPara: "2026-11-25T15:00:00.000Z" })).rejects.toBeDefined();
      expect(vi.mocked(intentos.registrarFallo).mock.calls[0]?.[0]).toMatchObject({ origen: "programada", actor: "admin@iimp.org.pe" });
    });

    it("una validacion local (antes de armar el envio) no se guarda", async () => {
      const m = mocks();
      const { s, intentos } = conBitacora(m);
      await expect(s.solicitar("c1", ident, ADJUNTOS, { oc: false })).rejects.toMatchObject({ status: 400 });
      expect(intentos.registrarFallo).not.toHaveBeenCalled();
    });

    it("si todo sale bien no guarda nada", async () => {
      const m = mocks();
      const { s, intentos } = conBitacora(m);
      await s.solicitar("c1", ident, ADJUNTOS, REQ);
      expect(intentos.registrarFallo).not.toHaveBeenCalled();
    });

    it("si la bitacora misma falla, el error original sigue llegando al usuario", async () => {
      const m = mocks();
      vi.mocked(m.reserva.reservar).mockRejectedValue(new DomainError("Error del API de reserva del IIMP (abc)", "INTERNAL", 502));
      const { s, intentos } = conBitacora(m);
      vi.mocked(intentos.registrarFallo).mockRejectedValue(new Error("db caida"));
      await expect(s.solicitar("c1", ident, ADJUNTOS, REQ)).rejects.toMatchObject({ message: "Error del API de reserva del IIMP (abc)" });
    });
  });

  describe("correo que viaja al SIE", () => {
    const correosEnviados = (m: ReturnType<typeof mocks>) => {
      const input = vi.mocked(m.reserva.reservar).mock.calls[0]?.[0];
      return { contrato: input?.contactos.contrato.email, pagos: input?.contactos.pagos.email };
    };
    const conPerfil = (m: ReturnType<typeof mocks>, perfil: { email: string; notificationEmail: string | null } | null) => {
      (m.auth as unknown as { findPerfilByEmail: unknown }).findPerfilByEmail = vi.fn(async () => perfil);
    };

    it("1) el responsable de pagos de la empresa manda sobre todo lo demas", async () => {
      const m = mocks();
      vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, responsablePagosEmail: "pagos@hidrostal.com.pe" } as unknown as EmpresaEntity);
      conPerfil(m, { email: "cliente@empresa.com", notificationEmail: "notif@cliente.com" });
      await servicio(m).solicitar("c1", ident, ADJUNTOS);
      expect(correosEnviados(m)).toEqual({ contrato: "pagos@hidrostal.com.pe", pagos: "pagos@hidrostal.com.pe" });
    });

    it("2) sin responsable de pagos: correo de facturacion de la empresa (no el del paso 1 de la reserva)", async () => {
      const m = mocks();
      await servicio(m).solicitar("c1", ident, ADJUNTOS);
      expect(correosEnviados(m)).toEqual({ contrato: "facturacion@hidrostal.com.pe", pagos: "facturacion@hidrostal.com.pe" });
    });

    it("3) sin correos de facturacion: el de notificaciones que el cliente eligio en su perfil", async () => {
      const m = mocks();
      vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, emailFacturacion: null, responsablePagosEmail: null } as unknown as EmpresaEntity);
      conPerfil(m, { email: "cliente@empresa.com", notificationEmail: "notif@cliente.com" });
      await servicio(m).solicitar("c1", ident, ADJUNTOS);
      expect(correosEnviados(m)).toEqual({ contrato: "notif@cliente.com", pagos: "notif@cliente.com" });
    });

    it("3) si el cliente no eligio otro, se usa su correo de acceso", async () => {
      const m = mocks();
      vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, emailFacturacion: null } as unknown as EmpresaEntity);
      conPerfil(m, { email: "acceso@cliente.com", notificationEmail: null });
      await servicio(m).solicitar("c1", ident, ADJUNTOS);
      expect(correosEnviados(m).pagos).toBe("acceso@cliente.com");
    });

    it("sin ninguno de los tres: no se bloquea, recurre al correo de la solicitud", async () => {
      const m = mocks();
      vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, emailFacturacion: null } as unknown as EmpresaEntity);
      conPerfil(m, null);
      await servicio(m).solicitar("c1", ident, ADJUNTOS);
      expect(correosEnviados(m).pagos).toBe("cliente@empresa.com");
    });
  });

  describe("tope de stands por operacion", () => {
    const conStands = (m: ReturnType<typeof mocks>, n: number) => {
      const stands = Array.from({ length: n }, (_, i) => String(i + 1));
      vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({ ...datosBase, stands } as typeof datosBase);
    };

    it("una solicitud de 80 stands (pabellon) se envia al SIE", async () => {
      const m = mocks();
      conStands(m, 80);
      await servicio(m).solicitar("c1", ident, ADJUNTOS);
      expect(vi.mocked(m.reserva.reservar).mock.calls[0]?.[0].stands).toHaveLength(80);
    });

    it("mas de 100 stands se rechaza antes de llamar al SIE", async () => {
      const m = mocks();
      conStands(m, 101);
      await expect(servicio(m).solicitar("c1", ident, ADJUNTOS)).rejects.toMatchObject({ status: 400, message: expect.stringContaining("100") });
      expect(m.reserva.reservar).not.toHaveBeenCalled();
    });
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
        valorizacion: true, otros: "Carta de conformidad", ninguna: false, descripcionFactura: null, cuota: 1,
      },
    }));
  });

  it("rechaza un enlace de plataforma que no es http(s) (400)", async () => {
    const m = mocks();
    await expect(servicio(m).solicitar("c1", ident, ADJUNTOS, { plataforma: true, plataformaUrl: "ftp://x/a" })).rejects.toMatchObject({ status: 400 });
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });
});

describe("SolicitarFacturaApplicationService.consultarVigente (API de lectura para el SIE)", () => {
  function conLectura(m: ReturnType<typeof mocks>) {
    (m.solicitudes as unknown as { findSolicitudIdPorNumeroIImp: unknown }).findSolicitudIdPorNumeroIImp = vi.fn(async () => "672ea54e-c291-423d-9627-1bd5ac25a303");
    (m.solicitudes as unknown as { findSolicitudIdPorContrato: unknown }).findSolicitudIdPorContrato = vi.fn(async () => "672ea54e-c291-423d-9627-1bd5ac25a303");
    return servicio(m);
  }

  it("boleta a empresa extranjera ya corregida: devuelve la EMPRESA (razon social, tipo 0, pais numerico y correo de facturacion)", async () => {
    const m = mocks();
    vi.mocked(m.empresas.findById).mockResolvedValue({ ...empresa, razonSocial: "Portwest UC", ruc: "84245291", tipoDocumento: "0", pais: "IE", emailFacturacion: "eduardo@portwest.com" } as unknown as EmpresaEntity);
    vi.mocked(m.personas.listarPaises).mockResolvedValue([{ codigo: 134, nombre: "IRLANDA" }]);
    vi.mocked(m.solicitudes.datosReservaIImp).mockResolvedValue({
      ...datosBase,
      iimpContrato: "0000000045",
      iimpCuentaCorriente: "45",
      moneda: "USD",
      tipoCambio: 1,
      standsPrecio: [{ codigo: "184", standCode: "184", precioUsd: 9240 }, { codigo: "185", standCode: "185", precioUsd: 9240 }],
      datosFacturacion: { ...snapshotFactura, tipoComprobante: "boleta", tipoDocumento: "0", numeroDocumento: "84245291", razonSocial: "Portwest UC", email: "eduardo@portwest.com" },
    } as typeof datosBase);

    const r = await conLectura(m).consultarVigente({ numeroSolicitud: "CTRS-672ea54ec291423d96271bd5a" });

    expect(r.contrato).toBe("0000000045");
    expect(r.facturacion).toMatchObject({
      tipoComprobante: "03",
      tipoDocumento: "0",
      numeroDocumento: "84245291",
      razonSocial: "Portwest UC",
      paisCodigo: 134,
      correoFacturacion: "eduardo@portwest.com",
      nombres: null,
    });
    expect(r.stands).toHaveLength(2);
    expect(r.cuotas).toHaveLength(2);
    expect(r.version).toMatch(/^[0-9a-f]{16}$/);
    expect(m.reserva.reservar).not.toHaveBeenCalled();
  });

  it("no envia ni modifica nada y no expone datos del representante", async () => {
    const m = mocks();
    const r = await conLectura(m).consultarVigente({ contrato: "0000000001" });
    expect(m.reserva.reservar).not.toHaveBeenCalled();
    expect(m.solicitudes.guardarReservaIImp).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toMatch(/representante|pasaporte/i);
  });

  it("la version solo cambia cuando cambian los datos vigentes", async () => {
    const m1 = mocks();
    const m2 = mocks();
    const a = await conLectura(m1).consultarVigente({ contrato: "x" });
    const b = await conLectura(m2).consultarVigente({ contrato: "x" });
    expect(a.version).toBe(b.version);

    const m3 = mocks();
    vi.mocked(m3.solicitudes.datosReservaIImp).mockResolvedValue({ ...datosBase, datosFacturacion: { ...snapshotFactura, razonSocial: "OTRA RAZON SOCIAL S.A." } } as typeof datosBase);
    const c = await conLectura(m3).consultarVigente({ contrato: "x" });
    expect(c.version).not.toBe(a.version);
  });

  it("sin numeroSolicitud ni contrato: 400; solicitud inexistente: 404", async () => {
    const m = mocks();
    await expect(servicio(m).consultarVigente({})).rejects.toMatchObject({ status: 400 });

    const m2 = mocks();
    (m2.solicitudes as unknown as { findSolicitudIdPorNumeroIImp: unknown }).findSolicitudIdPorNumeroIImp = vi.fn(async () => null);
    await expect(servicio(m2).consultarVigente({ numeroSolicitud: "CTRS-nada" })).rejects.toMatchObject({ status: 404 });
  });
});
