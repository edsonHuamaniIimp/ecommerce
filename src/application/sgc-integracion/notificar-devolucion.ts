import { ALERTA_CLAVES } from "@/lib/shared/alert-templates";
import { ALERTA_TIPOS } from "@/lib/shared/constants";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { getAppUrl } from "@/lib/server/app-url";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";

/**
 * Notifica al **cliente** una devolucion/rechazo del SGC (campana + correo), con paridad a la
 * observacion del area Asociado. Best-effort: un fallo de alerta/correo no revierte nada.
 */
export async function notificarDevolucionSgc(
  solicitudes: ISolicitudesRepository,
  solicitudId: string,
  motivo: string | null,
  documentos: string[],
): Promise<void> {
  try {
    const detalle = await solicitudes.detalle(solicitudId);
    if (!detalle) return;
    const justificacion = motivo?.trim() || "El SGC devolvio el tramite; revisa los documentos observados.";
    const lista = documentos.length > 0 ? documentos : ["Documentos de la solicitud"];

    if (detalle.userId) {
      await solicitudes
        .crearAlertaReserva({
          userId: detalle.userId,
          tipo: ALERTA_TIPOS.DOCUMENTOS_OBSERVADOS,
          clave: ALERTA_CLAVES.DOCUMENTOS_OBSERVADOS,
          datos: { stands: detalle.standCode, total: lista.length, documentos: lista },
          url: `/dashboard/mis-solicitudes?solicitud=${solicitudId}`,
        })
        .catch(() => {});
    }
    if (detalle.email) {
      await enviarEmailPlantilla({
        to: detalle.email,
        plantilla: "documentos-observados",
        idioma: null,
        datos: {
          standCodes: detalle.standCode,
          documentos: lista,
          justificacion,
          url: `${getAppUrl()}/dashboard/mis-solicitudes?solicitud=${solicitudId}`,
        },
      }).catch(() => false);
    }
  } catch {
    /* best-effort: nunca rompe el procesamiento del webhook ni la sincronizacion */
  }
}
