import type { ManualSeccion } from "./content";

export const MANUAL_SUBSANACION_ASOCIADO_TOC: ManualSeccion[] = [
  { id: "seccion-1", label: "1. Alcance y roles" },
  { id: "seccion-2", label: "2. Bandeja y revisión" },
  { id: "seccion-3", label: "3. Diagnóstico de la observación" },
  { id: "seccion-4", label: "4. Versión corregida vs archivo nuevo" },
  { id: "seccion-5", label: "5. Agrupados y casos antiguos" },
  { id: "seccion-6", label: "6. Regenerar el contrato" },
  { id: "seccion-7", label: "7. Firma, sello y representantes" },
  { id: "seccion-8", label: "8. Reenvío al SGC" },
  { id: "seccion-9", label: "9. Errores y diagnóstico" },
  { id: "seccion-10", label: "10. Auditoría y checklist" },
];

export const MANUAL_SUBSANACION_ASOCIADO_HTML: string = `
<h1>Manual de subsanación SGC para Asociados y soporte</h1>
<blockquote>
<p><strong>Audiencia:</strong> Asociados, Legal, administradores y personal con acceso a Solicitudes de alquiler.<br>
<strong>Objetivo:</strong> diagnosticar una observación del SGC, corregirla sin perder historial y reenviarla correctamente.<br>
<strong>Principio:</strong> el SGC valida por identificadores, no por nombres de archivo ni por fecha.</p>
</blockquote>

<hr>
<h2 id="seccion-1">1. Alcance y roles</h2>
<div class="manual-table-wrap"><table>
<thead><tr><th>Rol</th><th>Puede hacer</th><th>No debe hacer</th></tr></thead>
<tbody>
<tr><td>Asociado</td><td>Revisar solicitudes, observar, aprobar y habilitar contrato</td><td>Modificar un expediente aprobado o inventar piezas</td></tr>
<tr><td>Legal / SGC</td><td>Observar, devolver, aprobar y validar correcciones</td><td>Asignar archivos por nombre sin documentId</td></tr>
<tr><td>Administrador</td><td>Ver como empresa, regenerar contrato, corregir y reenviar</td><td>Eliminar historial o alterar firmas</td></tr>
<tr><td>Soporte autorizado</td><td>Corrección excepcional con auditoría</td><td>Operar sin ticket, motivo y evidencia</td></tr>
</tbody></table></div>

<hr>
<h2 id="seccion-2">2. Bandeja y revisión</h2>
<ol>
<li>Ingresa a <strong>Solicitudes de alquiler</strong>.</li>
<li>Usa los contadores de estado: pendientes, observadas por Asociado y <strong>observadas por Legal</strong>.</li>
<li>Busca por stand, empresa o usuario.</li>
<li>Usa <strong>Revisar solicitud</strong> para abrir el expediente.</li>
<li>Revisa el detalle SGC antes de pedir archivos: estado, etapa, observaciones y documentos actuales.</li>
</ol>
<p><img src="/manual/img-subsanacion/01-bandeja-observada.png" alt="Bandeja con solicitud observada">
<em>Figura 1. La bandeja permite ubicar la solicitud observada por el SGC.</em></p>
<p><img src="/manual/img-subsanacion/02-revision-anotada.png" alt="Revisión de documentos y estado">
<em>Figura 2. Revisa documentos, versiones y estado de revisión.</em></p>

<hr>
<h2 id="seccion-3">3. Diagnóstico de la observación</h2>
<p>Clasifica la observación antes de actuar:</p>
<div class="manual-table-wrap"><table>
<thead><tr><th>Dato en la observación</th><th>Acción</th></tr></thead>
<tbody>
<tr><td><code>documentId</code> presente</td><td>Versión nueva de ese documento</td></tr>
<tr><td><code>documentId: null</code> y <code>requiresNewDocument: true</code></td><td>Archivo nuevo</td></tr>
<tr><td><code>pieces[]</code></td><td>Una versión por pieza con <code>observationId</code> + <code>pieceId</code></td></tr>
<tr><td>Título duplicado</td><td>Distinguir versión existente de faltante nuevo</td></tr>
<tr><td>Sin <code>pieces[]</code> en caso antiguo agrupado</td><td>No adivinar; solicitar reemisión o corrección administrativa</td></tr>
</tbody></table></div>
<blockquote>
<p>Si el SGC pide una versión de un adjunto existente y se sube un archivo nuevo, responderá que no lo reemplaza.</p>
</blockquote>

<hr>
<h2 id="seccion-4">4. Versión corregida vs archivo nuevo</h2>
<h3>4.1 Versión corregida</h3>
<ol>
<li>Ubica la fila con badge <strong>Versión corregida</strong>.</li>
<li>Sube el archivo por esa fila.</li>
<li>Verifica que el documento local quede con <code>sgc_document_id</code> correcto.</li>
<li>No marques como nuevo un adjunto que ya existe.</li>
</ol>
<h3>4.2 Archivo nuevo</h3>
<ol>
<li>Ubica la fila con badge <strong>Archivo nuevo</strong>.</li>
<li>Sube el archivo con el título exacto solicitado.</li>
<li>Verifica que el local quede con <code>sgc_observation_id</code> y sin <code>sgc_document_id</code>.</li>
</ol>
<h3>4.3 Varios faltantes</h3>
<ul>
<li>Cada faltante necesita un archivo propio.</li>
<li>No reutilices un archivo para dos faltantes.</li>
<li>No cubras un faltante con un anexo de otro título.</li>
<li>Revisa que el contador de pendientes llegue a cero.</li>
</ul>

<hr>
<h2 id="seccion-5">5. Agrupados y casos antiguos</h2>
<h3>5.1 Grupo v11</h3>
<p>El SGC devuelve <code>pieces[]</code> con <code>id</code>, <code>title</code> y <code>acceptedDocumentId</code>. Cada pieza se sube con <code>observationId</code> + <code>pieceId</code>. Una pieza aceptada no se vuelve a subir.</p>
<h3>5.2 Caso antiguo individual</h3>
<p>Se corrige por <code>documentId</code>. No envíes <code>observationId</code> suelto.</p>
<h3>5.3 Caso antiguo agrupado sin pieces</h3>
<p>No se puede reconstruir de forma segura. Opciones:</p>
<ol>
<li>Pedir al SGC que reemita la observación con <code>pieces[]</code>.</li>
<li>Usar corrección administrativa si el estado lo permite.</li>
<li>Escalar con expediente, estado y mensaje exacto.</li>
</ol>

<hr>
<h2 id="seccion-6">6. Regenerar el contrato</h2>
<ol>
<li>Confirma que el contrato esté observado y que el expediente esté en <code>observed</code>/<code>rejected</code> y <code>drafting</code>.</li>
<li>El portal debe mostrar <strong>Preparando contrato corregido</strong>.</li>
<li>No regeneres si el expediente ya está aprobado, finalizado, cerrado o archivado.</li>
<li>La regeneración se ejecuta en segundo plano; no bloquea la bandeja.</li>
<li>Cuando termine, debe aparecer <strong>Contrato corregido listo</strong>.</li>
<li>El contrato del administrador debe quedar activo y posterior a la observación.</li>
</ol>
<p><img src="/manual/img-subsanacion/03-detalle-anotado.png" alt="Detalle de la solicitud observada">
<em>Figura 3. El detalle permite comprobar el estado y el contrato vigente.</em></p>

<hr>
<h2 id="seccion-7">7. Firma, sello y representantes</h2>
<ul>
<li>La firma del contrato es digital; no se sube un contrato firmado a mano.</li>
<li>La firma con cursor se dibuja en las secciones del contrato.</li>
<li>La firma con sello se arrastra a la zona correspondiente.</li>
<li>Cada firmante debe completar sus dos secciones.</li>
<li>Para agregar o quitar un firmante adicional, usa el editor de representantes de la vista de firma.</li>
<li>Al cambiar representantes, el contrato se regenera y debe volver a firmarse.</li>
</ul>
<p><img src="/manual/img-subsanacion/04-firmas-anotado.png" alt="Modal de firma del contrato">
<em>Figura 4. Firmas de los representantes y contrato vigente.</em></p>

<hr>
<h2 id="seccion-8">8. Reenvío al SGC</h2>
<ol>
<li>Verifica que todas las observaciones abiertas tengan archivo o versión.</li>
<li>Ejecuta <strong>Solicitar nueva revisión</strong> o el reenvío administrativo.</li>
<li>El backend sube versiones, faltantes y contrato si corresponde.</li>
<li>Se ejecuta <code>/resend</code> una sola vez por ronda.</li>
<li>Confirma el estado SGC después del reenvío: debe pasar a revisión o devolver nueva observación.</li>
</ol>
<blockquote>
<p>No reintentes un reenvío que falló con 500 sin revisar el error. Puedes duplicar documentos o dejar el expediente en un estado inconsistente.</p>
</blockquote>

<hr>
<h2 id="seccion-9">9. Errores y diagnóstico</h2>
<div class="manual-table-wrap"><table>
<thead><tr><th>Error</th><th>Diagnóstico</th><th>Acción</th></tr></thead>
<tbody>
<tr><td>Indica observationId y pieceId válidos</td><td>Se envió un identificador suelto o inválido</td><td>Validar grupo y pieza</td></tr>
<tr><td>Un adjunto corregido debe subirse como versión nueva</td><td>Se usó archivo nuevo para adjunto existente</td><td>Subir versión con documentId</td></tr>
<tr><td>Todavía falta: Adjunto corregido</td><td>Falta versión de un documento existente</td><td>Subir versión indicada</td></tr>
<tr><td>Todavía falta: documento</td><td>Falta un archivo nuevo</td><td>Subir archivo nuevo</td></tr>
<tr><td>409 pieza ajena</td><td>pieceId no corresponde a la observación</td><td>Sincronizar y corregir pieza</td></tr>
<tr><td>422 flujo activo</td><td>Ya se reenvió la ronda</td><td>Esperar revisión</td></tr>
<tr><td>500 al reenviar</td><td>Error no mapeado del SGC o del servidor</td><td>Revisar logs y no reintentar a ciegas</td></tr>
</tbody></table></div>

<hr>
<h2 id="seccion-10">10. Auditoría y checklist</h2>
<ul>
<li>Registrar operador, fecha, expediente, observación y archivo usado.</li>
<li>No eliminar documentos; conservar historial y versiones reemplazadas.</li>
<li>Confirmar que el expediente esté en un estado que permita corrección.</li>
<li>Verificar que cada archivo tenga el identificador SGC correcto.</li>
<li>Confirmar que el contrato corregido esté firmado antes del reenvío.</li>
<li>Verificar el estado final en el SGC.</li>
<li>No modificar directamente la base de datos de producción.</li>
</ul>
<p>Si el caso no se puede resolver con estas reglas, detente y escala a soporte técnico con la evidencia completa.</p>
`;
