import 'server-only';

import { getPlantillaEmail } from "@/lib/server/mail-templates";
import type { DatosPlantilla, PlantillaEmailKind } from "@/lib/server/mail-templates";

const RESEND_API_URL = "https://api.resend.com/emails";

const API_KEY = process.env.RESEND_API_KEY;

/**
 * Plantillas que nunca deben redirigirse al correo de notificaciones:
 * son de seguridad/cuenta y deben ir al correo de acceso original.
 */
const PLANTILLAS_SIN_REDIRECCION: ReadonlySet<PlantillaEmailKind> = new Set([
  "codigo-registro",
  "reset-password",
  "credenciales-empresa",
  "invitacion-cuenta",
  "rechazo-cuenta",
  "notificacion-solicitud-cuenta",
  "notificacion-verificacion",
]);

/**
 * Resuelve el correo de notificaciones verificado del usuario.
 * Si el destinatario es el correo de acceso, representante o contacto de una
 * empresa, se usa la preferencia verificada; si no existe, se conserva `to`.
 */
async function resolverDestinoNotificacion(to: string, plantilla: PlantillaEmailKind): Promise<string> {
  if (PLANTILLAS_SIN_REDIRECCION.has(plantilla)) return to;
  const normalizado = to.trim().toLowerCase();
  if (!normalizado) return to;
  try {
    const { prisma } = await import("./db");
    const directo = await prisma.userRole.findFirst({
      where: {
        email: normalizado,
        notificationEmail: { not: null },
        notificationEmailVerifiedAt: { not: null },
      },
      select: { notificationEmail: true },
    });
    if (directo?.notificationEmail) return directo.notificationEmail;

    const empresa = await prisma.empresa.findFirst({
      where: {
        OR: [
          { representanteCorreo: normalizado },
          { emailContacto: normalizado },
          { emailFacturacion: normalizado },
        ],
      },
      select: { id: true },
    });
    if (!empresa) return to;

    const usuario = await prisma.userRole.findFirst({
      where: {
        empresaId: empresa.id,
        notificationEmail: { not: null },
        notificationEmailVerifiedAt: { not: null },
      },
      select: { notificationEmail: true },
    });
    return usuario?.notificationEmail ?? to;
  } catch {
    return to;
  }
}

/**
 * Remitente de los correos transaccionales (runtime):
 * EMAIL_FROM (ej. "no-reply@iimp.org.pe") > ADMIN_EMAIL > fallback historico.
 * La direccion debe pertenecer al dominio verificado en Resend.
 */
function getRemitente(): string {
  return process.env.EMAIL_FROM ?? process.env.ADMIN_EMAIL ?? "ext_analistaprogramador3@iimp.org.pe";
}

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
        from: `Contratos Stands IIMP <${getRemitente()}>`,
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

/**
 * Envia un correo resolviendo la plantilla del idioma indicado
 * (`mail-templates/es` o `mail-templates/en`, fallback español).
 */
export async function enviarEmailPlantilla<K extends PlantillaEmailKind>(params: {
  to: string;
  plantilla: K;
  idioma: string | null | undefined;
  datos: DatosPlantilla[K];
}): Promise<boolean> {
  const to = await resolverDestinoNotificacion(params.to, params.plantilla);
  const { subject, html } = getPlantillaEmail(params.plantilla, params.idioma, params.datos);
  return sendEmail({ to, subject, html });
}
