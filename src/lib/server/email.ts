import 'server-only';

import { APP_URL } from "../shared/constants";

const RESEND_API_URL = "https://api.resend.com/emails";

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.ADMIN_EMAIL ?? "ext_analistaprogramador3@iimp.org.pe";

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailParams): Promise<boolean> {
  if (!API_KEY) {
    console.warn("[email] RESEND_API_KEY no configurada — no se envio correo.");
    return false;
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Contratos Stands IIMP <${FROM}>`,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend error ${res.status}: ${body}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[email] Error al enviar correo:", err);
    return false;
  }
}

export function buildReservaConfirmationEmail(datos: {
  standCodes: string;
  razonSocial: string;
  documento: string;
  email: string;
  esMultiple?: boolean;
  solicitudId?: string;
}): { subject: string; html: string } {
  const linkUrl = datos.solicitudId ? `${APP_URL}/dashboard/mis-solicitudes?id=${datos.solicitudId}` : `${APP_URL}/dashboard/mis-solicitudes`;
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
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Stands</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${datos.standCodes}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Razon social</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${datos.razonSocial}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Documento</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${datos.documento}</td></tr>
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

export function buildAdminNotificacionEmail(datos: {
  standCodes: string;
  razonSocial: string;
  documento: string;
  emailCliente: string;
}): { subject: string; html: string } {
  const subject = `Nueva reserva — ${datos.standCodes} — ${datos.razonSocial}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
      <div style="background:#0f172a;padding:16px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">IIMP — Nueva Reserva</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        <p>Se ha registrado una nueva solicitud de reserva de stands.</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Stands</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${datos.standCodes}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Razon social</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${datos.razonSocial}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Documento</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${datos.documento}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Correo cliente</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${datos.emailCliente}</td></tr>
        </table>

        <a href="${APP_URL}/dashboard/reservas" style="display:inline-block;background:#059669;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Ver en el dashboard</a>

        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Este es un correo automatico, por favor no responder a este mensaje.</p>
      </div>
    </div>
  `;
  return { subject, html };
}
