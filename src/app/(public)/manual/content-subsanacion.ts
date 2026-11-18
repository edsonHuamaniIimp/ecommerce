import type { ManualSeccion } from "./content";

export const MANUAL_SUBSANACION_TOC: ManualSeccion[] = [
  { id: "seccion-1", label: "1. Qué es una observación del SGC" },
  { id: "seccion-2", label: "2. Revisar la bandeja y el detalle" },
  { id: "seccion-3", label: "3. Versión corregida vs archivo nuevo" },
  { id: "seccion-4", label: "4. Corregir varios documentos" },
  { id: "seccion-5", label: "5. Adjuntos agrupados (v11)" },
  { id: "seccion-6", label: "6. Casos antiguos" },
  { id: "seccion-7", label: "7. Corregir el contrato" },
  { id: "seccion-8", label: "8. Firmar con cursor o sello" },
  { id: "seccion-9", label: "9. Agregar o quitar representantes" },
  { id: "seccion-10", label: "10. Solicitar nueva revisión" },
  { id: "seccion-11", label: "11. Errores frecuentes" },
  { id: "seccion-12", label: "12. Checklist y soporte" },
];

export const MANUAL_SUBSANACION_HTML: string = `
<h1>Manual de subsanación de observaciones del SGC</h1>
<blockquote>
<p><strong>Versión:</strong> 1.0<br>
<strong>Audiencia:</strong> empresas exhibidoras y personal autorizado del IIMP.<br>
<strong>Alcance:</strong> corrección de observaciones del SGC, firma del contrato y reenvío a revisión.<br>
<strong>Regla de oro:</strong> el SGC es la autoridad; una corrección no está resuelta hasta que el SGC la acepta.</p>
</blockquote>

<hr>
<h2 id="seccion-1">1. Qué es una observación del SGC</h2>
<p>El SGC puede devolver el expediente cuando falta un documento, cuando un adjunto debe corregirse o cuando el contrato requiere una nueva versión.</p>
<div class="manual-table-wrap"><table>
<thead><tr><th>Tipo</th><th>Qué pide el SGC</th><th>Qué debes hacer</th></tr></thead>
<tbody>
<tr><td>Adjunto observado</td><td>Una versión nueva de un documento que ya existe</td><td>Subir por <strong>Versión corregida</strong></td></tr>
<tr><td>Faltante individual</td><td>Un documento que no existe todavía</td><td>Subir por <strong>Archivo nuevo</strong></td></tr>
<tr><td>Contrato observado</td><td>Una nueva versión firmada del contrato</td><td>Regenerar y firmar</td></tr>
<tr><td>Grupo v11</td><td>Varias piezas dentro de una misma observación</td><td>Subir cada pieza con su <code>pieceId</code></td></tr>
</tbody></table></div>
<p><img src="/manual/img-subsanacion/01-bandeja-observada.png" alt="Bandeja con una solicitud observada por el SGC">
<em>Figura 1. Identifica la solicitud observada y abre su revisión o detalle.</em></p>

<hr>
<h2 id="seccion-2">2. Revisar la bandeja y el detalle</h2>
<ol>
<li>Ingresa a <strong>Mis solicitudes</strong> o, si eres administrador, a <strong>Solicitudes de alquiler</strong>.</li>
<li>Busca por código de stand, empresa o solicitud.</li>
<li>Confirma que el estado sea <strong>Observado</strong>.</li>
<li>Abre <strong>Ver detalle</strong> o <strong>Revisar solicitud</strong>.</li>
<li>Revisa el estado del SGC: debe estar en <code>observed</code> o <code>rejected</code> y, para corregir, en etapa <code>drafting</code>.</li>
</ol>
<p><img src="/manual/img-subsanacion/03-detalle-anotado.png" alt="Detalle de una solicitud observada">
<em>Figura 2. El detalle concentra resumen, documentos, contrato y estado de revisión.</em></p>
<blockquote>
<p>No confundas las secciones. <strong>Documentos observados</strong> se refiere a anexos; <strong>Contrato observado</strong> se refiere al documento principal.</p>
</blockquote>

<hr>
<h2 id="seccion-3">3. Versión corregida vs archivo nuevo</h2>
<p>La diferencia es crítica. El SGC valida una corrección por <code>documentId</code>; un archivo aparte no reemplaza al documento observado.</p>
<h3>3.1 Versión corregida</h3>
<ol>
<li>Busca la fila con el badge <strong>Versión corregida</strong>.</li>
<li>Pulsa <strong>Subir versión corregida</strong>.</li>
<li>Selecciona el archivo corregido.</li>
<li>Verifica que quede como <strong>Listo para enviar</strong>.</li>
</ol>
<h3>3.2 Archivo nuevo</h3>
<ol>
<li>Busca la fila con el badge <strong>Archivo nuevo</strong>.</li>
<li>Pulsa <strong>Adjuntar archivo nuevo</strong>.</li>
<li>Sube el documento solicitado con su título exacto.</li>
<li>Verifica que quede como <strong>Listo para enviar</strong>.</li>
</ol>
<blockquote>
<p>Si el SGC responde “Un adjunto corregido debe subirse como versión nueva”, significa que se usó un archivo nuevo donde correspondía una versión.</p>
</blockquote>

<hr>
<h2 id="seccion-4">4. Corregir varios documentos</h2>
<p>Una devolución puede pedir varios archivos. Cada uno cuenta por separado.</p>
<ol>
<li>Revisa el contador <strong>Te piden N archivos; llevas M</strong>.</li>
<li>Sube cada documento pendiente.</li>
<li>Si dos faltantes comparten un título similar, no uses un solo archivo para ambos.</li>
<li>No uses un anexo cualquiera para cubrir un documento con título específico.</li>
<li>Cuando el contador llegue a cero, habilita <strong>Solicitar nueva revisión</strong>.</li>
</ol>
<p><img src="/manual/img-subsanacion/02-revision-anotada.png" alt="Documentos y revisión de la solicitud">
<em>Figura 3. Revisa documentos, versiones y estado de la revisión antes de reenviar.</em></p>

<hr>
<h2 id="seccion-5">5. Adjuntos agrupados (v11)</h2>
<p>En una observación agrupada, el SGC devuelve <code>pieces[]</code> con <code>id</code>, <code>title</code> y, si existe, <code>acceptedDocumentId</code>.</p>
<ol>
<li>El modal muestra las piezas esperadas.</li>
<li>Sube un archivo por pieza.</li>
<li>Cada archivo se envía con <code>observationId</code> + <code>pieceId</code>.</li>
<li>No se puede reenviar mientras haya una pieza pendiente.</li>
<li>Una pieza aceptada no se vuelve a subir.</li>
</ol>
<blockquote>
<p>Si el caso es antiguo y no trae <code>pieces[]</code>, no adivines la pieza. Solicita al SGC que reemita la observación o escala a corrección administrativa.</p>
</blockquote>

<hr>
<h2 id="seccion-6">6. Casos antiguos</h2>
<h3>6.1 Adjunto individual con documentId</h3>
<p>Corrige con una versión nueva del mismo documento. No envíes un archivo aparte.</p>
<h3>6.2 Faltante individual</h3>
<p>Sube un archivo nuevo. El SGC lo valida como faltante, no como reemplazo.</p>
<h3>6.3 Observación agrupada antigua sin pieces</h3>
<p>No se puede reconstruir la relación archivo-pieza de forma segura. No inventes <code>pieceId</code>. Las salidas válidas son:</p>
<ol>
<li>Que el SGC reemita la observación agrupada con <code>pieces[]</code>.</li>
<li>Usar corrección administrativa, si el expediente lo permite.</li>
<li>Escalar a soporte con el número de expediente.</li>
</ol>

<hr>
<h2 id="seccion-7">7. Corregir el contrato</h2>
<h3>7.1 Contrato en preparación</h3>
<p>Cuando el SGC observa el contrato, el portal inicia la regeneración.</p>
<ul>
<li>Verás <strong>Preparando contrato corregido</strong>.</li>
<li>El botón de firma queda deshabilitado.</li>
<li>No cierres el caso ni crees un contrato manual paralelo.</li>
<li>Espera unos segundos y vuelve a abrir el detalle.</li>
</ul>
<h3>7.2 Contrato corregido listo</h3>
<ul>
<li>Aparece <strong>Contrato corregido listo</strong>.</li>
<li>El bloque del administrador muestra <strong>Contrato corregido para firmar</strong>.</li>
<li>Se habilitan las firmas de los representantes.</li>
<li>Puedes abrir <strong>Firmar contrato corregido</strong>.</li>
</ul>
<p><img src="/manual/img-subsanacion/04-firmas-anotado.png" alt="Modal de firma del contrato">
<em>Figura 4. El modal de firma muestra el contrato y las firmas requeridas.</em></p>

<hr>
<h2 id="seccion-8">8. Firmar con cursor o sello</h2>
<h3>8.1 Firma con cursor</h3>
<ol>
<li>Selecciona al firmante.</li>
<li>Elige <strong>Firma con cursor</strong>.</li>
<li>Dibuja la firma en el lienzo.</li>
<li>Confirma y verifica que las dos secciones del firmante queden completas.</li>
<li>Repite con cada representante.</li>
</ol>
<h3>8.2 Firma con sello</h3>
<ol>
<li>Selecciona al firmante.</li>
<li>Elige <strong>Sello</strong>.</li>
<li>Verifica el sello generado con nombre y apellidos.</li>
<li>Arrastra el sello a la zona de firma.</li>
<li>Confirma y revisa la sección.</li>
</ol>
<blockquote>
<p>La firma debe corresponder al representante legal autorizado. No reemplaces una firma del cliente por una firma del administrador.</p>
</blockquote>

<hr>
<h2 id="seccion-9">9. Agregar o quitar representantes</h2>
<ol>
<li>En la vista de firma, abre <strong>¿Necesitas quitar o agregar un firmante adicional?</strong>.</li>
<li>Agrega el representante con sus datos y documento.</li>
<li>Guarda. El sistema regenera el contrato con los nuevos firmantes.</li>
<li>Vuelve a capturar la firma de cada representante.</li>
<li>Verifica que el número de firmantes y secciones coincida.</li>
</ol>
<p>No elimines un firmante con firma ya estampada sin regenerar el contrato. Si el expediente ya está aprobado, no se puede modificar.</p>

<hr>
<h2 id="seccion-10">10. Solicitar nueva revisión</h2>
<ol>
<li>Confirma que todas las observaciones abiertas tengan archivo o versión.</li>
<li>Pulsa <strong>Solicitar nueva revisión</strong> una sola vez.</li>
<li>El sistema sube las correcciones y ejecuta <code>/resend</code>.</li>
<li>El SGC pasa a revisión o devuelve una nueva observación.</li>
</ol>
<p>Si recibes un error <code>422</code>, lee el mensaje. Normalmente indica exactamente qué versión o archivo falta.</p>

<hr>
<h2 id="seccion-11">11. Errores frecuentes</h2>
<div class="manual-table-wrap"><table>
<thead><tr><th>Mensaje</th><th>Causa</th><th>Solución</th></tr></thead>
<tbody>
<tr><td>Indica observationId y pieceId válidos</td><td>Se envió un observationId suelto o una pieza inválida</td><td>Usar ambos solo en un grupo v11</td></tr>
<tr><td>Un adjunto corregido debe subirse como versión nueva</td><td>Se subió un archivo nuevo para un adjunto existente</td><td>Subir por <strong>Versión corregida</strong></td></tr>
<tr><td>Todavía falta: Adjunto corregido</td><td>Falta la versión de un documento existente</td><td>Subir la versión del documentId indicado</td></tr>
<tr><td>Todavía falta: documento</td><td>Falta un archivo nuevo</td><td>Subir por <strong>Archivo nuevo</strong></td></tr>
<tr><td>409 pieza ajena</td><td>pieceId no corresponde a la observación</td><td>Sincronizar y elegir la pieza correcta</td></tr>
<tr><td>500 al reenviar</td><td>Error interno o error SGC no mapeado</td><td>Revisar logs; no reintentar a ciegas</td></tr>
</tbody></table></div>

<hr>
<h2 id="seccion-12">12. Checklist y soporte</h2>
<ul>
<li>La solicitud sigue observada y no está aprobada, cerrada ni finalizada.</li>
<li>Cada observación tiene su archivo o versión.</li>
<li>Las versiones usan el documentId correcto.</li>
<li>Los faltantes usan un archivo nuevo.</li>
<li>Las piezas v11 usan pieceId.</li>
<li>El contrato fue firmado por todos los representantes.</li>
<li>No se eliminó ningún documento.</li>
<li>Se solicitó la nueva revisión una sola vez.</li>
</ul>
<p>Si el caso no encaja en ninguno de estos escenarios, no adivines. Adjunta el número de expediente, el estado SGC y el mensaje exacto, y escala a soporte del IIMP.</p>
`;
