import {
  DD_CIERRE_AUTOMATICO,
  DD_CONFIG_CIERRE_ALIAS,
  DD_CONFIG_CIERRE_ESTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MENSAJES,
  type DdMatrizResultadoFinal,
} from "@/lib/shared/constants";
import { resultadoFinalEfectivo } from "@/lib/shared/utils/dd-matriz-evaluacion";

/** Lima no tiene horario de verano: UTC-5 fijo. Los dias habiles se cuentan en hora de Lima. */
const OFFSET_LIMA_MS = -5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

const esHabil = (fechaLima: Date): boolean =>
  (DD_CIERRE_AUTOMATICO.DIAS_HABILES as readonly number[]).includes(fechaLima.getUTCDay());

/** Que hace el cierre automatico segun la opcion de Configuracion DD. */
export type DdAccionCierre =
  | { cierra: false }
  | {
      cierra: true;
      /** Conclusion final que queda en la fila de empresa de la matriz. */
      resultadoFinal: DdMatrizResultadoFinal;
      motivo: string;
      titulo: string;
    };

export const ddCierreAutomaticoUtils = {
  /**
   * Fecha limite: un expediente Observado en esta fecha o antes ya agoto `dias` dias habiles
   * (lunes a viernes, hora de Lima) al momento `ahora`. Con 0 dias devuelve `ahora`.
   */
  limiteObservacion(ahora: Date, dias: number): Date {
    const lima = new Date(ahora.getTime() + OFFSET_LIMA_MS);
    let restantes = Math.max(0, Math.trunc(dias));
    while (restantes > 0) {
      lima.setTime(lima.getTime() - DIA_MS);
      if (esHabil(lima)) restantes -= 1;
    }
    return new Date(lima.getTime() - OFFSET_LIMA_MS);
  },

  /**
   * La conclusion final de la matriz (misma regla que muestra la matriz) es DOCUMENTACIÓN OBSERVADA,
   * la observacion se registro en el sistema (SIG o Legal notificaron al cliente; los importados del
   * Excel no tienen ninguna) y el plazo empezo en `limite` o antes: desde que se registro la
   * conclusion o, si no tiene fecha, desde que se observo el expediente.
   */
  vencidaEnDocumentacionObservada(
    conclusion: {
      resultadoFinal: string | null;
      finalFecha: Date | null;
      estadoExpediente: string;
      fechaRevision: Date | null;
      observacionesRegistradas: number;
    },
    limite: Date,
  ): boolean {
    const efectiva = resultadoFinalEfectivo(conclusion.resultadoFinal, conclusion.estadoExpediente);
    if (efectiva !== DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA) return false;
    if (conclusion.observacionesRegistradas <= 0) return false;
    const inicio = conclusion.finalFecha ?? conclusion.fechaRevision;
    return inicio !== null && inicio.getTime() <= limite.getTime();
  },

  /** Opcion guardada normalizada (acepta los valores previos `rechazada` / `observada`). */
  normalizar(estadoConfigurado: string): string {
    return DD_CONFIG_CIERRE_ALIAS[estadoConfigurado] ?? estadoConfigurado;
  },

  /**
   * Accion para la conclusion final configurada. SIN RESPUESTA y NO APTO cierran el expediente
   * (NO APTO / rechazada) y registran esa conclusion en la matriz; DOCUMENTACIÓN OBSERVADA no cierra.
   */
  accion(estadoConfigurado: string): DdAccionCierre {
    const estado = ddCierreAutomaticoUtils.normalizar(estadoConfigurado);
    if (estado === DD_CONFIG_CIERRE_ESTADOS.SIN_RESPUESTA) {
      return {
        cierra: true,
        resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA,
        motivo: DD_MENSAJES.CIERRE_SIN_RESPUESTA,
        titulo: "Debida diligencia cerrada como SIN RESPUESTA (cierre automático por plazo vencido)",
      };
    }
    if (estado === DD_CONFIG_CIERRE_ESTADOS.NO_APTO) {
      return {
        cierra: true,
        resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.NO_APTO,
        motivo: DD_MENSAJES.CIERRE_PLAZO_VENCIDO,
        titulo: "Debida diligencia cerrada como NO APTO (cierre automático por plazo vencido)",
      };
    }
    return { cierra: false };
  },
};
