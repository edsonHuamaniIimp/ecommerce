import { IDIOMAS, type Idioma } from "@/lib/shared/constants";
import { idiomaODefecto } from "@/lib/shared/utils/idioma";

/** Paso ilustrado del modal post-envio. */
export interface PasoReserva {
  title: string;
  desc: string;
}

/** Textos del flujo de reserva que se muestran dinamicamente (toast / modal post-envio).
 *  El resto de la UI se traduce con Google Translate; estos textos viven en portales
 *  (sonner/Radix) que el widget no traduce de forma fiable. */
export interface TextosReserva {
  toastTitulo: string;
  toastDescripcion: string;
  modalTitulo: string;
  modalOk: string;
  modalPasos: string;
  pasos: [PasoReserva, PasoReserva, PasoReserva, PasoReserva, PasoReserva];
  monitoreo: { antes: string; resaltado: string; despues: string };
  modalBoton: string;
}

const TEXTOS_RESERVA: Record<Idioma, TextosReserva> = {
  [IDIOMAS.ES]: {
    toastTitulo: "Reserva enviada correctamente",
    toastDescripcion: "Recibiras un correo de confirmacion. El stand pasa a estado En evaluacion.",
    modalTitulo: "Solicitud multiple enviada",
    modalOk: "Tu solicitud ha sido registrada con exito",
    modalPasos: "Sigue estos pasos para completar el proceso:",
    pasos: [
      { title: "Solicitud creada", desc: "El administrador del IIMP ha sido notificado y revisara tu solicitud multiple." },
      { title: "El admin sube el contrato", desc: "El administrador adjuntara el contrato oficial. Recibiras un correo cuando este listo para que puedas continuar." },
      { title: "Adjunta tus documentos", desc: "Ingresa a Mis solicitudes en el dashboard y adjunta los documentos requeridos para tu solicitud." },
      { title: "Revision por areas", desc: "Dos niveles de revision (Asociado y Legal) revisaran tu documentacion y emitiran su veredicto." },
      { title: "Resultado final", desc: "Recibiras un correo con el resultado. Si es rechazada, podras solicitar una re-evaluacion." },
    ],
    monitoreo: { antes: "Monitorea el estado en ", resaltado: "Mis solicitudes", despues: " desde el menu lateral del dashboard." },
    modalBoton: "Entendido",
  },
  [IDIOMAS.EN]: {
    toastTitulo: "Request submitted successfully",
    toastDescripcion: "You will receive a confirmation email. The stand moves to Under review status.",
    modalTitulo: "Multiple request submitted",
    modalOk: "Your request has been successfully registered",
    modalPasos: "Follow these steps to complete the process:",
    pasos: [
      { title: "Request created", desc: "The IIMP administrator has been notified and will review your multiple request." },
      { title: "The admin uploads the contract", desc: "The administrator will attach the official contract. You will receive an email when it is ready for you to continue." },
      { title: "Attach your documents", desc: "Go to My requests in the dashboard and attach the documents required for your request." },
      { title: "Review by levels", desc: "Two review levels (Associate and Legal) will review your documentation and issue their decision." },
      { title: "Final result", desc: "You will receive an email with the result. If rejected, you can request a re-evaluation." },
    ],
    monitoreo: { antes: "Track the status in ", resaltado: "My requests", despues: " from the dashboard side menu." },
    modalBoton: "Got it",
  },
};

/** Textos del flujo de reserva segun el idioma (fallback español). */
export function textosReserva(idioma: string | null | undefined): TextosReserva {
  return TEXTOS_RESERVA[idiomaODefecto(idioma)];
}
