import type { SolicitudRow } from "@/domain/models/entities";
import type { SgcCrearExpedienteInput } from "@/domain/models/sgc";
import { SGC_CODE_PREFIX, SGC_EXPEDIENTE_NAME_PREFIX, SGC_PROCESS_ORIGIN } from "@/lib/shared/constants";

export interface SgcCatalogoExpediente {
  areaCode: string;
  contractTypeCode: string;
}

/**
 * Codigo de negocio del expediente. Una solicitud de un solo stand usa su
 * `standCode`; una de varios stands usa un correlativo derivado del id.
 */
export function construirCodigoExpediente(detalle: SolicitudRow): string {
  const unico = detalle.standCodes[0];
  if (detalle.standCodes.length === 1 && unico) return unico;
  return `${SGC_CODE_PREFIX}-${detalle.id.slice(0, 8)}`;
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
    counterpartyTaxIdentifier: "",
    processOrigin: SGC_PROCESS_ORIGIN,
  };
}
