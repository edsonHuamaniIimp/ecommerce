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
  DD_MENSAJES,
  PERMISSIONS,
} from "@/lib/shared/constants";

const SIG = {
  email: "sig@iimp.org.pe",
  roles: [],
  permissions: [PERMISSIONS.DD_REVISION],
  eventoId: "evento-1",
};

function expediente(parcial: Partial<DdExpedienteEntity>): DdExpedienteEntity {
  return {
    id: "exp-1",
    empresaId: "emp-1",
    eventoId: "evento-1",
    codigo: "DD-2026-0500",
    estado: DD_ESTADOS.EN_REVISION,
    decisionLegal: null,
    documentos: [],
    reputacion: [],
    empresa: { razonSocial: "ACME S.A.C.", representanteCorreo: null, emailContacto: null },
    ...parcial,
  } as unknown as DdExpedienteEntity;
}

function crearServicio(exp: DdExpedienteEntity) {
  const repo = {
    findExpedientePorId: vi.fn().mockResolvedValue(exp),
    actualizarEstado: vi.fn().mockImplementation(async (_id: string, data: { estado: string }) => ({ ...exp, estado: data.estado })),
    crearObservaciones: vi.fn().mockResolvedValue(undefined),
    registrarAuditoria: vi.fn(),
    registrarHistorial: vi.fn().mockResolvedValue(undefined),
    listarObservaciones: vi.fn().mockResolvedValue([]),
  } as unknown as IDebidaDiligenciaRepository;
  const notificaciones = {
    notificarLegal: vi.fn().mockResolvedValue(undefined),
    notificarDerivadoLegal: vi.fn().mockResolvedValue(undefined),
    notificarObservacion: vi.fn().mockResolvedValue(undefined),
  } as unknown as IDebidaDiligenciaNotificacionPort;
  const servicio = new DebidaDiligenciaApplicationService(
    repo,
    { findEmpresaIdDeUsuario: vi.fn().mockResolvedValue("emp-1") } as unknown as IAuthRepository,
    notificaciones,
    { validarDocumento: vi.fn() } as unknown as IDebidaDiligenciaDocumentoValidator,
  );
  return { servicio, repo };
}

const derivar = {
  expedienteId: "exp-1",
  accion: DD_ACCIONES_REVISION.RECHAZAR,
  motivo: "Requiere debida diligencia reforzada",
  informeLogisticaUrl: "https://drive.google.com/informe",
  documentosObservados: [],
  observaciones: [],
} as never;

describe("revisar - derivar a Legal", () => {
  it("no deriva un expediente que Legal dejo observado esperando al cliente", async () => {
    const { servicio, repo } = crearServicio(
      expediente({ estado: DD_ESTADOS.OBSERVADA, decisionLegal: DD_ACCIONES_LEGAL.OBSERVAR }),
    );
    await expect(servicio.revisar(derivar, SIG)).rejects.toMatchObject({
      message: DD_MENSAJES.LEGAL_OBSERVADA_ESPERA_CLIENTE,
      status: 409,
    });
    expect(repo.actualizarEstado).not.toHaveBeenCalled();
  });

  it("si SIG observo el expediente (sin observacion de Legal) la derivacion sigue permitida", async () => {
    const { servicio, repo } = crearServicio(expediente({ estado: DD_ESTADOS.OBSERVADA, decisionLegal: null }));
    await servicio.revisar(derivar, SIG);
    expect(repo.actualizarEstado).toHaveBeenCalledWith("exp-1", expect.objectContaining({ estado: DD_ESTADOS.EN_LEGAL }));
  });

  it("un expediente en revision se deriva con normalidad", async () => {
    const { servicio, repo } = crearServicio(expediente({ estado: DD_ESTADOS.EN_REVISION }));
    await servicio.revisar(derivar, SIG);
    expect(repo.actualizarEstado).toHaveBeenCalledWith("exp-1", expect.objectContaining({ estado: DD_ESTADOS.EN_LEGAL }));
  });
});

describe("cerrarSinRespuestaDesdeMatriz", () => {
  it("cierra el expediente para que la empresa pueda presentar una nueva DD", async () => {
    const { servicio, repo } = crearServicio(expediente({ estado: DD_ESTADOS.EN_REVISION }));
    await servicio.cerrarSinRespuestaDesdeMatriz("exp-1", SIG);
    expect(repo.actualizarEstado).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({
        estado: DD_ESTADOS.RECHAZADA,
        motivoRechazo: DD_MENSAJES.CIERRE_SIN_RESPUESTA,
        revisadoPor: "sig@iimp.org.pe",
      }),
    );
    expect(repo.registrarHistorial).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ estado: DD_ESTADOS.RECHAZADA, actor: "sig@iimp.org.pe" }),
    );
  });

  it("tambien cierra un expediente observado que el cliente nunca subsano", async () => {
    const { servicio, repo } = crearServicio(expediente({ estado: DD_ESTADOS.OBSERVADA }));
    await servicio.cerrarSinRespuestaDesdeMatriz("exp-1", SIG);
    expect(repo.actualizarEstado).toHaveBeenCalledWith("exp-1", expect.objectContaining({ estado: DD_ESTADOS.RECHAZADA }));
  });

  it("no toca un expediente ya cerrado ni uno aprobado", async () => {
    for (const estado of [DD_ESTADOS.RECHAZADA, DD_ESTADOS.APROBADA]) {
      const { servicio, repo } = crearServicio(expediente({ estado }));
      await servicio.cerrarSinRespuestaDesdeMatriz("exp-1", SIG);
      expect(repo.actualizarEstado).not.toHaveBeenCalled();
    }
  });

  it("falla si el expediente no existe", async () => {
    const { servicio, repo } = crearServicio(expediente({}));
    (repo.findExpedientePorId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(servicio.cerrarSinRespuestaDesdeMatriz("nada", SIG)).rejects.toMatchObject({ status: 404 });
  });
});
