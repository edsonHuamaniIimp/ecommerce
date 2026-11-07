import {
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_PORCENTAJE_PARTICIPACION_MIN,
  DD_VIGENCIA_MESES,
  DD_VINCULOS_PERSONA_CON_PORCENTAJE,
  type DdTipoVinculoPersona,
} from "@/lib/shared/constants";

/**
 * Indica si el rol de la persona vinculada exige porcentaje de participación.
 * Solo beneficiario final y socio/accionista (10% o más) lo exigen.
 */
export function requierePorcentajeParticipacion(tipoVinculoPersona?: string | null): boolean {
  if (!tipoVinculoPersona) return false;
  return DD_VINCULOS_PERSONA_CON_PORCENTAJE.includes(tipoVinculoPersona as DdTipoVinculoPersona);
}

/**
 * Valida el porcentaje de participación según el rol:
 * - Roles con porcentaje: obligatorio y mayor o igual a DD_PORCENTAJE_PARTICIPACION_MIN.
 * - Otros roles: opcional; si viene, debe estar entre 0 y 100.
 */
export function porcentajeParticipacionValido(
  tipoVinculoPersona: string | null | undefined,
  porcentaje: number | null | undefined
): boolean {
  const requerido = requierePorcentajeParticipacion(tipoVinculoPersona);
  if (porcentaje === null || porcentaje === undefined || Number.isNaN(porcentaje)) {
    return !requerido;
  }
  if (porcentaje < 0 || porcentaje > 100) return false;
  return requerido ? porcentaje >= DD_PORCENTAJE_PARTICIPACION_MIN : true;
}

/**
 * Calcula la fecha de vigencia de una DD desde la decisión final de la relación
 * comercial (6 meses por defecto según el alcance V2).
 * Opera en UTC y ajusta el día al último del mes destino (ej. 31/01 + 1 mes = 28/02).
 */
export function calcularVigenciaHasta(
  fechaDecision: Date,
  meses: number = DD_VIGENCIA_MESES
): Date {
  const fecha = new Date(fechaDecision.getTime());
  const dia = fecha.getUTCDate();

  fecha.setUTCDate(1);
  fecha.setUTCMonth(fecha.getUTCMonth() + meses);

  const ultimoDiaMes = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0)
  ).getUTCDate();

  fecha.setUTCDate(Math.min(dia, ultimoDiaMes));
  return fecha;
}

/**
 * Una empresa queda bloqueada si alguna de sus relaciones comerciales terminó
 * como NO APTO (regla de bloqueo global del alcance V2).
 */
export function empresaBloqueadaPorRelaciones(
  resultados: ReadonlyArray<string | null | undefined>
): boolean {
  return resultados.some((resultado) => resultado === DD_MATRIZ_RESULTADOS_FINALES.NO_APTO);
}

/**
 * Resultado consolidado de la empresa a partir de sus relaciones comerciales.
 * Prioridad: NO APTO > EN REVISIÓN > DOCUMENTACIÓN OBSERVADA >
 * APTO CON OBSERVACIONES > APTO. Sin resultados devuelve null.
 */
export function calcularResultadoEmpresa(
  resultados: ReadonlyArray<string | null | undefined>
): string | null {
  const valores = resultados.filter((resultado): resultado is string => Boolean(resultado));
  if (valores.length === 0) return null;

  const prioridad = [
    DD_MATRIZ_RESULTADOS_FINALES.NO_APTO,
    DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION,
    DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA,
    DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES,
    DD_MATRIZ_RESULTADOS_FINALES.APTO,
  ];

  for (const estado of prioridad) {
    if (valores.includes(estado)) return estado;
  }
  return null;
}
