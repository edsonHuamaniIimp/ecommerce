import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type { DdExpedienteEntity } from "@/domain/models/debida-diligencia";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import {
  DD_ACCIONES_LEGAL,
  DD_ACCIONES_REVISION,
  DD_ESTADOS,
  DD_ETAPAS_ENVIO,
  DD_MENSAJES,
  DD_FILTRO_LEGAL_SEGUIMIENTO,
  PERMISSIONS,
} from "@/lib/shared/constants";

vi.mock("@/lib/shared/utils/debida-diligencia", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/shared/utils/debida-diligencia")>();
  return {
    ...original,
    ddUtils: {
      ...original.ddUtils,
      puedeEditar: () => true,
      erroresDeEnvio: () => [],
      documentosFaltantes: () => [],
    },
  };
});

const BANDEJA_VACIA = {
  data: [],
  total: 0,
  page: 1,
  perPage: 20,
  totalPages: 0,
  resumen: {
    total: 0,
    pendientes: 0,
    enRevision: 0,
    observadas: 0,
    aprobadas: 0,
    vencidas: 0,
    rechazadas: 0,
  },
};

function expedienteObservadoPorLegal(decisionLegal: string | null): DdExpedienteEntity {
  return {
    id: "exp-1",
    empresaId: "emp-1",
    codigo: "DD-2026-0493",
    estado: DD_ESTADOS.OBSERVADA,
    decisionLegal,
    emailRepresentante: null,
    documentos: [],
    empresa: { razonSocial: "MS4M S.A.C.", representanteCorreo: null, emailContacto: null },
  } as unknown as DdExpedienteEntity;
}

function crearServicio(expediente?: DdExpedienteEntity) {
  const repo = {
    listarBandeja: vi.fn().mockResolvedValue(BANDEJA_VACIA),
    findExpedientePorEmpresaEvento: vi.fn().mockResolvedValue(expediente),
    tieneExpedienteImportadoAprobadoVigente: vi.fn().mockResolvedValue(false),
    listarObservaciones: vi.fn().mockResolvedValue([]),
    resolverObservaciones: vi.fn(),
    actualizarEstado: vi.fn().mockImplementation(async (_id: string, data: { estado: string }) => ({
      ...expediente,
      estado: data.estado,
    })),
    registrarAuditoria: vi.fn(),
    registrarHistorial: vi.fn().mockResolvedValue(undefined),
    listarHistorial: vi.fn().mockResolvedValue([]),
    findExpedientePorId: vi.fn().mockResolvedValue(expediente),
  } as unknown as IDebidaDiligenciaRepository;
  const authRepo = {
    findEmpresaIdDeUsuario: vi.fn().mockResolvedValue("emp-1"),
  } as unknown as IAuthRepository;
  const notificaciones = {
    notificarLegal: vi.fn().mockResolvedValue(undefined),
    notificarReenvioLogistica: vi.fn().mockResolvedValue(undefined),
    expedienteRecibido: vi.fn().mockResolvedValue(undefined),
  } as unknown as IDebidaDiligenciaNotificacionPort;
  const validator = {
    validarDocumento: vi.fn().mockResolvedValue(undefined),
  } as unknown as IDebidaDiligenciaDocumentoValidator;
  const servicio = new DebidaDiligenciaApplicationService(repo, authRepo, notificaciones, validator);
  return { servicio, repo, notificaciones };
}

describe("bandejaLegal - seguimiento", () => {
  it("consulta revision legal y observados por Legal en una sola bandeja", async () => {
    const { servicio, repo } = crearServicio();
    await servicio.bandejaLegal(
      { page: 1, perPage: 20 },
      { email: "legal@iimp.org.pe", roles: [], permissions: [PERMISSIONS.DD_LEGAL], eventoId: "evento-1" },
    );
    expect(repo.listarBandeja).toHaveBeenCalledWith(
      expect.objectContaining({ estado: DD_FILTRO_LEGAL_SEGUIMIENTO, eventoId: "evento-1" }),
    );
  });

  it("exige el permiso de Legal", async () => {
    const { servicio } = crearServicio();
    await expect(
      servicio.bandejaLegal(
        { page: 1, perPage: 20 },
        { email: "otro@iimp.org.pe", roles: [], permissions: [], eventoId: "evento-1" },
      ),
    ).rejects.toThrow();
  });
});

describe("enviar - subsanacion de observacion legal", () => {
  const sesionCliente = {
    email: "cliente@empresa.pe",
    roles: [],
    permissions: [PERMISSIONS.DD_FORMULARIO],
    eventoId: "evento-1",
  };

  it("vuelve a revision legal y alerta a Legal como reenvio", async () => {
    const { servicio, repo, notificaciones } = crearServicio(
      expedienteObservadoPorLegal(DD_ACCIONES_LEGAL.OBSERVAR),
    );
    await servicio.enviar(sesionCliente);
    expect(repo.actualizarEstado).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ estado: DD_ESTADOS.EN_LEGAL }),
    );
    expect(notificaciones.notificarLegal).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: "DD-2026-0493", reenvio: true }),
    );
    expect(notificaciones.notificarReenvioLogistica).not.toHaveBeenCalled();
  });

  it("el primer envio queda en Documentacion recibida (no en revision)", async () => {
    const { servicio, repo, notificaciones } = crearServicio({ ...expedienteObservadoPorLegal(null), estado: DD_ESTADOS.BORRADOR, emailRepresentante: "rep@example.com" } as DdExpedienteEntity);
    await servicio.enviar(sesionCliente);
    expect(repo.actualizarEstado).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ estado: DD_ESTADOS.DOCUMENTACION_RECIBIDA }),
    );
    expect(repo.registrarHistorial).toHaveBeenCalledWith("exp-1", expect.objectContaining({ titulo: "Documentación recibida" }));
    expect(notificaciones.expedienteRecibido).toHaveBeenCalledWith(expect.objectContaining({ etapa: DD_ETAPAS_ENVIO.RECIBIDA }));
  });

  it("no alerta a Legal cuando la observacion no fue de Legal", async () => {
    const { servicio, repo, notificaciones } = crearServicio(expedienteObservadoPorLegal(null));
    await servicio.enviar(sesionCliente);
    expect(repo.actualizarEstado).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ estado: DD_ESTADOS.EN_REVISION }),
    );
    expect(notificaciones.notificarLegal).not.toHaveBeenCalled();
  });
});

describe("revisar - sin iniciar la revision no hay conclusion", () => {
  it("rechaza aprobar u observar una DD en Documentacion recibida", async () => {
    const recibida = { ...expedienteObservadoPorLegal(null), estado: DD_ESTADOS.DOCUMENTACION_RECIBIDA } as DdExpedienteEntity;
    const { servicio, repo } = crearServicio(recibida);
    const sig = { email: "sig@iimp.org.pe", roles: [], permissions: [PERMISSIONS.DD_REVISION], eventoId: "evento-1" };
    for (const accion of [DD_ACCIONES_REVISION.APROBAR, DD_ACCIONES_REVISION.OBSERVAR, DD_ACCIONES_REVISION.RECHAZAR]) {
      await expect(servicio.revisar({ expedienteId: "exp-1", accion } as never, sig)).rejects.toMatchObject({
        status: 409,
        message: DD_MENSAJES.REVISION_NO_INICIADA,
      });
    }
    expect(repo.actualizarEstado).not.toHaveBeenCalled();
  });
});
