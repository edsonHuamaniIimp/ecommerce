import 'server-only';

import { APP_URL } from "@/lib/shared/constants";

/** Envoltura institucional comun de los correos (misma linea que solicitud-cuenta). */
function envoltura(titulo: string, contenido: string): string {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#0f172a">
      <div style="background:#1b365d;padding:16px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">IIMP - ${titulo}</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        ${contenido}
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Este es un correo automatico, por favor no responder a este mensaje.</p>
      </div>
    </div>
  `;
}

/** Credenciales de acceso al Portal del Cliente (cuenta creada por el backoffice). */
export function buildCredencialesEmpresaEmail(datos: {
  razonSocial: string;
  nombreContacto: string | null;
  email: string;
  passwordTemporal: string;
}): { subject: string; html: string } {
  const url = `${APP_URL}/auth/login`;
  const contenido = `
    <p>Hola${datos.nombreContacto ? ` ${datos.nombreContacto}` : ""}, habilitamos la cuenta del Portal del Cliente para <strong>${datos.razonSocial}</strong>.</p>
    <p>Estas son tus credenciales de acceso:</p>
    <table style="width:100%;border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;margin:16px 0">
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0">Usuario</td>
        <td style="padding:10px 14px;font-size:14px;font-weight:600">${datos.email}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#475569">Contrasena temporal</td>
        <td style="padding:10px 14px;font-size:14px;font-weight:600;font-family:Menlo,Consolas,monospace;letter-spacing:1px">${datos.passwordTemporal}</td>
      </tr>
    </table>
    <div style="text-align:center;margin:20px 0">
      <a href="${url}" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ingresar al portal</a>
    </div>
    <p style="font-size:13px;color:#475569">En tu primer ingreso te pediremos <strong>cambiar la contrasena</strong> y validar los datos de tu empresa (razon social, RUC, direccion y representante legal), que se usaran para generar el contrato.</p>
    <p style="font-size:13px;color:#475569">Si no reconoces esta cuenta, contacta a la Mesa de Ayuda del IIMP.</p>
  `;
  return { subject: "Tus credenciales del Portal del Cliente - IIMP", html: envoltura("Credenciales de acceso", contenido) };
}
