import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import {
  DD_DOCUMENTOS,
  DD_ESTADOS,
  DD_HISTORIAL_TIPOS,
  DD_OBSERVACION_AREAS,
  DD_OBSERVACION_ESTADOS,
  PERMISSIONS,
} from "@/lib/shared/constants";

const SESION = {
  email: "logistica@iimp.org.pe",
  roles: [],
  permissions: [PERMISSIONS.DD_REVISION],
  eventoId: "evento-1",
};

function crearServicio(estado = DD_ESTADOS.APROBADA) {
  const expediente = {
    id: "exp-1",
    codigo: "DD-2026-0001",
    estado,
    emailRepresentante: "cliente@ejemplo.pe",
    empresa: {
      razonSocial: "EMPRESA UNO",
      representanteCorreo: null,
      emailContacto: null,
    },
  };
  const actualizado = { ...expediente, estado: DD_ESTADOS.OBSERVADA };
  const repo = {
    findExpedientePorId: vi.fn().mockResolvedValue(expediente),
    crearObservaciones: vi.fn().mockResolvedValue(undefined),
    resolverDocumentos: vi.fn().mockResolvedValue(undefined),
    actualizarEstado: vi.fn().mockResolvedValue(actualizado),
    listarObservaciones: vi.fn().mockResolvedValue([
      { texto: "Actualiza la ficha RUC.", estado: DD_OBSERVACION_ESTADOS.ABIERTA },
    ]),
    registrarHistorial: vi.fn().mockResolvedValue(undefined),
    registrarAuditoria: vi.fn().mockResolvedValue(undefined),
  } as unknown as IDebidaDiligenciaRepository;
  const notificaciones = {
    expedienteObservado: vi.fn().mockResolvedValue(undefined),
  } as unknown as IDebidaDiligenciaNotificacionPort;
  const servicio = new DebidaDiligenciaApplicationService(
    repo,
    {} as IAuthRepository,
    notificaciones,
    {} as IDebidaDiligenciaDocumentoValidator,
  );
  return { servicio, repo, notificaciones };
}

describe("observarDocumentacionFinal", () => {
  it("pasa un expediente APROBADA a OBSERVADA y notifica al cliente", async () => {
    const { servicio, repo, notificaciones } = crearServicio();

    await servicio.observarDocumentacionFinal(
      {
        expedienteId: "exp-1",
        motivo: "Actualiza la ficha RUC.",
        documentosObservados: [DD_DOCUMENTOS.FICHA_RUC],
      },
      SESION,
    );

    expect(repo.crearObservaciones).toHaveBeenCalledWith(
      "exp-1",
      [
        expect.objectContaining({
          area: DD_OBSERVACION_AREAS.LOGISTICA,
          documentoTipo: DD_DOCUMENTOS.FICHA_RUC,
          texto: "Actualiza la ficha RUC.",
        }),
      ],
      SESION.email,
    );
    expect(repo.resolverDocumentos).toHaveBeenCalledWith(
      "exp-1",
      [DD_DOCUMENTOS.FICHA_RUC],
      "Actualiza la ficha RUC.",
    );
    expect(repo.actualizarEstado).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ estado: DD_ESTADOS.OBSERVADA }),
    );
    expect(notificaciones.expedienteObservado).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "cliente@ejemplo.pe",
        observaciones: ["Actualiza la ficha RUC."],
      }),
    );
    expect(repo.registrarHistorial).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({
        tipo: DD_HISTORIAL_TIPOS.OBSERVACION,
        titulo: "Documentación observada",
      }),
    );
  });

  it("exige comentario o documento observado", async () => {
    const { servicio } = crearServicio();

    await expect(
      servicio.observarDocumentacionFinal(
        { expedienteId: "exp-1", motivo: null, documentosObservados: [] },
        SESION,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
