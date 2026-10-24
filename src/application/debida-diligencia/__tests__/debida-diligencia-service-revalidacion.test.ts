import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type { DdExpedienteEntity } from "@/domain/models/debida-diligencia";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import {
  DD_ACCIONES_REVISION,
  DD_ALCANCES_REVISION,
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTOS,
  DD_ESTADOS,
  DD_ORIGENES,
  PERMISSIONS,
} from "@/lib/shared/constants";

const session = {
  email: "logistica@iimp.org.pe",
  roles: [],
  permissions: [PERMISSIONS.DD_REVISION],
  eventoId: "evento-1",
};

function expediente(estadoDeclaracion: string | null = DD_DOCUMENTO_ESTADOS.CARGADO) {
  return {
    id: "exp-1",
    empresaId: "emp-1",
    eventoId: "evento-2",
    codigo: "DD-2026-0189",
    estado: DD_ESTADOS.APROBADA,
    origen: DD_ORIGENES.IMPORTADO,
    fechaAprobacion: new Date("2026-06-03"),
    fechaVencimiento: new Date("2099-12-03"),
    documentos: estadoDeclaracion
      ? [
          {
            id: "doc-decl",
            tipo: DD_DOCUMENTOS.DECLARACION_VIGENCIA,
            nombre: "declaracion.pdf",
            url: "/uploads/declaracion.pdf",
            estado: estadoDeclaracion,
            observacion: estadoDeclaracion === DD_DOCUMENTO_ESTADOS.OBSERVADO ? "Corregir" : null,
            updatedAt: new Date(),
            versiones: [],
          },
        ]
      : [],
    observaciones: [],
    empresa: {},
  } as unknown as DdExpedienteEntity;
}

function crearServicio(expedienteMock: DdExpedienteEntity) {
  const repo = {
    findExpedientePorId: vi.fn().mockResolvedValue(expedienteMock),
    marcarDeclaracionVigencia: vi.fn().mockResolvedValue(undefined),
    resolverObservacionesDocumento: vi.fn().mockResolvedValue(undefined),
    crearObservaciones: vi.fn().mockResolvedValue(undefined),
    guardarObservacionDocumento: vi.fn().mockResolvedValue(undefined),
    registrarHistorial: vi.fn().mockResolvedValue(undefined),
    actualizarEstado: vi.fn(),
  } as unknown as IDebidaDiligenciaRepository;
  const servicio = new DebidaDiligenciaApplicationService(
    repo,
    {} as IAuthRepository,
    {} as IDebidaDiligenciaNotificacionPort,
    {} as IDebidaDiligenciaDocumentoValidator,
  );
  return { servicio, repo };
}

function revisar(
  servicio: DebidaDiligenciaApplicationService,
  accion: "aprobar" | "observar",
  motivo: string | null = null,
) {
  return servicio.revisar(
    {
      expedienteId: "exp-1",
      alcance: DD_ALCANCES_REVISION.DECLARACION_VIGENCIA,
      accion,
      motivo,
      documentosObservados: [DD_DOCUMENTOS.DECLARACION_VIGENCIA],
      observaciones: [],
    },
    session,
  );
}

describe("revisión de la declaración de vigencia", () => {
  it("aprueba la declaración sin cambiar estado ni fechas de la DD", async () => {
    const { servicio, repo } = crearServicio(expediente());
    await revisar(servicio, DD_ACCIONES_REVISION.APROBAR);

    expect(repo.marcarDeclaracionVigencia).toHaveBeenCalledWith(
      "exp-1",
      DD_DOCUMENTO_ESTADOS.APROBADO,
      null,
    );
    expect(repo.resolverObservacionesDocumento).toHaveBeenCalledWith(
      "exp-1",
      DD_DOCUMENTOS.DECLARACION_VIGENCIA,
    );
    expect(repo.actualizarEstado).not.toHaveBeenCalled();
  });

  it("observa la declaración cargada sin cambiar el estado de la DD", async () => {
    const { servicio, repo } = crearServicio(expediente());
    await revisar(servicio, DD_ACCIONES_REVISION.OBSERVAR, "El PDF no corresponde");

    expect(repo.marcarDeclaracionVigencia).toHaveBeenCalledWith(
      "exp-1",
      DD_DOCUMENTO_ESTADOS.OBSERVADO,
      "El PDF no corresponde",
    );
    expect(repo.guardarObservacionDocumento).toHaveBeenCalledWith(
      "exp-1",
      DD_DOCUMENTOS.DECLARACION_VIGENCIA,
      "El PDF no corresponde",
      session.email,
    );
    expect(repo.actualizarEstado).not.toHaveBeenCalled();
  });

  it("permite solicitar la carga cuando la declaración no existe", async () => {
    const { servicio, repo } = crearServicio(expediente(null));
    await revisar(servicio, DD_ACCIONES_REVISION.OBSERVAR, "Falta la declaración");

    expect(repo.marcarDeclaracionVigencia).not.toHaveBeenCalled();
    expect(repo.guardarObservacionDocumento).toHaveBeenCalledWith(
      "exp-1",
      DD_DOCUMENTOS.DECLARACION_VIGENCIA,
      "Falta la declaración",
      session.email,
    );
    expect(repo.actualizarEstado).not.toHaveBeenCalled();
  });

  it("no permite aprobar una declaración que aún no fue cargada", async () => {
    const { servicio } = crearServicio(expediente(null));
    await expect(revisar(servicio, DD_ACCIONES_REVISION.APROBAR)).rejects.toThrow(
      "aún no está cargada",
    );
  });

  it("no permite aprobar una declaración observada sin nueva versión", async () => {
    const { servicio } = crearServicio(expediente(DD_DOCUMENTO_ESTADOS.OBSERVADO));
    await expect(revisar(servicio, DD_ACCIONES_REVISION.APROBAR)).rejects.toThrow(
      "cargada",
    );
  });
});
