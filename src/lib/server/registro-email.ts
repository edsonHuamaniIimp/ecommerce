import { REGISTRO_CODIGO } from "../shared/constants";

/** Correo con el codigo de verificacion para completar el registro de exhibidor. */
export function buildRegistroCodigoEmail(datos: { codigo: string; nombre: string }): { subject: string; html: string } {
  const subject = "Codigo de verificacion - IIMP Contratos Stands";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#0f172a">
      <div style="background:#1b365d;padding:16px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">IIMP - Verificacion de cuenta</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        <p>Hola ${datos.nombre},</p>
        <p>Usa este codigo para completar el registro de tu cuenta de exhibidor:</p>
        <div style="text-align:center;margin:24px 0">
          <span style="display:inline-block;letter-spacing:8px;font-size:32px;font-weight:700;color:#1b365d;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:14px 24px">${datos.codigo}</span>
        </div>
        <p>El codigo vence en ${REGISTRO_CODIGO.MINUTOS_VIGENCIA} minutos. Si no solicitaste esta cuenta, ignora este mensaje.</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Este es un correo automatico, por favor no responder a este mensaje.</p>
      </div>
    </div>
  `;
  return { subject, html };
}
