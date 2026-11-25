import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import { CONFIG_DEFAULT } from "../dd-configuracion-service";
import type { DdExpedienteEntity } from "@/domain/models/debida-diligencia";
import type { DdConfiguracionEntity } from "@/domain/models/dd-configuracion";
import type {
  DdConclusionMatrizCierre,
  IDebidaDiligenciaRepository,
} from "@/domain/ports/debida-diligencia-repository";
import type { IDdConfiguracionRepository } from "@/domain/ports/dd-configuracion-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import {
  DD_CIERRE_AUTOMATICO,
  DD_CONFIG_CIERRE_ESTADOS,
  DD_ESTADOS,
  DD_HISTORIAL_TIPOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MENSAJES,
} from "@/lib/shared/constants";

/** Miercoles 25/11/2026 06:00 Lima. Con 3 dias habiles, el limite es el viernes 20/11 06:00 Lima. */
const AHORA = new Date("2026-11-25T06:00:00-05:00");
const LIMITE = new Date("2026-11-20T06:00:00-05:00");
const ANTES = new Date("2026-11-10T10:00:00-05:00");
const RECIENTE = new Date("2026-11-24T10:00:00-05:00");

/**
 * Fila de empresa de la matriz; por defecto: sin conclusion guardada, expediente Observado
 * (=> DOCUMENTACIÓN OBSERVADA) y observado dentro del sistema.
 */
const conclusion = (expedienteId: string, parcial: Partial<DdConclusionMatrizCierre> = {}): DdConclusionMatrizCierre => ({
  expedienteId,
  resultadoFinal: null,
  finalFecha: null,
  estadoExpediente: DD_ESTADOS.OBSERVADA,
  fechaRevision: ANTES,
  observacionesRegistradas: 1,
  ...parcial,
});

function montar(
  reglas: Partial<DdConfiguracionEntity>,
  filas: DdConclusionMatrizCierre[],
  relectura?: Record<string, DdConclusionMatrizCierre>,
) {
  const repo = {
    listarConclusionesMatrizCierre: vi.fn(async (params: { expedienteIds?: string[] }) => {
      if (!params.expedienteIds) return filas;
      return params.expedienteIds
        .map((id) => relectura?.[id] ?? filas.find((f) => f.expedienteId === id))
        .filter((f): f is DdConclusionMatrizCierre => Boolean(f));
    }),
    actualizarEstado: vi.fn(async (id: string) => ({ id, estado: DD_ESTADOS.RECHAZADA }) as unknown as DdExpedienteEntity),
    registrarHistorial: vi.fn().mockResolvedValue(undefined),
    registrarResultadoFinalMatriz: vi.fn().mockResolvedValue(undefined),
  };
  const configuracion: Pick<IDdConfiguracionRepository, "obtener"> = {
    obtener: vi.fn().mockResolvedValue({ ...CONFIG_DEFAULT, plazoDiasHabiles: 3, ...reglas }),
  };
  const servicio = new DebidaDiligenciaApplicationService(
    repo as unknown as IDebidaDiligenciaRepository,
    {} as IAuthRepository,
    {} as IDebidaDiligenciaNotificacionPort,
    {} as IDebidaDiligenciaDocumentoValidator,
    configuracion as IDdConfiguracionRepository,
  );
  return { servicio, repo };
}

const SIN_RESPUESTA = { estadoCierreAutomatico: DD_CONFIG_CIERRE_ESTADOS.SIN_RESPUESTA };

describe("DebidaDiligenciaApplicationService.cerrarObservadasVencidas", () => {
  it("SIN RESPUESTA: registra SIN RESPUESTA en la matriz y cierra el expediente del cliente", async () => {
    const { servicio, repo } = montar(SIN_RESPUESTA, [conclusion("exp-1")]);
    const r = await servicio.cerrarObservadasVencidas({ ahora: AHORA });

    expect(repo.listarConclusionesMatrizCierre).toHaveBeenCalledWith({ limite: LIMITE, max: DD_CIERRE_AUTOMATICO.LOTE_MAX });
    expect(repo.registrarResultadoFinalMatriz).toHaveBeenCalledWith("exp-1", expect.objectContaining({
      resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA,
      actor: DD_CIERRE_AUTOMATICO.ACTOR,
    }));
    expect(repo.actualizarEstado).toHaveBeenCalledWith("exp-1", expect.objectContaining({
      estado: DD_ESTADOS.RECHAZADA,
      motivoRechazo: DD_MENSAJES.CIERRE_SIN_RESPUESTA,
      revisadoPor: DD_CIERRE_AUTOMATICO.ACTOR,
    }));
    expect(repo.registrarHistorial).toHaveBeenCalledWith("exp-1", expect.objectContaining({
      tipo: DD_HISTORIAL_TIPOS.RECHAZO,
      estado: DD_ESTADOS.RECHAZADA,
    }));
    expect(r).toMatchObject({ candidatos: 1, cerrados: ["exp-1"], errores: 0, simulado: false });
  });

  it("NO APTO: registra NO APTO en la matriz con el motivo de plazo vencido", async () => {
    const { servicio, repo } = montar({ estadoCierreAutomatico: DD_CONFIG_CIERRE_ESTADOS.NO_APTO }, [conclusion("exp-1")]);
    await servicio.cerrarObservadasVencidas({ ahora: AHORA });
    expect(repo.registrarResultadoFinalMatriz).toHaveBeenCalledWith("exp-1", expect.objectContaining({
      resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.NO_APTO,
    }));
    expect(repo.actualizarEstado).toHaveBeenCalledWith("exp-1", expect.objectContaining({
      motivoRechazo: DD_MENSAJES.CIERRE_PLAZO_VENCIDO,
    }));
  });

  it("decide por la conclusion de la matriz: solo DOCUMENTACIÓN OBSERVADA con el plazo vencido", async () => {
    const filas = [
      /* Guardada en la matriz: el plazo cuenta desde que se registro. */
      conclusion("guardada", { resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA, finalFecha: ANTES }),
      /* Guardada hace poco: aun dentro del plazo. */
      conclusion("reciente", { resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA, finalFecha: RECIENTE }),
      /* Expediente Observado pero SIG registro otra conclusion en la matriz. */
      conclusion("otra", { resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION }),
      /* Sin conclusion guardada y expediente en revision => la matriz muestra EN REVISIÓN. */
      conclusion("en-revision", { estadoExpediente: DD_ESTADOS.EN_REVISION }),
    ];
    const { servicio } = montar(SIN_RESPUESTA, filas);
    const r = await servicio.cerrarObservadasVencidas({ ahora: AHORA });
    expect(r.cerrados).toEqual(["guardada"]);
  });

  it("no cierra un importado del Excel en DOCUMENTACIÓN OBSERVADA sin observaciones en el sistema", async () => {
    const filas = [
      conclusion("importado", { observacionesRegistradas: 0 }),
      conclusion("observado-en-sistema"),
    ];
    const { servicio, repo } = montar(SIN_RESPUESTA, filas);
    const r = await servicio.cerrarObservadasVencidas({ ahora: AHORA });
    expect(r.cerrados).toEqual(["observado-en-sistema"]);
    expect(repo.actualizarEstado).not.toHaveBeenCalledWith("importado", expect.anything());
    expect(repo.registrarResultadoFinalMatriz).not.toHaveBeenCalledWith("importado", expect.anything());
  });

  it("DOCUMENTACIÓN OBSERVADA configurada: no consulta ni cierra nada", async () => {
    const { servicio, repo } = montar({ estadoCierreAutomatico: DD_CONFIG_CIERRE_ESTADOS.DOCUMENTACION_OBSERVADA }, [conclusion("exp-1")]);
    const r = await servicio.cerrarObservadasVencidas({ ahora: AHORA });
    expect(repo.listarConclusionesMatrizCierre).not.toHaveBeenCalled();
    expect(r.cerrados).toEqual([]);
  });

  it("si el cliente subsano antes del cierre (la matriz vuelve a EN REVISIÓN) no se cierra; al simular no cambia nada", async () => {
    const filas = [conclusion("exp-1"), conclusion("exp-2")];
    const subsanado = { "exp-2": conclusion("exp-2", { estadoExpediente: DD_ESTADOS.EN_REVISION }) };
    const { servicio, repo } = montar(SIN_RESPUESTA, filas, subsanado);
    const r = await servicio.cerrarObservadasVencidas({ ahora: AHORA, simular: true });
    expect(r).toMatchObject({ candidatos: 2, cerrados: ["exp-1"], simulado: true });
    expect(repo.actualizarEstado).not.toHaveBeenCalled();
    expect(repo.registrarResultadoFinalMatriz).not.toHaveBeenCalled();
    expect(repo.registrarHistorial).not.toHaveBeenCalled();
  });

  it("un error en un expediente no corta la corrida", async () => {
    const { servicio, repo } = montar(SIN_RESPUESTA, [conclusion("exp-1"), conclusion("exp-2")]);
    repo.actualizarEstado.mockRejectedValueOnce(new Error("bd caida"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await servicio.cerrarObservadasVencidas({ ahora: AHORA });
    expect(r).toMatchObject({ cerrados: ["exp-2"], errores: 1 });
  });
});
