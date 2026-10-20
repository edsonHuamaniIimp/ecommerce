import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type { DdEmpresaEstadoEntity, DdEmpresaResumen, DdExpedienteEntity } from "@/domain/models/debida-diligencia";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import { DD_ESTADOS, DD_RESULTADOS } from "@/lib/shared/constants";

const EMPRESA = {
  id: "emp-1",
  ruc: "20312372895",
  razonSocial: "YURA S.A.",
  nombreComercial: null,
  sitioWeb: null,
  emailContacto: null,
  representanteLegalNombre: null,
  representanteLegalDni: null,
  representanteCorreo: null,
  logoUrl: null,
} satisfies DdEmpresaResumen;

const EXPEDIENTE_BASE = {
  id: "exp-1",
  empresaId: EMPRESA.id,
  eventoId: "evento-1",
  codigo: "DD-2026-0001",
  estado: DD_ESTADOS.RECHAZADA,
  declaraVerdad: true,
  fechaVencimiento: null,
  empresa: EMPRESA,
  documentos: [],
  observaciones: [],
} as unknown as DdExpedienteEntity;

function crearServicio(
  expediente: DdExpedienteEntity | null = null,
  empresaId: string | null = EMPRESA.id,
  estadoExterno: DdEmpresaEstadoEntity | null = null,
) {
  const repo = {
    findExpedientePorEmpresaEvento: vi.fn().mockResolvedValue(expediente),
    findEmpresaResumen: vi.fn().mockResolvedValue(empresaId ? EMPRESA : null),
    findEmpresaEstado: vi.fn().mockResolvedValue(estadoExterno),
  } as unknown as IDebidaDiligenciaRepository;
  const authRepo = {
    findEmpresaIdDeUsuario: vi.fn().mockResolvedValue(empresaId),
  } as unknown as IAuthRepository;
  const servicio = new DebidaDiligenciaApplicationService(
    repo,
    authRepo,
    {} as IDebidaDiligenciaNotificacionPort,
    {} as IDebidaDiligenciaDocumentoValidator,
  );
  return { servicio, repo, authRepo };
}

describe("evaluacionDeUsuario", () => {
  it("bloquea cuando la cuenta no tiene empresa o expediente DD", async () => {
    const { servicio } = crearServicio(null, null);
    const evaluacion = await servicio.evaluacionDeUsuario("sin-empresa@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(false);
    expect(evaluacion.resultado).toBe(DD_RESULTADOS.PENDIENTE);
    expect(evaluacion.mensaje).toContain("no ha pasado por Debida Diligencia");
  });

  it("bloquea y reporta el rechazo de la debida diligencia", async () => {
    const { servicio } = crearServicio(EXPEDIENTE_BASE);
    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(false);
    expect(evaluacion.resultado).toBe(DD_RESULTADOS.NO_APTO);
    expect(evaluacion.mensaje).toContain("fue rechazada");
  });

  it("permite revisar con una DD aprobada y vigente", async () => {
    const aprobada = {
      ...EXPEDIENTE_BASE,
      estado: DD_ESTADOS.APROBADA,
      fechaVencimiento: new Date("2099-01-01"),
    } as DdExpedienteEntity;
    const { servicio } = crearServicio(aprobada);
    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(true);
    expect(evaluacion.resultado).toBe(DD_RESULTADOS.APTO);
    expect(evaluacion.mensaje).toBeNull();
  });

  it("usa el APTO externo/manual como bypass aunque no haya expediente interno", async () => {
    const externo = {
      id: "ext-1",
      documento: EMPRESA.ruc,
      razonSocial: EMPRESA.razonSocial,
      tipoDocumento: "RUC",
      motivoEvaluacion: null,
      eventoProyecto: null,
      resultado: DD_RESULTADOS.APTO,
      estadoOrigen: "APTO",
      fechaIngreso: null,
      fechaRevision: new Date("2026-10-18"),
      fechaVencimiento: new Date("2099-01-01"),
      origen: "manual_apto",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies DdEmpresaEstadoEntity;
    const { servicio } = crearServicio(null, EMPRESA.id, externo);
    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(true);
    expect(evaluacion.resultado).toBe(DD_RESULTADOS.APTO);
    expect(evaluacion.expediente).toBeNull();
  });
});
