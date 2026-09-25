import "server-only";

import { APP_URL } from "@/lib/shared/constants";

/**
 * Plantillas de correo del modulo de Reservas.
 * Convencion (ref. montaje-iimp `lib/server/mail-templates/`): el HTML de la plantilla
 * vive AQUI, nunca en los servicios de negocio; se interpolan datos con `esc`.
 */

/** Escapa texto para interpolarlo en HTML. */
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Confirmacion al cliente cuando registra una reserva (simple o multiple). */
export function buildReservaConfirmationEmail(datos: {
  standCodes: string;
  razonSocial: string;
  documento: string;
  email: string;
  esMultiple?: boolean;
  solicitudId?: string;
}): { subject: string; html: string } {
  const linkUrl = datos.solicitudId
    ? `${APP_URL}/dashboard/mis-solicitudes?id=${encodeURIComponent(datos.solicitudId)}`
    : `${APP_URL}/dashboard/mis-solicitudes`;
  const subject = datos.esMultiple
    ? "Solicitud multiple registrada — IIMP Contratos Stands"
    : "Reserva de stands registrada — IIMP Contratos Stands";

  const flowSteps = datos.esMultiple
    ? `
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0">
        <p style="font-weight:700;color:#0369a1;font-size:14px;margin:0 0 12px 0">Como continuar con tu solicitud multiple:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%">
          <tr>
            <td style="vertical-align:top;padding:0 0 12px 0;text-align:center;width:36px">
              <span style="display:inline-block;width:28px;height:28px;background:#0ea5e9;color:#fff;border-radius:50%;line-height:28px;font-size:13px;font-weight:700">1</span>
            </td>
            <td style="padding:0 0 12px 8px">
              <p style="margin:0;font-size:13px;font-weight:600;color:#0c4a6e">El administrador subira el contrato</p>
              <p style="margin:2px 0 0 0;font-size:12px;color:#64748b">La administracion del IIMP adjuntara el formato de contrato oficial a tu solicitud. Recibiras un correo cuando este listo.</p>
            </td>
          </tr>
          <tr>
            <td style="vertical-align:top;padding:0 0 12px 0;text-align:center;width:36px">
              <span style="display:inline-block;width:28px;height:28px;background:#f59e0b;color:#fff;border-radius:50%;line-height:28px;font-size:13px;font-weight:700">2</span>
            </td>
            <td style="padding:0 0 12px 8px">
              <p style="margin:0;font-size:13px;font-weight:600;color:#92400e">Descarga, completa y adjunta tus documentos</p>
              <p style="margin:2px 0 0 0;font-size:12px;color:#64748b">Ingresa a <strong>Mis solicitudes</strong> en el dashboard, descarga el contrato, completalo y adjunta los documentos requeridos para continuar.</p>
            </td>
          </tr>
          <tr>
            <td style="vertical-align:top;padding:0 0 12px 0;text-align:center;width:36px">
              <span style="display:inline-block;width:28px;height:28px;background:#8b5cf6;color:#fff;border-radius:50%;line-height:28px;font-size:13px;font-weight:700">3</span>
            </td>
            <td style="padding:0 0 12px 8px">
              <p style="margin:0;font-size:13px;font-weight:600;color:#5b21b6">Revision por las areas del IIMP</p>
              <p style="margin:2px 0 0 0;font-size:12px;color:#64748b">Tres areas (Comunicacion, Legal y Logistica) revisaran tu documentacion y emitiran su veredicto.</p>
            </td>
          </tr>
          <tr>
            <td style="vertical-align:top;padding:0 0 0 0;text-align:center;width:36px">
              <span style="display:inline-block;width:28px;height:28px;background:#059669;color:#fff;border-radius:50%;line-height:28px;font-size:13px;font-weight:700">4</span>
            </td>
            <td style="padding:0 0 0 8px">
              <p style="margin:0;font-size:13px;font-weight:600;color:#065f46">Resultado final</p>
              <p style="margin:2px 0 0 0;font-size:12px;color:#64748b">Recibiras un correo con el resultado. Si es rechazada, podras solicitar una re-evaluacion adjuntando nuevos documentos.</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;font-size:12px;color:#0369a1;font-style:italic">Puedes monitorear el estado de tu solicitud en cualquier momento desde <strong>Mis solicitudes</strong> en el dashboard.</p>
      </div>`
    : `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
        <p style="font-weight:700;color:#15803d;font-size:14px;margin:0 0 12px 0">Proximos pasos:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%">
          <tr>
            <td style="vertical-align:top;padding:0 0 12px 0;text-align:center;width:36px">
              <span style="display:inline-block;width:28px;height:28px;background:#16a34a;color:#fff;border-radius:50%;line-height:28px;font-size:13px;font-weight:700">1</span>
            </td>
            <td style="padding:0 0 12px 8px">
              <p style="margin:0;font-size:13px;font-weight:600;color:#14532d">Revision por las areas del IIMP</p>
              <p style="margin:2px 0 0 0;font-size:12px;color:#64748b">Tres areas (Comunicacion, Legal y Logistica) revisaran tu solicitud y documentacion.</p>
            </td>
          </tr>
          <tr>
            <td style="vertical-align:top;padding:0 0 0 0;text-align:center;width:36px">
              <span style="display:inline-block;width:28px;height:28px;background:#dc2626;color:#fff;border-radius:50%;line-height:28px;font-size:13px;font-weight:700">!</span>
            </td>
            <td style="padding:0 0 0 8px">
              <p style="margin:0;font-size:13px;font-weight:600;color:#991b1b">En caso de rechazo</p>
              <p style="margin:2px 0 0 0;font-size:12px;color:#64748b">Si alguna area rechaza tu solicitud, recibiras un correo con los motivos y podras solicitar una re-evaluacion.</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;font-size:12px;color:#15803d;font-style:italic">El stand permanecera en estado <strong>En evaluacion</strong> hasta que todas las areas emitan su veredicto.</p>
      </div>`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
      <div style="background:#059669;padding:16px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">IIMP — Contratos Stands</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        <h2 style="color:#059669;margin-top:0">${datos.esMultiple ? "Solicitud multiple registrada" : "Reserva registrada"}</h2>
        <p>Hola, tu solicitud de reserva ha sido registrada exitosamente.</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Stands</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${esc(datos.standCodes)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Razon social</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${esc(datos.razonSocial)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Documento</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${esc(datos.documento)}</td></tr>
        </table>

        ${flowSteps}

        <div style="text-align:center;margin:20px 0 0 0">
          <a href="${linkUrl}" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Ver estado de mi solicitud</a>
        </div>

        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Este es un correo automatico, por favor no responder a este mensaje.</p>
      </div>
    </div>
  `;
  return { subject, html };
}

/** Alerta al administrador cuando un cliente registra una solicitud de reserva. */
export function buildAdminNotificacionEmail(datos: {
  standCodes: string;
  razonSocial: string;
  documento: string;
  emailCliente: string;
  solicitudId?: string;
}): { subject: string; html: string } {
  const stands = datos.standCodes.split(",").map((s) => s.trim()).filter(Boolean);
  const subject = `Nueva solicitud de reserva (${stands.length} ${stands.length === 1 ? "stand" : "stands"}) — ${datos.razonSocial}`;
  const link = datos.solicitudId
    ? `${APP_URL}/dashboard/solicitudes?id=${encodeURIComponent(datos.solicitudId)}`
    : `${APP_URL}/dashboard/solicitudes`;
  const chips = stands
    .map(
      (s) =>
        `<span style="display:inline-block;background:#EEF2F8;color:#1B365D;border:1px solid #D6DEEA;border-radius:4px;padding:5px 9px;margin:0 6px 6px 0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;font-weight:700">${esc(s)}</span>`,
    )
    .join("");

  const html = `
  <div style="margin:0;padding:0;background:#F8FAFC">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden">Nueva solicitud de ${esc(datos.razonSocial)} para ${esc(datos.standCodes)}. Requiere tu revision.</span>
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px 16px;color:#191C1E">
      <div style="background:#1B365D;border-radius:12px 12px 0 0;padding:18px 24px">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="vertical-align:middle">
              <span style="display:inline-block;background:#FFFFFF;color:#1B365D;font-weight:800;font-size:12px;letter-spacing:.08em;padding:6px 8px;border-radius:6px">IIMP</span>
              <span style="color:#FFFFFF;font-weight:600;font-size:14px;margin-left:10px">Contratos Stands</span>
            </td>
            <td align="right" style="color:#AEC7F7;font-size:11px;text-transform:uppercase;letter-spacing:.12em;white-space:nowrap">Notificacion interna</td>
          </tr>
        </table>
      </div>

      <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-top:0;border-radius:0 0 12px 12px;padding:28px 24px">
        <span style="display:inline-block;background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;border-radius:999px;font-size:11px;font-weight:700;padding:4px 10px">Requiere revision</span>

        <h1 style="margin:14px 0 6px;font-size:22px;line-height:1.25;color:#1B365D">Nueva solicitud de reserva</h1>
        <p style="margin:0;color:#64748B;font-size:14px;line-height:1.55">Un cliente registro una solicitud de reserva de stands. Ingresa al panel para revisarla y continuar con el proceso.</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0 6px;font-size:14px">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B;width:40%">Razon social</td>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-weight:600">${esc(datos.razonSocial)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B">Documento</td>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-weight:600">${esc(datos.documento)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B">Correo del cliente</td>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-weight:600">${esc(datos.emailCliente)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#64748B">Stands solicitados</td>
            <td style="padding:10px 0;font-weight:600">${stands.length}</td>
          </tr>
        </table>

        <div style="margin:6px 0 20px">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#64748B">Detalle de stands</p>
          ${chips}
        </div>

        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 16px;margin:0 0 22px">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#64748B">Siguiente paso</p>
          <ol style="margin:0;padding-left:18px;color:#334155;font-size:13px;line-height:1.6">
            <li>Revisa la solicitud y la disponibilidad de los stands.</li>
            <li>Gestiona el contrato y la documentacion en el panel.</li>
            <li>Da seguimiento al flujo de revision.</li>
          </ol>
        </div>

        <div style="text-align:center">
          <a href="${link}" style="display:inline-block;background:#B8860B;color:#FFFFFF;padding:13px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700">Revisar en el panel</a>
        </div>
      </div>

      <p style="color:#94A3B8;font-size:12px;text-align:center;margin:16px 0 0">Correo automatico del sistema de Contratos de Stands — IIMP. No responder a este mensaje.</p>
    </div>
  </div>`;
  return { subject, html };
}
