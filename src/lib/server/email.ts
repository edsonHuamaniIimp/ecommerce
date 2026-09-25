import 'server-only';

const RESEND_API_URL = "https://api.resend.com/emails";

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.ADMIN_EMAIL ?? "ext_analistaprogramador3@iimp.org.pe";

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envio de correo transaccional (Resend).
 * Las PLANTILLAS viven en `lib/server/mail-templates/` (una por modulo), no aqui.
 */
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
