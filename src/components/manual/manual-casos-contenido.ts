import { MANUAL_CASOS, type ManualCaso } from "@/lib/shared/constants";

/** Paso de un manual contextual; la imagen es opcional (capturas en /manual/casos). */
export interface PasoManual {
  texto: string;
  imagen?: string;
  alt?: string;
}

export interface ManualCasoContenido {
  caso: ManualCaso;
  titulo: string;
  /** Quien observo o a quien corresponde la accion (se muestra como etiqueta). */
  origen: string;
  resumen: string;
  pasos: PasoManual[];
  importante: string[];
  /** Manual completo relacionado (paginas publicas /manual/...). */
  manualCompleto?: { href: string; label: string };
}

const IMG = "/manual/casos";

/**
 * Manuales por caso de "Mis reservas". Las capturas se generan con
 * `scripts/capturas-manual-casos.mjs` (datos de demostracion, sin datos de clientes).
 */
export const MANUALES_POR_CASO: Record<ManualCaso, ManualCasoContenido> = {
  [MANUAL_CASOS.FIRMAR_CONTRATO]: {
    caso: MANUAL_CASOS.FIRMAR_CONTRATO,
    titulo: "Firmar tu contrato",
    origen: "IIMP",
    resumen: "El IIMP habilitó la firma de tu contrato. La firma es digital: no se sube un PDF firmado a mano.",
    pasos: [
      { texto: "En tu solicitud, pulsa Firmar contrato.", imagen: `${IMG}/firmar-contrato-1.png`, alt: "Botón Firmar contrato en la tarjeta" },
      { texto: "Revisa el contrato, confirma las firmas de tus representantes y firma digitalmente.", imagen: `${IMG}/firmar-contrato-2.png`, alt: "Ventana de firma del contrato" },
    ],
    importante: [
      "Si un representante no tiene firma registrada, súbela en tu Perfil o captúrala en la vista de firma.",
      "Firma solo la última versión del contrato que aparece en la ventana.",
    ],
    manualCompleto: { href: "/manual", label: "Manual de reserva de stands" },
  },
  [MANUAL_CASOS.ASOCIADO_DOCUMENTOS]: {
    caso: MANUAL_CASOS.ASOCIADO_DOCUMENTOS,
    titulo: "El Asociado observó tus documentos",
    origen: "Asociado",
    resumen: "El área revisora (Asociado) encontró un problema en uno o más documentos. Debes subir una versión nueva y reenviar.",
    pasos: [
      { texto: "Lee el motivo en Acción requerida y pulsa Subir / reemplazar documentos.", imagen: `${IMG}/asociado-documentos-1.png`, alt: "Tarjeta con documentos observados por el Asociado" },
      { texto: "En la fila observada pulsa Adjuntar, elige el archivo corregido y luego Enviar documentos.", imagen: `${IMG}/asociado-documentos-2.png`, alt: "Ventana con el documento observado" },
      { texto: "Cuando todo esté corregido, pulsa Reenviar a revisión.", imagen: `${IMG}/asociado-documentos-3.png`, alt: "Botón Reenviar a revisión" },
    ],
    importante: [
      "Reemplaza el documento en su misma fila; no lo subas como «otro documento».",
      "La solicitud vuelve a la revisión del Asociado al reenviarla.",
    ],
  },
  [MANUAL_CASOS.ASOCIADO_CONTRATO]: {
    caso: MANUAL_CASOS.ASOCIADO_CONTRATO,
    titulo: "El Asociado observó tu contrato firmado",
    origen: "Asociado",
    resumen: "La firma del contrato fue observada. El IIMP prepara una versión corregida y tú la vuelves a firmar.",
    pasos: [
      { texto: "Si ves Esperando contrato corregido, el IIMP aún está preparando la nueva versión. Vuelve más tarde.", imagen: `${IMG}/asociado-contrato-1.png`, alt: "Tarjeta esperando contrato corregido" },
      { texto: "Cuando aparezca Firmar contrato corregido, púlsalo y firma digitalmente la nueva versión. Luego pulsa Reenviar a revisión." },
    ],
    importante: ["La firma anterior ya no cuenta: hay que firmar la versión corregida."],
  },
  [MANUAL_CASOS.SGC_DOCUMENTOS]: {
    caso: MANUAL_CASOS.SGC_DOCUMENTOS,
    titulo: "El área legal observó un documento",
    origen: "Área legal",
    resumen: "El área legal pidió corregir un documento o agregar uno que falta. Solo se envía lo que corrijas.",
    pasos: [
      { texto: "Lee qué documento observó el área legal y pulsa Subir / reemplazar documentos.", imagen: `${IMG}/sgc-documentos-1.png`, alt: "Tarjeta con observación del área legal" },
      { texto: "En la fila marcada en rojo pulsa Adjuntar o Reemplazar, elige el archivo y pulsa Enviar documentos.", imagen: `${IMG}/sgc-documentos-2.png`, alt: "Ventana con el documento observado por el área legal" },
      { texto: "Cuando todo esté corregido, pulsa Solicitar nueva revisión." },
    ],
    importante: [
      "Usa la fila del documento observado: un archivo subido como «otro documento» no corrige la observación.",
      "Formatos: Ficha RUC y Vigencia de Poder en PDF; DNI en PDF, PNG o JPG.",
    ],
    manualCompleto: { href: "/manual/subsanacion", label: "Manual de subsanación (área legal)" },
  },
  [MANUAL_CASOS.SGC_GRUPO]: {
    caso: MANUAL_CASOS.SGC_GRUPO,
    titulo: "El área legal pidió varios documentos",
    origen: "Área legal",
    resumen: "El área legal pidió un grupo de documentos (por ejemplo, vigencia y DNI de cada representante). Cada uno tiene su propia fila.",
    pasos: [
      { texto: "Abre Subir / reemplazar documentos. Verás una fila por cada documento pedido.", imagen: `${IMG}/sgc-grupo-1.png`, alt: "Grupo de documentos con una fila por documento" },
      { texto: "Pulsa Adjuntar en cada fila y sube un solo archivo por fila. Las filas ya cargadas dicen Adjuntado." },
      { texto: "Cuando todas las filas estén completas, pulsa Enviar documentos y luego Solicitar nueva revisión." },
    ],
    importante: [
      "No selecciones varios archivos a la vez: sube uno por fila, en la fila que corresponde.",
      "El botón para enviar se habilita solo cuando todas las filas tienen su archivo.",
    ],
    manualCompleto: { href: "/manual/subsanacion", label: "Manual de subsanación (área legal)" },
  },
  [MANUAL_CASOS.SGC_CONTRATO]: {
    caso: MANUAL_CASOS.SGC_CONTRATO,
    titulo: "El área legal observó el contrato",
    origen: "Área legal",
    resumen: "Hay que firmar una versión nueva del contrato. El sistema la prepara automáticamente.",
    pasos: [
      { texto: "Primero verás el botón verde Subsanar observación. Si al abrirlo dice Preparando contrato corregido, cierra la ventana y vuelve en unos minutos: aún no se puede firmar.", imagen: `${IMG}/sgc-contrato-1.png`, alt: "Botón verde Subsanar observación" },
      { texto: "Mientras se prepara, la ventana no permite firmar.", imagen: `${IMG}/sgc-contrato-2.png`, alt: "Ventana preparando el contrato corregido" },
      { texto: "Cuando el contrato esté listo aparece el botón azul Firmar contrato corregido. Púlsalo y firma digitalmente.", imagen: `${IMG}/sgc-contrato-3.png`, alt: "Botón azul Firmar contrato corregido" },
      { texto: "Después de firmar, pulsa Solicitar nueva revisión." },
    ],
    importante: [
      "Si la ventana sigue en Preparando contrato corregido por más de una hora, comunícate con el IIMP.",
      "Tu firma anterior no cuenta: el área legal necesita la versión nueva firmada.",
    ],
    manualCompleto: { href: "/manual/subsanacion", label: "Manual de subsanación (área legal)" },
  },
  [MANUAL_CASOS.SGC_SIN_DETALLE]: {
    caso: MANUAL_CASOS.SGC_SIN_DETALLE,
    titulo: "El área legal devolvió el trámite sin marcar documentos",
    origen: "Área legal",
    resumen: "El área legal devolvió el trámite con un comentario, sin marcar documentos en el sistema. Debes subir lo que te pidió y volver a firmar el contrato.",
    pasos: [
      { texto: "Confirma con el IIMP qué documento te pidieron (por ejemplo, la Vigencia de Poder actualizada).", imagen: `${IMG}/sgc-sin-detalle-1.png`, alt: "Tarjeta con la devolución sin documentos marcados" },
      { texto: "Abre Subir / reemplazar documentos y pulsa Reemplazar en la fila del documento pedido. Solo se envía lo que subas ahora.", imagen: `${IMG}/sgc-sin-detalle-2.png`, alt: "Ventana para reemplazar documentos" },
      { texto: "Pulsa Subsanar observación y firma nuevamente el contrato (sigue el manual «El área legal observó el contrato»)." },
      { texto: "Pulsa Solicitar nueva revisión." },
    ],
    importante: [
      "Reemplaza en la fila del documento (Vigencia, DNI o Ficha RUC); evita «Agregar otro documento» para estos.",
      "El área legal exige una nueva firma del contrato en este tipo de devolución.",
    ],
  },
  [MANUAL_CASOS.SGC_REENVIAR]: {
    caso: MANUAL_CASOS.SGC_REENVIAR,
    titulo: "Solicitar la nueva revisión",
    origen: "Área legal",
    resumen: "Ya corregiste todo lo observado. Falta pedir que el área legal lo revise.",
    pasos: [
      { texto: "Pulsa Solicitar nueva revisión en tu solicitud.", imagen: `${IMG}/sgc-reenviar-1.png`, alt: "Botón Solicitar nueva revisión habilitado" },
      { texto: "Confirma con Reenviar. El estado cambia a revisión del área legal.", imagen: `${IMG}/sgc-reenviar-2.png`, alt: "Confirmación para solicitar la nueva revisión" },
    ],
    importante: ["Si aparece un mensaje en rojo, indica qué falta; corrígelo y vuelve a intentar."],
  },
  [MANUAL_CASOS.EN_REVISION]: {
    caso: MANUAL_CASOS.EN_REVISION,
    titulo: "Tu solicitud está en revisión",
    origen: "Área legal",
    resumen: "El área legal está revisando tu solicitud. No necesitas hacer nada por ahora.",
    pasos: [
      { texto: "Mientras el flujo muestra Área legal en revisión, solo espera. Te avisaremos por correo y en la campana si hay observaciones.", imagen: `${IMG}/en-revision-1.png`, alt: "Tarjeta en revisión del área legal" },
    ],
    importante: ["Si ves «Solicitar nueva revisión» y ya la pediste, no es necesario volver a pulsarlo."],
  },
  [MANUAL_CASOS.PAGO]: {
    caso: MANUAL_CASOS.PAGO,
    titulo: "Pagar tu reserva",
    origen: "Facturación",
    resumen: "Tu contrato fue aprobado. Ahora corresponde el pago de la cuota según tu plan.",
    pasos: [
      { texto: "Tu solicitud queda en Pendiente de pago. Ve a Mis documentos (menú Facturación) para ver tus cuotas, pagar y descargar comprobantes.", imagen: `${IMG}/pago-1.png`, alt: "Tarjeta con la solicitud pendiente de pago" },
    ],
    importante: ["La primera cuota no admite orden de compra."],
    manualCompleto: { href: "/manual/facturacion", label: "Manual de facturación" },
  },
};

/** Manuales completos disponibles (paginas publicas). */
export const MANUALES_COMPLETOS: { href: string; label: string; descripcion: string }[] = [
  { href: "/manual", label: "Reserva de stands", descripcion: "Plano, contrato y pagos" },
  { href: "/manual/subsanacion", label: "Subsanación (área legal)", descripcion: "Observaciones, documentos y firma" },
  { href: "/manual/facturacion", label: "Facturación", descripcion: "Requisitos, solicitud y facturas" },
  { href: "/manual/dd", label: "Debida diligencia", descripcion: "Formulario, vigencia y documentos" },
];
