import { TIPOS_CONTRATO, TIPOS_CONTRATO_VALORES, TIPOS_SOLICITUD, type TipoContrato } from "@/lib/shared/constants";

/** Indica si un valor persistido es una plantilla de contrato conocida. */
export function esTipoContrato(valor: unknown): valor is TipoContrato {
  return typeof valor === "string" && (TIPOS_CONTRATO_VALORES as string[]).includes(valor);
}

/**
 * Plantilla de contrato efectiva de una solicitud. Prioriza lo persistido; si la
 * solicitud es anterior a la columna `tipo_contrato`, se deduce del tipo de solicitud
 * (la reserva administrativa siempre uso el contrato del Operador Internacional).
 */
export function resolverTipoContrato(
  tipoContrato: string | null | undefined,
  tipoSolicitud: string | null | undefined,
): TipoContrato {
  if (esTipoContrato(tipoContrato)) return tipoContrato;
  return tipoSolicitud === TIPOS_SOLICITUD.RESERVA_EMPRESA
    ? TIPOS_CONTRATO.OPERADOR_INTERNACIONAL
    : TIPOS_CONTRATO.ESTANDAR;
}
