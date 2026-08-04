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
}): { subject: string; html: string } {
  const subject = datos.esMultiple
    ? "Solicitud multiple registrada — IIMP Contratos Stands"
    : "Reserva de stands registrada — IIMP Contratos Stands";
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

        <p style="color:#64748b;font-size:13px">El stand pasa a estado <strong>En evaluacion</strong>. Recibiras una notificacion cuando el flujo de aprobaciones concluya.</p>
        ${datos.esMultiple ? `<p style="color:#64748b;font-size:13px">La administracion del IIMP te enviara el <strong>formato de contrato</strong> a tu correo. Deberas completarlo y reenviarlo para continuar con el proceso de alquiler de stands.</p>` : ""}
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

        <a href="https://contratosstands.sistemasiimp.org.pe/dashboard/reservas" style="display:inline-block;background:#059669;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Ver en el dashboard</a>

        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Este es un correo automatico, por favor no responder a este mensaje.</p>
      </div>
    </div>
  `;
  return { subject, html };
}
