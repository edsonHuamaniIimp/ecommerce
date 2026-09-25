/**
 * Preview del correo al administrador (nueva solicitud de reserva).
 * Uso: npx tsx --conditions=react-server scripts/preview-admin-email.ts
 * Destino: PREVIEW_TO (default ext_analistaprogramador3@iimp.org.pe).
 */
import "dotenv/config";
import { sendEmail } from "@/lib/server/email";
import { buildAdminNotificacionEmail } from "@/lib/server/mail-templates/reservas-email-templates";

const TO = process.env.PREVIEW_TO ?? "ext_analistaprogramador3@iimp.org.pe";

async function main() {
  const { subject, html } = buildAdminNotificacionEmail({
    standCodes: "A-12, B-04, C-07",
    razonSocial: "Minera Andina del Sur S.A.C.",
    documento: "RUC 20512345678",
    emailCliente: "compras@mineraandina.pe",
    solicitudId: "preview-0001",
  });

  const ok = await sendEmail({ to: TO, subject: `[PREVIEW] ${subject}`, html });
  console.log(`sendEmail ok=${ok} to=${TO}`);
  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
