import type { SolicitudRow } from "@/domain/models/entities";
import type { SgcCrearExpedienteInput } from "@/domain/models/sgc";
import { SGC_CODE_PREFIX, SGC_EXPEDIENTE_NAME_PREFIX, SGC_PROCESS_ORIGIN } from "@/lib/shared/constants";

export interface SgcCatalogoExpediente {
  areaCode: string;
  contractTypeCode: string;
}

/**
 * Codigo de negocio del expediente (guia v5): identifica al **expediente completo**,
 * debe ser **globalmente unico** en el SGC, de 3-40 caracteres, empezar con letra o
 * numero y admitir letras, numeros, punto, barra, guion y guion bajo (se normaliza a
 * mayusculas). Formato: `STAND-<codigo de stand>-<id8 de la solicitud>`; el id garantiza
 * la unicidad global (una reserva multiple usa solo `STAND-<id8>`).
 */
export function construirCodigoExpediente(detalle: SolicitudRow): string {
  const sufijo = detalle.id.slice(0, 8).toUpperCase();
  const normalizar = (valor: string) =>
    valor
      .toUpperCase()
      .replace(/[^A-Z0-9._/-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");
  const unico = detalle.standCodes[0];
  const base =
    detalle.standCodes.length === 1 && unico
      ? `${SGC_CODE_PREFIX}-${normalizar(unico)}`
      : SGC_CODE_PREFIX;
  const maxBase = 40 - sufijo.length - 1;
  return `${base.slice(0, maxBase)}-${sufijo}`;
}

/** Mapea una solicitud local al cuerpo de creacion de expediente del SGC. */
export function mapSolicitudToExpediente(
  detalle: SolicitudRow,
  catalogo: SgcCatalogoExpediente,
): SgcCrearExpedienteInput {
  return {
    code: construirCodigoExpediente(detalle),
    areaCode: catalogo.areaCode,
    contractTypeCode: catalogo.contractTypeCode,
    name: `${SGC_EXPEDIENTE_NAME_PREFIX} - ${detalle.standCodes.join(", ")}`,
    counterpartyLegalName: detalle.empresa ?? detalle.standCode,
    counterpartyEmail: detalle.email ?? "",
    counterpartyTaxIdentifier: "",
    processOrigin: SGC_PROCESS_ORIGIN,
  };
}
