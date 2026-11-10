import type { ManualSeccion } from "./content";

export const MANUAL_FACTURACION_TOC: ManualSeccion[] = [
  { id: "seccion-1", label: "1. ¿Qué es la facturación de mi reserva?" },
  { id: "seccion-2", label: "2. Acceso a Mis documentos" },
  { id: "seccion-3", label: "3. Declara tus requisitos de facturación" },
  { id: "seccion-4", label: "4. Envía tu solicitud de factura" },
  { id: "seccion-5", label: "5. ¿Qué pasa después del envío?" },
  { id: "seccion-6", label: "6. Fechas y seguimiento de tus cuotas" },
  { id: "seccion-7", label: "7. Documentos de cada cuota" },
  { id: "seccion-8", label: "8. Ver y descargar tus facturas" },
  { id: "seccion-9", label: "9. Contacto de facturación" },
  { id: "seccion-10", label: "10. Preguntas frecuentes" },
  { id: "seccion-11", label: "11. Soporte" },
];

export const MANUAL_FACTURACION_HTML: string = `
<h1>Manual de Facturación — Portal del Expositor</h1>
<blockquote>
<p><strong>Versión:</strong> 1.0<br><strong>Audiencia:</strong> Empresas exhibidoras.<br><strong>Alcance:</strong> Solicitud de factura, requisitos, documentos por cuota y descarga de facturas.<br><strong>Idiomas:</strong> el portal puede verse en español e inglés con el selector ES/EN de la cabecera.</p>
</blockquote>
<hr>
<h2 id="seccion-1">1. ¿Qué es la facturación de mi reserva?</h2>
<p>Cuando reservas uno o más stands, tu solicitud genera un <strong>plan de cuotas</strong>. Para cada cuota, el área de <strong>Facturación y Cobranzas del IIMP</strong> emite la factura correspondiente en la fecha programada de esa cuota.</p>
<p>Desde el portal puedes:</p>
<ul>
<li>Declarar los <strong>requisitos de facturación</strong> de tu empresa.</li>
<li><strong>Enviar tu solicitud de factura</strong> con los documentos que correspondan.</li>
<li>Ver la <strong>fecha de emisión</strong> de cada cuota y el estado de tu plan.</li>
<li><strong>Ver y descargar</strong> tus facturas.</li>
<li>Adjuntar <strong>constancias de pago</strong> (referenciales) y otros documentos por cuota.</li>
</ul>
<blockquote>
<p>Los pagos y su confirmación los gestiona <strong>Facturación y Cobranzas</strong>. El portal muestra el estado que ellos registran: no es una pasarela de pago.</p>
</blockquote>
<hr>
<h2 id="seccion-2">2. Acceso a Mis documentos</h2>
<p>Ingresa al Portal del Expositor y abre <strong>Mis documentos</strong> en el menú lateral.</p>
<p><img src="/manual/img/fact-01-mis-documentos.png" alt="Mis documentos"><br><em>Figura 1 — Plan de cuotas con fechas de emisión y estado por cuota.</em></p>
<p>Verás tus solicitudes de stands, cada una con su plan de cuotas y el estado de cada cuota:</p>
<ul>
<li><strong>Pendiente</strong>: la cuota aún no se ha pagado.</li>
<li><strong>Pagado</strong>: Facturación registró el pago de la cuota.</li>
</ul>

<hr>
<h2 id="seccion-3">3. Declara tus requisitos de facturación</h2>
<p>Antes de solicitar tu factura, el portal te muestra el formulario <strong>Requisitos de facturación</strong>. Ábrelo con el <strong>ícono de solicitud</strong> que está a la derecha de la cuota pendiente (marcado en rojo en la Figura 2). Si aún no enviaste tu solicitud, la cuota muestra la etiqueta "Solicitar factura aquí".</p>
<p><img src="/manual/img/fact-02a-tarjeta-solicitar.png" alt="Icono de solicitud de factura"><br><em>Figura 2 — Ícono de solicitud de factura en la cuota.</em></p>
<p>Marca todos los requisitos que exige tu empresa:</p>
<div class="manual-table-wrap"><table>
<thead>
<tr><th>Requisito</th><th>Qué significa</th></tr>
</thead>
<tbody>
<tr>
<td><strong>Orden de compra (OC)</strong></td>
<td>Documento que autoriza la compra del producto o servicio. Muchas empresas no procesan la factura sin OC.</td>
</tr>
<tr>
<td><strong>Hoja de entrada de servicio (HES)</strong></td>
<td>Constancia de conformidad del servicio recibido; suele ser obligatoria para dar por aceptado el servicio.</td>
</tr>
<tr>
<td><strong>Registro en plataforma o portal de proveedores</strong></td>
<td>Indica si tu empresa exige registrar la factura en un portal para su validación. Debes indicar el <strong>nombre</strong> y el <strong>enlace</strong> (http:// o https://).</td>
</tr>
<tr>
<td><strong>Valorización o cotización aprobada</strong></td>
<td>Documento que sustenta el importe contratado.</td>
</tr>
<tr>
<td><strong>Otros requisitos</strong></td>
<td>Cualquier otro documento que exija tu área de cuentas por pagar. Debes <strong>especificar</strong> cuál.</td>
</tr>
<tr>
<td><strong>Ninguna de las anteriores</strong></td>
<td>Tu empresa no requiere estos documentos (por ejemplo, empresas extranjeras o sin orden de compra).</td>
</tr>
</tbody></table></div>
<blockquote>
<p>Si marcas cualquier requisito se desmarca "Ninguna de las anteriores"; si marcas "Ninguna", se limpian los demás. El <strong>nombre y enlace de la plataforma</strong> y la <strong>especificación de "Otros"</strong> son obligatorios cuando los marcas.</p>
</blockquote>
<hr>
<h2 id="seccion-4">4. Envía tu solicitud de factura</h2>
<p>Con los requisitos marcados, el mismo formulario habilita la sección <strong>Documentos a adjuntar</strong>, con una tarjeta por cada requisito declarado:</p>
<ol>
<li>Pulsa <strong>Adjuntar</strong> en cada requisito y selecciona tu archivo (PDF, imagen, Word o Excel; máximo 10 MB).</li>
<li>Confirma la subida. El documento se agrega a la lista (puedes subir <strong>varios</strong> por requisito y quitarlos).</li>
<li>Cada documento queda asociado a la <strong>cuota desde la que abriste el formulario</strong>.</li>
</ol>
<p>Es <strong>obligatorio adjuntar al menos un documento por cada requisito marcado</strong>: verás la etiqueta "Obligatorio" y un aviso si falta alguno. El botón <strong>Enviar solicitud de factura</strong> se habilita cuando todo está completo.</p>
<p>Al enviar:</p>
<ul>
<li>Se registra tu <strong>solicitud de factura</strong> y se crea la reserva en el sistema del IIMP (contrato y cuenta corriente).</li>
<li>Tus requisitos quedan guardados para que Facturación los revise.</li>
<li>Verás el aviso <strong>"Solicitud de factura enviada · tu factura está en proceso de emisión"</strong> en Mis documentos.</li>
<li>Recibirás un correo de <strong>Facturación y Cobranzas</strong> con las indicaciones de pago.</li>
</ul>
<blockquote>
<p>La solicitud se envía una sola vez. Si después necesitas agregar documentos, puedes hacerlo desde <strong>Mis documentos</strong> en cualquier momento.</p>
<p><img src="/manual/img/fact-02-requisitos.png" alt="Requisitos y documentos a adjuntar"><br><em>Figura 3 — Formulario único: requisitos y documentos obligatorios por tipo.</em></p>
</blockquote>
<hr>
<h2 id="seccion-5">5. ¿Qué pasa después del envío?</h2>
<p>La factura <strong>no se emite de inmediato</strong>: Facturación emite la factura de <strong>cada cuota en su fecha</strong>.</p>
<ul>
<li>Mientras no se emita, verás la <strong>fecha de emisión programada</strong> de la cuota y el aviso de que tu factura está <strong>en proceso de emisión</strong>.</li>
<li>Cuando la factura se emite, el portal muestra la <strong>fecha de emisión real</strong> y el documento queda disponible para ver y descargar. También <strong>recibirás un correo</strong> avisando que la factura está disponible.</li>
<li>Si Facturación anula o rechaza una factura, verás la marca y el motivo; la cuota queda pendiente de un nuevo documento.</li>
<li>Cuando Facturación confirma el pago de todas las cuotas, la solicitud pasa a <strong>pagado</strong>.</li>
</ul>
<hr>
<h2 id="seccion-6">6. Fechas y seguimiento de tus cuotas</h2>
<p>Cada cuota muestra su <strong>Fecha de emisión</strong>:</p>
<ul>
<li><strong>Real</strong>, si Facturación ya emitió la factura.</li>
<li><strong>Programada</strong>, si aún no se emite (es la fecha del plan).</li>
</ul>
<p>El portal te ayuda a anticiparte:</p>
<ul>
<li><strong>Siguiente cuota</strong>: se resalta la primera cuota pendiente cuando faltan <strong>15 días o menos</strong> para su emisión ("se emite en N días", "se emite hoy" o "fecha de emisión pasada").</li>
<li><strong>Factura emitida · pendiente de pago</strong>: la factura ya existe y falta el pago.</li>
<li><strong>Solicitud de factura pendiente</strong>: si aún no enviaste tu solicitud, se resalta la cuota desde la que debes hacerlo ("Solicitar factura aquí").</li>
</ul>
<hr>
<h2 id="seccion-7">7. Documentos de cada cuota</h2>
<p>Cuando la cuota <strong>ya tiene su factura emitida</strong>, el <strong>ícono de documentos</strong> (carpetas) abre el panel <strong>Documentos para tu factura</strong> (marcado en rojo en la Figura 4). Mientras la factura aún no se emite, la cuota muestra el ícono de factura en estado pendiente y <strong>no</strong> te pide documentos adicionales.</p>
<p><img src="/manual/img/fact-03a-tarjeta-documentos.png" alt="Icono de documentos"><br><em>Figura 4 — Ícono de documentos por cuota.</em></p>
<ul>
<li><strong>Constancia de detracción</strong> (SPOT).</li>
<li><strong>Pago del saldo de la cuota</strong> (diferencia).</li>
<li><strong>Pago total</strong> (para cuotas sin detracción).</li>
<li><strong>Orden de compra, HES, valorización y otros requisitos</strong> que hayas declarado.</li>
</ul>
<p>Puedes subir varios documentos de cada tipo. Los tipos que <strong>ya tienen un documento en esa cuota</strong> dejan de ofrecerse en el selector; la bandeja muestra todo lo registrado agrupado por cuota.</p>
<blockquote>
<p>Las constancias de pago que adjuntas son <strong>referenciales</strong>: Facturación y Cobranzas valida los pagos por sus canales formales. Subirlas no cambia el estado de la cuota.</p>
<p><img src="/manual/img/fact-04-documentos-cuota.png" alt="Documentos para tu factura"><br><em>Figura 5 — Documentos registrados y tipos disponibles por cuota.</em></p>
</blockquote>

<hr>
<h2 id="seccion-8">8. Ver y descargar tus facturas</h2>
<p>En cada cuota con factura verás una fila con el nombre del documento y tres acciones. Pulsa el <strong>ícono de descarga</strong> de la fila de la factura (marcado en rojo en la Figura 6). Cuando la factura se emite, también <strong>recibirás un correo</strong> de aviso en el correo de facturación.</p>
<p><img src="/manual/img/fact-06a-tarjeta-factura.png" alt="Icono de descarga de factura"><br><em>Figura 6 — Ícono de descarga en la cuota facturada.</em></p>
<ul>
<li><strong>Vista previa</strong>: abre la factura en un modal de la misma página.</li>
<li><strong>Abrir en otra pestaña</strong>: visualiza el PDF en una pestaña nueva.</li>
<li><strong>Descargar</strong>: descarga el archivo PDF.</li>
</ul>
<p><img src="/manual/img/fact-06-factura.png" alt="Factura disponible"><br><em>Figura 7 — Factura con vista previa, apertura en pestaña y descarga.</em></p>
<p>Si la factura fue <strong>anulada o rechazada</strong>, el botón de descarga no aplica y se muestra el motivo informado por Facturación.</p>
<hr>
<h2 id="seccion-9">9. Contacto de facturación</h2>
<p>En <strong>Mis documentos</strong>, el botón <strong>Contacto</strong> del encabezado (marcado en rojo en la Figura 8) abre un cuadro con los correos y teléfonos de <strong>Facturación y Cobranzas</strong>:</p>
<p><img src="/manual/img/fact-05a-boton-contacto.png" alt="Boton Contacto"><br><em>Figura 8 — Botón Contacto en el encabezado.</em></p>
<ul>
<li>Los correos se abren como <code>mailto:</code>.</li>
<li>Los teléfonos permiten iniciar una llamada.</li>
</ul>
<p>Los datos los mantiene el IIMP desde la configuración del portal. Si no ves datos, contacta a la Mesa de Ayuda.</p>
<p><img src="/manual/img/fact-05-contacto.png" alt="Contacto de facturación"><br><em>Figura 9 — Correos y teléfonos de Facturación y Cobranzas.</em></p>
<hr>
<h2 id="seccion-10">10. Preguntas frecuentes</h2>
<p><strong>¿Por qué me piden OC y HES?</strong><br>Son requisitos habituales de las áreas de cuentas por pagar: la OC autoriza la compra y la HES confirma la conformidad del servicio. Declararlos y adjuntarlos evita observaciones y retrasos en la emisión.</p>
<p><strong>Mi empresa no usa OC ni HES, ¿puedo solicitar mi factura?</strong><br>Sí. Marca <strong>Ninguna de las anteriores</strong> y envía la solicitud; no se exigirán documentos de esos tipos.</p>
<p><strong>¿Cuándo se emite mi factura?</strong><br>Facturación emite la factura de cada cuota en su fecha. Hasta entonces verás la fecha programada; luego se actualiza a la fecha real de emisión.</p>
<p><strong>Subí mi constancia de pago y sigue "Pendiente", ¿qué pasa?</strong><br>Las constancias son referenciales y no cambian el estado. Facturación valida el pago por sus canales y actualiza la cuota cuando lo confirma.</p>
<p><strong>¿Qué hago si mi factura fue anulada?</strong><br>Revisa el motivo en la cuota. Facturación gestiona la reemisión; cuando se emita la nueva factura aparecerá con su fecha y podrás descargarla.</p>
<p><strong>¿Cuándo pasa mi solicitud a "Pagado"?</strong><br>Cuando todas las cuotas estén pagadas y confirmadas por Facturación.</p>
<p><strong>¿Puedo agregar más documentos después?</strong><br>Sí, cuando la cuota ya tiene factura emitida puedes usar el ícono de documentos de esa cuota en <strong>Mis documentos</strong>.</p>
<hr>
<h2 id="seccion-11">11. Soporte</h2>
<p>Para dudas sobre requisitos, documentos o facturas:</p>
<ul>
<li>Usa el botón <strong>Contacto</strong> en Mis documentos (Facturación y Cobranzas).</li>
<li>Si el problema es de acceso al portal, contacta a la <strong>Mesa de Ayuda del IIMP</strong>.</li>
<li>Ten a mano el <strong>código de tu solicitud</strong> (contrato) y el número de la cuota para ubicar tu caso.</li>
</ul>
`;
