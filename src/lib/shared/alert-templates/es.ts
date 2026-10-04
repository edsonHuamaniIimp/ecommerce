import { REVISION_AREA_LABELS } from "@/lib/shared/constants";
import type { AlertaClave, AlertaDatosMap, AlertaPlantilla } from "./tipos";

/** Plantillas de alerta en espanol (texto de la campana de notificaciones). */
export const PLANTILLAS_ALERTA_ES: { [K in AlertaClave]: (datos: AlertaDatosMap[K]) => AlertaPlantilla } = {
  "nueva-solicitud-revision": ({ stands }) => ({
    titulo: "Nueva solicitud para revision",
    mensaje: `Se ha creado una nueva solicitud de los stands ${stands}. Eres el primer revisor.`,
  }),
  "solicitud-multiple-cliente": ({ total, stands }) => ({
    titulo: "Solicitud multiple enviada",
    mensaje: `Se ha creado una solicitud multiple con ${total} stands (${stands}). Adjunta los documentos requeridos para continuar.`,
  }),
  "solicitud-multiple-admin": ({ total, stands }) => ({
    titulo: "Nueva solicitud multiple",
    mensaje: `Se ha recibido una solicitud multiple de ${total} stands (${stands}).`,
  }),
  "turno-revision": ({ area, stands }) => {
    const label = REVISION_AREA_LABELS[area as keyof typeof REVISION_AREA_LABELS] ?? area;
    return {
      titulo: `Turno de revision - ${label}`,
      mensaje: `El area de ${label} ya completo su revision de los stands ${stands}. Ahora es tu turno de revisar.`,
    };
  },
  "revision-completada": ({ stands }) => ({
    titulo: "Revision completada - todas las areas",
    mensaje: `Todas las areas han finalizado la revision de los stands ${stands}.`,
  }),
  "contrato-firmado-subido": ({ stands }) => ({
    titulo: "Contrato firmado subido",
    mensaje: `El cliente subio el contrato firmado de la solicitud ${stands}. Revisa los documentos para continuar con el flujo.`,
  }),
};
