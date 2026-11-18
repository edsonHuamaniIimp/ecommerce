import { describe, expect, it, vi } from "vitest";
import { ReservaApplicationService } from "../reserva-service";
import { SolicitudesApplicationService } from "@/application/solicitudes/solicitudes-service";
import { FacturacionApplicationService } from "@/application/facturacion/facturacion-service";
import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { SgcIntegracionApplicationService } from "@/application/sgc-integracion/sgc-integracion-service";
import type { RevisionEntity, SolicitudRow } from "@/domain/models/entities";
import {
  ESTADOS_DOCUMENTO_SOLICITUD,
  ESTADOS_SOLICITUD,
  REVISION_AREAS,
  RESULTADOS_APROBACION,
  TIPOS_DOCUMENTO_SOLICITUD,
  TIPOS_SOLICITUD,
} from "@/lib/shared/constants";

vi.mock("@/lib/server/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  enviarEmailPlantilla: vi.fn().mockResolvedValue(true),
}));

const EVENTO_ID = "evt-multistand";
const EMPRESA_RUC = "20123456789";
const CLIENTE_ID = "user-cliente";

function standsMock() {
  const stands = [
    { id: "g-03", standCode: "03", precio: "7440.00 USD", bloqueId: "B-1" },
    { id: "g-04", standCode: "04", precio: "15000.00 USD", bloqueId: "B-1" },
    { id: "g-05", standCode: "05", precio: "7440.00 USD", bloqueId: "B-1" },
    { id: "g-06", standCode: "06", precio: "7440.00 USD", bloqueId: "B-1" },
    { id: "g-07", standCode: "07", precio: "7440.00 USD", bloqueId: "B-1" },
  ];

  const findById = vi.fn(async (id: string) => {
    const stand = stands.find((item) => item.id === id);
    return stand
      ? {
          id: stand.id,
          eventoId: EVENTO_ID,
          standApiId: stand.id,
          standCode: stand.standCode,
          tipoStand: "Estándar 6mt2",
          medidas: stand.precio,
          estado: "disponible",
          empresa: null,
          bloqueId: stand.bloqueId,
          email: null,
          userId: null,
          rawData: null,
          preReservaRuc: null,
          preReservaSie: null,
          preReservaRazonSocial: null,
        }
      : null;
  });
  const update = vi.fn(async () => ({}));

  return {
    repo: { findById, update } as unknown as IGessRepository,
    update,
  };
}

function empresaMock() {
  return {
    findByRuc: vi.fn(async () => ({
      ruc: EMPRESA_RUC,
      estado: "activa",
      razonSocial: "ABASTECEDORES Y SERVICIOS INDUSTRIALES S.A.",
      tipoDocumento: "6",
      tipoComprobante: "01",
      direccionFiscal: "Av. Prueba 123",
      telefono: null,
      emailContacto: "facturacion@empresa.pe",
      emailFacturacion: "facturacion@empresa.pe",
      representanteCorreo: "representante@empresa.pe",
      representanteLegalNombre: "Representante Legal",
      representanteLegalDni: "12345678",
      representanteUserId: CLIENTE_ID,
    })),
  } as unknown as IEmpresaRepository;
}

function authMock(): IAuthRepository {
  return {
    findPerfilByEmail: vi.fn(async () => ({
      empresa: {
        ruc: EMPRESA_RUC,
        razonSocial: "ABASTECEDORES Y SERVICIOS INDUSTRIALES S.A.",
        configCuotas: null,
      },
      nombreEmpresa: "ABASTECEDORES Y SERVICIOS INDUSTRIALES S.A.",
    })),
    findByEmail: vi.fn(async () => [{ userId: CLIENTE_ID }]),
    findEmpresaIdDeUsuario: vi.fn(async () => null),
  } as unknown as IAuthRepository;
}

function revision(area: string, estado: string, estadoAnterior: string): RevisionEntity {
  return {
    id: `rev-${area}`,
    solicitudId: "sol-multistand",
    area,
    estado,
    comentario: null,
    createdBy: "asociado@iimp.org.pe",
    updatedBy: null,
    createdAt: new Date("2026-11-17T12:00:00.000Z"),
    updatedAt: new Date("2026-11-17T12:00:00.000Z"),
    estadoAnterior,
    fuePrimeraRevision: true,
  };
}

describe("Integración reserva administrativa multistand -> facturación", () => {
  it("genera 5 stands, conserva descuentos/cuotas y llega a facturación sin enviar al SGC", async () => {
    const { repo: gessRepo, update: updateStand } = standsMock();
    const empresaRepo = empresaMock();
    const authRepo = authMock();
    let planGuardado: SolicitudRow["planCuotas"] = null;
    let row: SolicitudRow | null = null;

    const solicitudesRepo = {
      crearSolicitud: vi.fn(async () => "sol-multistand"),
      guardarPlanCuotas: vi.fn(async (_solicitudId: string, plan: NonNullable<SolicitudRow["planCuotas"]>) => {
        planGuardado = plan;
      }),
      habilitarContrato: vi.fn(async () => undefined),
      crearAlertaRevision: vi.fn(async () => undefined),
      crearAlertaReserva: vi.fn(async () => undefined),
      detalle: vi.fn(async () => row),
      crearOActualizarRevision: vi.fn(async () =>
        revision(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.APROBADO, RESULTADOS_APROBACION.PENDIENTE),
      ),
      marcarOrdenPago: vi.fn(async () => {
        if (row) row = { ...row, estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE_PAGO };
      }),
      datosReservaIImp: vi.fn(async () => null),
    } as unknown as ISolicitudesRepository;

    const contratoService = {
      generar: vi.fn(async () => ({
        docxUrl: "/uploads/contrato-multistand.docx",
        pdfUrl: null,
        nombre: "contrato-multistand",
      })),
    };

    const reservaService = new ReservaApplicationService(
      gessRepo,
      solicitudesRepo,
      authRepo,
      undefined,
      undefined,
      undefined,
      empresaRepo,
      contratoService as never,
    );

    const resultado = await reservaService.crearAdministrativa({
      eventoId: EVENTO_ID,
      empresaRuc: EMPRESA_RUC,
      standIds: ["g-03", "g-04", "g-05", "g-06", "g-07"],
      moneda: "USD",
      tipoComprobante: "factura",
      descuentosPorStand: [
        { standId: "g-03", tipo: "porcentaje", valor: 3 },
        { standId: "g-04", tipo: "porcentaje", valor: 5 },
        { standId: "g-05", tipo: "porcentaje", valor: 3 },
        { standId: "g-06", tipo: "porcentaje", valor: 3 },
        { standId: "g-07", tipo: "porcentaje", valor: 3 },
      ],
      cuotas: [
        { porcentaje: 80, fechaVencimiento: "2026-11-17" },
        { porcentaje: 10, fechaVencimiento: "2026-12-13" },
        { porcentaje: 10, fechaVencimiento: "2026-12-16" },
      ],
      actorEmail: "admin@iimp.org.pe",
    });

    expect(resultado).toMatchObject({ ok: true, solicitudId: "sol-multistand", estado: ESTADOS_SOLICITUD.PENDIENTE });
    expect(updateStand).toHaveBeenCalledTimes(10);
    expect(updateStand).toHaveBeenCalledWith("g-03", expect.objectContaining({ estado: "reservado" }));
    expect(updateStand).toHaveBeenCalledWith("g-07", expect.objectContaining({ estado: "reservado" }));

    expect(planGuardado).toEqual(expect.objectContaining({
      descuentoTipo: "por_stand",
      netoLista: 44760,
      descuentoMonto: 1642.8,
      netoDescontado: 43117.2,
      igv: 7761.1,
      total: 50878.3,
    }));
    const plan = planGuardado as unknown as NonNullable<SolicitudRow["planCuotas"]>;
    expect(plan.descuentosPorStand).toHaveLength(5);
    expect(plan.descuentosPorStand?.map((item) => item.standId)).toEqual([
      "g-03",
      "g-04",
      "g-05",
      "g-06",
      "g-07",
    ]);
    expect(plan.cuotas).toHaveLength(3);
    expect(plan.cuotas[0]?.monto).toBe(40702.64);
    expect(plan.cuotas[2]?.monto).toBe(5087.83);

    const adminContractDate = new Date("2026-11-17T12:00:00.000Z");
    const signedContractDate = new Date("2026-11-18T12:00:00.000Z");
    row = {
      id: "sol-multistand",
      gessStandId: null,
      standCode: "03, 04, 05, 06, 07",
      standCodes: ["03", "04", "05", "06", "07"],
      bloqueId: null,
      tipoStand: "Estándar 6mt2",
      medidas: null,
      empresa: "ABASTECEDORES Y SERVICIOS INDUSTRIALES S.A.",
      email: "facturacion@empresa.pe",
      userId: CLIENTE_ID,
      tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA,
      estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE,
      estado: null,
      flgActivo: true,
      documentos: [],
      imagenes: [],
      docsAdjuntosCount: 2,
      clienteDocsAdjuntosCount: 1,
      docsAdminCount: 1,
      docsAdjuntos: [
        {
          id: "doc-contrato",
          url: "/uploads/contrato-multistand.pdf",
          nombre: "contrato-multistand.pdf",
          userId: null,
          uploadedBy: "sistema",
          categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO,
          requisito: null,
          estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
          createdAt: adminContractDate,
        },
        {
          id: "doc-firmado",
          url: "/uploads/contrato-firmado.pdf",
          nombre: "contrato-firmado.pdf",
          userId: CLIENTE_ID,
          uploadedBy: "cliente@empresa.pe",
          categoria: TIPOS_DOCUMENTO_SOLICITUD.CONTRATO_FIRMADO,
          requisito: null,
          estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
          createdAt: signedContractDate,
        },
      ],
      updatedAt: signedContractDate,
      createdAt: adminContractDate,
      revisiones: [],
      reevaluaciones: [],
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
      planCuotas: plan,
    };

    const sgc = {
      crearExpedienteDesdeSolicitud: vi.fn(async () => null),
      enviarExpedienteAlSgc: vi.fn(async () => undefined),
    } as unknown as SgcIntegracionApplicationService;
    const solicitudesService = new SolicitudesApplicationService(solicitudesRepo, sgc);

    await solicitudesService.revisar({
      solicitudId: "sol-multistand",
      area: REVISION_AREAS.ASOCIADO,
      estado: RESULTADOS_APROBACION.APROBADO,
      reviewerEmail: "asociado@iimp.org.pe",
    });

    expect(sgc.crearExpedienteDesdeSolicitud).not.toHaveBeenCalled();
    expect(sgc.enviarExpedienteAlSgc).not.toHaveBeenCalled();
    expect(row?.estadoSolicitud).toBe(ESTADOS_SOLICITUD.PENDIENTE_PAGO);

    const facturacionService = new FacturacionApplicationService(
      { findFacturacionIdPorSolicitud: vi.fn(async () => null) } as never,
      authRepo,
      solicitudesRepo,
      { findById: vi.fn(async () => null) } as unknown as IEmpresaRepository,
      { listarArchivos: vi.fn(async () => []) } as never,
    );
    const expediente = await facturacionService.expediente("sol-multistand");

    expect(expediente.estadoSolicitud).toBe(ESTADOS_SOLICITUD.PENDIENTE_PAGO);
    expect(expediente.planCuotas).toEqual(plan);
    expect(expediente.planCuotas?.descuentosPorStand).toHaveLength(5);
    expect(expediente.planCuotas?.total).toBe(50878.3);
  });
});
