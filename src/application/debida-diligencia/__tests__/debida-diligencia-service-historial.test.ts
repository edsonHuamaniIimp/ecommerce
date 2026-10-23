import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type { DdExpedienteEntity, DdHistorialEventoEntity } from "@/domain/models/debida-diligencia";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import {
  DD_ESTADOS,
  DD_HISTORIAL_TIPOS,
  PERMISSIONS,
} from "@/lib/shared/constants";

const EXPEDIENTE = {
  id: "exp-1",
  empresaId: "emp-1",
  codigo: "DD-2026-0001",
  estado: DD_ESTADOS.APROBADA,
  decisionLegal: null,
  creadoPor: "cliente@empresa.pe",
  revisadoPor: "logistica@iimp.org.pe",
  derivadoLegalPor: null,
  legalRevisor: null,
  fechaEnvio: new Date("2026-01-10T10:00:00Z"),
  fechaDerivacionLegal: null,
  fechaLegal: null,
  fechaAprobacion: new Date("2026-01-20T10:00:00Z"),
  fechaRechazo: null,
  motivoLegal: null,
  motivoRechazo: null,
} as unknown as DdExpedienteEntity;

function crearServicio(eventos: DdHistorialEventoEntity[] = []) {
  const repo = {
    findExpedientePorId: vi.fn().mockResolvedValue(EXPEDIENTE),
    listarHistorial: vi.fn().mockResolvedValue(eventos),
    listarObservaciones: vi.fn().mockResolvedValue([]),
  } as unknown as IDebidaDiligenciaRepository;
  return {
    repo,
    servicio: new DebidaDiligenciaApplicationService(
      repo,
      {} as IAuthRepository,
      {} as IDebidaDiligenciaNotificacionPort,
      {} as IDebidaDiligenciaDocumentoValidator,
    ),
  };
}

const session = {
  email: "logistica@iimp.org.pe",
  roles: [],
  permissions: [PERMISSIONS.DD_VER],
};

describe("historial", () => {
  it("devuelve los eventos persistidos y las observaciones", async () => {
    const evento: DdHistorialEventoEntity = {
      id: "evento-1",
      tipo: DD_HISTORIAL_TIPOS.APROBACION,
      area: null,
      estado: DD_ESTADOS.APROBADA,
      titulo: "Debida diligencia aprobada",
      detalle: null,
      actor: "logistica@iimp.org.pe",
      metadata: null,
      createdAt: new Date("2026-02-01T10:00:00Z"),
    };
    const { servicio } = crearServicio([evento]);

    const resultado = await servicio.historial("exp-1", session);

    expect(resultado.eventos).toEqual([evento]);
    expect(resultado.observaciones).toEqual([]);
  });

  it("reconstruye hitos cuando el expediente es anterior al historial", async () => {
    const { servicio } = crearServicio([]);

    const resultado = await servicio.historial("exp-1", session);

    expect(resultado.eventos.map((evento) => evento.tipo)).toEqual([
      DD_HISTORIAL_TIPOS.ENVIO,
      DD_HISTORIAL_TIPOS.APROBACION,
    ]);
    expect(resultado.eventos.every((evento) => evento.metadata?.historico === true)).toBe(true);
  });
});
