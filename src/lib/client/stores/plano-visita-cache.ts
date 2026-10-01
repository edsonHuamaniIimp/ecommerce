import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PlanoPublicoPayloadDTO } from "@/types/dto/planos/planos-response.dto";

export interface VisitaEvento {
  eventoId: string;
  tipoEvento: number;
  codigoEvento: number;
}

export interface EstadoFondoCache {
  listo: boolean;
  error: boolean;
  /** Relacion de aspecto ancho/alto del fondo (para reservar el alto al volver al macro). */
  anchoAlto?: number;
}

const visita = new Map<"evento", VisitaEvento>();
const payloads = new Map<string, PlanoPublicoPayloadDTO>();
const fondos = new Map<string, EstadoFondoCache>();
const documentosPdf = new Map<string, Promise<PDFDocumentProxy>>();

/**
 * Cache de sesion (en memoria) para la visita del plano:
 * - sobrevive la navegacion SPA entre /mapa (macro) y pabellones (3D),
 * - se limpia con una recarga completa de la pagina.
 * Evita volver a mostrar skeletons cuando el usuario regresa al macro.
 */
export const planoVisitaCache = {
  eventoObtener(): VisitaEvento | undefined {
    return visita.get("evento");
  },
  eventoMarcar(datos: VisitaEvento) {
    visita.set("evento", datos);
  },

  payloadObtener(clave: string): PlanoPublicoPayloadDTO | undefined {
    return payloads.get(clave);
  },
  payloadMarcar(clave: string, data: PlanoPublicoPayloadDTO) {
    payloads.set(clave, data);
  },

  fondoObtener(url: string): EstadoFondoCache | undefined {
    return fondos.get(url);
  },
  fondoMarcar(url: string, estado: EstadoFondoCache) {
    fondos.set(url, estado);
  },

  pdfObtener(url: string): Promise<PDFDocumentProxy> | undefined {
    return documentosPdf.get(url);
  },
  pdfMarcar(url: string, promesa: Promise<PDFDocumentProxy>) {
    documentosPdf.set(url, promesa);
  },
};
