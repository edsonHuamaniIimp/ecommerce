import { describe, it, expect, vi } from "vitest";
import PizZip from "pizzip";
import { ContratoApplicationService } from "../contrato-service";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IPlanoRepository } from "@/domain/ports/plano-repository";
import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { StorageAdapter } from "@/lib/server/storage";
import type { SolicitudRow, RevisionEntity, ReevaluacionEntity } from "@/domain/models/entities";
import type { EmpresaEntity } from "@/domain/models/empresa";
import { PERMISSIONS, MODOS_PAGO, TIPOS_COMPROBANTE } from "@/lib/shared/constants";

/*
 * Los tests asumen "sin conversor PDF" (solo DOCX). En Windows el fallback con MS Word
 * haria la conversion real (lenta y dependiente de la maquina): se fija platform linux
 * para que la deteccion de LibreOffice/Word no aplique.
 */
Object.defineProperty(process, "platform", { value: "linux", configurable: true });

vi.mock("server-only", () => ({}));
vi.mock("@/application/idioma/resolver-idioma", () => ({
  resolverIdiomaDestinatario: vi.fn().mockResolvedValue("es"),
}));
vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

function solicitudRow(): SolicitudRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    gessStandId: "g1",
    standCode: "EXT-DER-03",
    standCodes: ["EXT-DER-03"],
    tipoStand: "ESTANDAR_01",
    medidas: null,
    precio: 2000,
    empresa: null,
    email: "contacto@minera.pe",
    userId: "user-1",
    bloqueId: "EXT-DER-03",
    estado: "en_evaluacion",
    estadoSolicitud: "pendiente",
    flgActivo: true,
    documentos: [],
    imagenes: [],
    docsAdjuntosCount: 0,
    clienteDocsAdjuntosCount: 0,
    docsAdminCount: 0,
    docsAdjuntos: [],
    updatedAt: new Date("2026-10-03T00:00:00Z"),
    revisiones: [] as RevisionEntity[],
    reevaluaciones: [] as ReevaluacionEntity[],
    revisionAsociado: null,
    revisionLegal: null,
    tieneFacturacion: false,
    tipoFacturacion: null,
    facturacionId: null,
    sgcEstadoEnvio: null,
    sgcLifecycleStatus: null,
    sgcStage: null,
    sgcSubsanacionMotivo: null,
    sgcDocumentosEnviados: false,
    sgcEnabled: false,
  } as unknown as SolicitudRow;
}

function empresaEntity(): EmpresaEntity {
  return {
    id: "emp-1",
    ruc: "20601234567",
    razonSocial: "MINERA CORDILLERA S.A.C.",
    logoUrl: null,
    nombreComercial: null,
    direccionFiscal: "Av. Los Ingenieros 245, Lima",
    telefono: null,
    emailContacto: "contacto@minera.pe",
    emailFacturacion: null,
    representanteLegalNombre: "JORGE QUISPE RAMOS",
    representanteLegalDni: "45871233",
    partidaElectronica: "11014857",
    tipoComprobante: TIPOS_COMPROBANTE.FACTURA,
    sitioWeb: null,
    estado: "activa",
    cuentaCreada: true,
    primerAccesoCompletado: true,
    datosValidadosEn: null,
    creadoPor: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as EmpresaEntity;
}

function build(overrides: { detalle?: Partial<SolicitudRow> } = {}) {
  const detalle = { ...solicitudRow(), ...overrides.detalle } as SolicitudRow;

  const solicitudes = {
    detalle: vi.fn().mockResolvedValue(detalle),
    crearDocumentoAdjunto: vi.fn().mockResolvedValue({}),
    guardarPlanCuotas: vi.fn().mockResolvedValue(undefined),
    upsertContratoSistema: vi.fn().mockResolvedValue(undefined),
  } as unknown as ISolicitudesRepository;
  const empresas = { findById: vi.fn().mockResolvedValue(empresaEntity()) } as unknown as IEmpresaRepository;
  const planos = {
    ubicacionDeBloque: vi.fn().mockResolvedValue({
      plano: { id: "p1", codigo: "gess", nombre: "Pabellon GESS", tipo: "simple" },
      bloque: { bloqueId: "EXT-DER-03", tipoCodigo: "S", x: 18.5, z: -9.25, rotY: 0 },
      macro: null,
    }),
    detallePorCodigo: vi.fn().mockResolvedValue({
      tipos: [{ codigo: "S", w: 3, d: 3, h: 2.4, color: "#FFD700", flgActivo: true }],
      bloques: [{ bloqueId: "EXT-DER-03", tipoCodigo: "S", x: 18.5, z: -9.25, rotY: 0, flgActivo: true }],
    }),
  } as unknown as IPlanoRepository;
  const auth = { findEmpresaIdDeUsuario: vi.fn().mockResolvedValue("emp-1"), findPerfilByEmail: vi.fn().mockResolvedValue({ firmaUrl: null }) } as unknown as IAuthRepository;
  const gess = { findById: vi.fn() } as unknown as IGessRepository;
  const storage = {
    upload: vi.fn(async (_buf: Buffer, filename: string) => `/uploads/${filename}`),
  } as unknown as StorageAdapter;

  const svc = new ContratoApplicationService(solicitudes, empresas, planos, gess, auth, storage);
  return { svc, solicitudes, storage, auth, gess };
}

function textoDocx(buffer: Buffer): string {
  const zip = new PizZip(buffer);
  const xml = zip.file("word/document.xml")?.asText() ?? "";
  return (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("");
}

describe("ContratoApplicationService.generar (RF-11)", () => {
  it("genera el DOCX con datos de empresa, stand, IGV y lo adjunta como contrato", async () => {
    const { svc, solicitudes, storage } = build();

    const resultado = await svc.generar({
      solicitudId: "11111111-1111-4111-8111-111111111111",
      cuotas: [{ porcentaje: 50, fechaVencimiento: "2099-01-01" }, { porcentaje: 50, fechaVencimiento: "2099-02-01" }],
      userSub: "user-1",
      userPermissions: [],
    });

    expect(resultado.docxUrl).toMatch(/^\/uploads\/contrato-.*\.docx$/);
    expect(storage.upload).toHaveBeenCalledTimes(1); // sin soffice en local: solo DOCX

    const buffer = vi.mocked(storage.upload).mock.calls[0]?.[0] as Buffer;
    const texto = textoDocx(buffer);
    expect(texto).toContain("MINERA CORDILLERA S.A.C.");
    expect(texto).toContain("EXT-DER-03");
    expect(texto).toContain("360.00"); // IGV 18% de 2000
    expect(texto).toContain("2,360.00"); // total con factura
    expect(texto).toContain("Modalidad 2 X:");
    expect(texto).toContain("11014857"); // partida electronica
    /* Imagen del Anexo 1 generada en el servidor (sharp) + caption con version/fecha. */
    const zip = new PizZip(buffer);
    const media = Object.keys(zip.files).filter((n) => n.startsWith("word/media/"));
    expect(media.length).toBeGreaterThanOrEqual(1);
    expect(texto).toContain("Pabellon GESS - Version 1 -");

    expect(solicitudes.crearDocumentoAdjunto).not.toHaveBeenCalled();
    expect(solicitudes.upsertContratoSistema).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      resultado.docxUrl,
      expect.stringContaining("50% / 50%"),
    );
    expect(solicitudes.guardarPlanCuotas).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({ modalidad: MODOS_PAGO.CUOTAS }),
    );
  });

  it("agrega IGV 18% siempre (tambien en boleta) y con pago completo marca la Modalidad 1", async () => {
    const { svc, storage } = build();

    await svc.generar({
      solicitudId: "11111111-1111-4111-8111-111111111111",
      cuotas: [{ porcentaje: 100, fechaVencimiento: "2099-01-01" }],
      userSub: "user-1",
      userPermissions: [],
    });

    const buffer = vi.mocked(storage.upload).mock.calls[0]?.[0] as Buffer;
    const texto = textoDocx(buffer);
    expect(texto).toContain("Modalidad 1 X:");
    expect(texto).toContain("360.00");
  });

  it("con cuotas personalizadas marca la Modalidad 3 e imprime el cronograma", async () => {
    const { svc, storage } = build();

    await svc.generar({
      solicitudId: "11111111-1111-4111-8111-111111111111",
      cuotas: [{ porcentaje: 30, fechaVencimiento: "2099-01-01" }, { porcentaje: 30, fechaVencimiento: "2099-02-01" }, { porcentaje: 40, fechaVencimiento: "2099-03-01" }],
      userSub: "user-1",
      userPermissions: [],
    });

    const buffer = vi.mocked(storage.upload).mock.calls[0]?.[0] as Buffer;
    const texto = textoDocx(buffer);
    expect(texto).toContain("Modalidad 3 X:");
    expect(texto).toContain("Cuota 1: 30% del total");
    expect(texto).toContain("Cuota 3: 40% del total");
  });

  it("rechaza a un usuario ajeno sin permisos", async () => {
    const { svc, storage } = build();

    await expect(
      svc.generar({
        solicitudId: "11111111-1111-4111-8111-111111111111",
        cuotas: [{ porcentaje: 100, fechaVencimiento: "2099-01-01" }],
        userSub: "intruso",
        userPermissions: [],
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("un admin puede generar el contrato de una solicitud ajena", async () => {
    const { svc, storage } = build();

    await svc.generar({
      solicitudId: "11111111-1111-4111-8111-111111111111",
      cuotas: [{ porcentaje: 100, fechaVencimiento: "2099-01-01" }],
      userSub: "admin",
      userPermissions: [PERMISSIONS.ADMIN_FULL],
    });

    expect(storage.upload).toHaveBeenCalledTimes(1);
  });

  /* ---------------- Robustez del flujo de dinero (RF-10/11) ---------------- */

  it("rechaza generar si el stand no tiene precio configurado", async () => {
    const { svc, storage } = build({ detalle: { precio: 0 } });

    await expect(
      svc.generar({
        solicitudId: "11111111-1111-4111-8111-111111111111",
        cuotas: [{ porcentaje: 100, fechaVencimiento: "2099-01-01" }],
        userSub: "user-1",
        userPermissions: [],
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("rechaza configuraciones con cuotas que redondean a menos del minimo", async () => {
    const { svc, storage } = build({ detalle: { precio: 0.02 } });

    await expect(
      svc.generar({
        solicitudId: "11111111-1111-4111-8111-111111111111",
        cuotas: [{ porcentaje: 33.33, fechaVencimiento: "2099-01-01" }, { porcentaje: 33.33, fechaVencimiento: "2099-02-01" }, { porcentaje: 33.34, fechaVencimiento: "2099-03-01" }],
        userSub: "user-1",
        userPermissions: [],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("defiende en el servicio una configuracion de cuotas invalida", async () => {
    const { svc } = build();

    await expect(
      svc.generar({
        solicitudId: "11111111-1111-4111-8111-111111111111",
        cuotas: [{ porcentaje: 50, fechaVencimiento: "2099-01-01" }, { porcentaje: 40, fechaVencimiento: "2099-02-01" }],
        userSub: "user-1",
        userPermissions: [],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("regenera el contrato usando el plan persistido cuando no se envian cuotas", async () => {
    const plan = {
      modalidad: MODOS_PAGO.PERSONALIZADO,
      cuotas: [
        { numero: 1, porcentaje: 25, monto: 590, fechaVencimiento: "2026-11-02" },
        { numero: 2, porcentaje: 35, monto: 826, fechaVencimiento: "2026-12-17" },
        { numero: 3, porcentaje: 40, monto: 944, fechaVencimiento: "2027-01-31" },
      ],
    };
    const { svc, solicitudes, storage } = build({ detalle: { planCuotas: plan } });

    await svc.generar({
      solicitudId: "11111111-1111-4111-8111-111111111111",
      cuotas: undefined as unknown as Array<{ porcentaje: number; fechaVencimiento: string }>,
      userSub: "user-1",
      userPermissions: [],
    });

    const buffer = vi.mocked(storage.upload).mock.calls[0]?.[0] as Buffer;
    expect(textoDocx(buffer)).toContain("Modalidad 3 X:");
    expect(solicitudes.guardarPlanCuotas).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({ modalidad: MODOS_PAGO.PERSONALIZADO }),
    );
  });

  it("bloquea al cliente regenerar cuando la solicitud ya avanzo", async () => {
    const { svc, storage } = build({ detalle: { estadoSolicitud: "en_proceso" } });

    await expect(
      svc.generar({
        solicitudId: "11111111-1111-4111-8111-111111111111",
        cuotas: [{ porcentaje: 100, fechaVencimiento: "2099-01-01" }],
        userSub: "user-1",
        userPermissions: [],
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("el admin si puede regenerar una solicitud avanzada", async () => {
    const { svc, storage } = build({ detalle: { estadoSolicitud: "en_proceso" } });

    await svc.generar({
      solicitudId: "11111111-1111-4111-8111-111111111111",
      cuotas: [{ porcentaje: 50, fechaVencimiento: "2099-01-01" }, { porcentaje: 50, fechaVencimiento: "2099-02-01" }],
      userSub: "admin",
      userPermissions: [PERMISSIONS.ADMIN_FULL],
    });

    expect(storage.upload).toHaveBeenCalledTimes(1);
  });

  it("persiste el plan con las fechas configuradas por el cliente", async () => {
    const { svc, solicitudes } = build();

    await svc.generar({
      solicitudId: "11111111-1111-4111-8111-111111111111",
      cuotas: [{ porcentaje: 50, fechaVencimiento: "2099-01-10" }, { porcentaje: 50, fechaVencimiento: "2099-02-10" }],
      userSub: "user-1",
      userPermissions: [],
    });

    expect(solicitudes.guardarPlanCuotas).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({
        cuotas: [
          expect.objectContaining({ numero: 1, porcentaje: 50, fechaVencimiento: "2099-01-10" }),
          expect.objectContaining({ numero: 2, porcentaje: 50, fechaVencimiento: "2099-02-10" }),
        ],
      }),
    );
  });

  it("rechaza fechas pasadas o desordenadas (defensa en el servicio)", async () => {
    const { svc, storage } = build();

    await expect(
      svc.generar({
        solicitudId: "11111111-1111-4111-8111-111111111111",
        cuotas: [{ porcentaje: 50, fechaVencimiento: "2020-01-01" }, { porcentaje: 50, fechaVencimiento: "2099-01-01" }],
        userSub: "user-1",
        userPermissions: [],
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      svc.generar({
        solicitudId: "11111111-1111-4111-8111-111111111111",
        cuotas: [{ porcentaje: 50, fechaVencimiento: "2099-02-01" }, { porcentaje: 50, fechaVencimiento: "2099-01-01" }],
        userSub: "user-1",
        userPermissions: [],
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("genera el DOCX en ingles cuando el cliente tiene el idioma en (F3)", async () => {
    const { svc, storage } = build();

    await svc.generar({
      solicitudId: "11111111-1111-4111-8111-111111111111",
      cuotas: [{ porcentaje: 100, fechaVencimiento: "2099-01-01" }],
      idioma: "en",
      userSub: "user-1",
      userPermissions: [],
    });

    const buffer = vi.mocked(storage.upload).mock.calls[0]?.[0] as Buffer;
    const texto = textoDocx(buffer);
    expect(texto).toContain("EXHIBITION CONTRACT");
    expect(texto).not.toContain("CONTRATO DE EXHIBICIÓN");
  });

  it("usa la plantilla en espanol por defecto cuando no se envia idioma", async () => {
    const { svc, storage } = build();

    await svc.generar({
      solicitudId: "11111111-1111-4111-8111-111111111111",
      cuotas: [{ porcentaje: 100, fechaVencimiento: "2099-01-01" }],
      userSub: "user-1",
      userPermissions: [],
    });

    const buffer = vi.mocked(storage.upload).mock.calls[0]?.[0] as Buffer;
    expect(textoDocx(buffer)).toContain("CONTRATO DE EXHIBICIÓN");
  });

  it("rechaza firmar digitalmente si el perfil no tiene firma (RF-12)", async () => {
    const { svc } = build();

    await expect(
      svc.firmar({
        solicitudId: "11111111-1111-4111-8111-111111111111",
        userSub: "user-1",
        userPermissions: [],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("firma con la imagen del perfil y devuelve el contrato firmado (RF-12)", async () => {
    const PNG_1PX = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const { svc, storage, auth } = build({
      detalle: {
        planCuotas: {
          modalidad: "personalizado",
          cuotas: [{ numero: 1, porcentaje: 100, monto: 2360, fechaVencimiento: "2099-01-01" }],
        },
      } as never,
    });
    vi.mocked(auth.findPerfilByEmail).mockResolvedValue({ firmaUrl: "https://cdn.test/firma.png" } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => PNG_1PX }));

    const firmado = await svc.firmar({
      solicitudId: "11111111-1111-4111-8111-111111111111",
      userSub: "user-1",
      userPermissions: [],
    });

    expect(firmado.docxUrl).toContain(".docx");
    const buffer = vi.mocked(storage.upload).mock.calls[0]?.[0] as Buffer;
    const zip = new PizZip(buffer);
    const media = Object.keys(zip.files).filter((f) => f.startsWith("word/media/"));
    expect(media.length).toBeGreaterThanOrEqual(2);
    /* La firma va ARRIBA de la linea, centrada con un tab de 6513 twips (sin imagen flotante). */
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain('w:pos="6513"');
    expect(xml).not.toContain("<wp:anchor");
    vi.unstubAllGlobals();
  });

  it("genera el borrador SIN crear ni persistir la solicitud (wizard, paso Contrato)", async () => {
    const { svc, solicitudes, storage, gess } = build();
    vi.mocked(gess.findById).mockResolvedValue({
      id: "g1",
      eventoId: "ev-1",
      standApiId: "EXT-DER-03",
      standCode: "EXT-DER-03",
      tipoStand: "ESTANDAR_01",
      medidas: null,
      estado: "disponible",
      empresa: null,
      bloqueId: "EXT-DER-03",
    } as never);

    const out = await svc.generarBorrador({
      standIds: ["g1"],
      cuotas: [{ porcentaje: 100, fechaVencimiento: "2099-01-01" }],
      email: "contacto@minera.pe",
    });

    expect(out.docxUrl).toContain(".docx");
    expect(storage.upload).toHaveBeenCalled();
    expect(solicitudes.upsertContratoSistema).not.toHaveBeenCalled();
    expect(solicitudes.guardarPlanCuotas).not.toHaveBeenCalled();
  });

  it("firmarBorrador exige firma cargada en el perfil", async () => {
    const { svc } = build();

    await expect(
      svc.firmarBorrador({
        standIds: ["g1"],
        cuotas: [{ porcentaje: 100, fechaVencimiento: "2099-01-01" }],
        email: "contacto@minera.pe",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
