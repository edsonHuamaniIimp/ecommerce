import type { AlertaClave, AlertaDatosMap, AlertaPlantilla } from "./tipos";

/** Etiquetas de area en ingles (mismas claves que `REVISION_AREAS`). */
const AREA_LABELS_EN: Record<string, string> = {
  asociado: "Associate",
  legal: "Legal",
};

/** Plantillas de alerta en ingles (campana de notificaciones). */
export const PLANTILLAS_ALERTA_EN: { [K in AlertaClave]: (datos: AlertaDatosMap[K]) => AlertaPlantilla } = {
  "nueva-solicitud-revision": ({ stands }) => ({
    titulo: "New request for review",
    mensaje: `A new request for stands ${stands} has been created. You are the first reviewer.`,
  }),
  "solicitud-multiple-cliente": ({ total, stands }) => ({
    titulo: "Multiple request submitted",
    mensaje: `A multiple request with ${total} stands (${stands}) has been created. Attach the required documents to continue.`,
  }),
  "solicitud-multiple-admin": ({ total, stands }) => ({
    titulo: "New multiple request",
    mensaje: `A multiple request for ${total} stands (${stands}) has been received.`,
  }),
  "turno-revision": ({ area, stands }) => {
    const label = AREA_LABELS_EN[area] ?? area;
    return {
      titulo: `Review turn - ${label}`,
      mensaje: `${label} has completed its review of stands ${stands}. It is now your turn to review.`,
    };
  },
  "revision-completada": ({ stands }) => ({
    titulo: "Review completed - all levels",
    mensaje: `All review levels have completed the review of stands ${stands}.`,
  }),
  "contrato-firmado-subido": ({ stands }) => ({
    titulo: "Signed contract uploaded",
    mensaje: `The client uploaded the signed contract for request ${stands}. Review the documents to continue the process.`,
  }),
};
