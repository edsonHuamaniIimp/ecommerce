import { APP_URL, INVITACION_CUENTA_MINUTOS_VIGENCIA } from "../shared/constants";

interface SolicitudCuentaAdminEmailOpts {
  email: string;
  nombre: string;
  apellidos: string;
  razonSocial: string;
  ruc?: string | null;
  telefono?: string | null;
  cargo?: string | null;
  mensaje?: string | null;
}

function fila(etiqueta: string, valor: string): string {
  return `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">${etiqueta}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${valor}</td></tr>`;
}

/** Notificacion a RR.HH. cuando un exhibidor solicita una cuenta desde el portal. */
export function buildSolicitudCuentaAdminEmail(
  datos: SolicitudCuentaAdminEmailOpts,
): { subject: string; html: string } {
  const subject = `Nueva solicitud de cuenta — ${datos.razonSocial}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#0f172a">
      <div style="background:#1b365d;padding:16px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">IIMP — Solicitud de cuenta de exhibidor</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        <p>Un nuevo exhibidor solicito acceso al portal de reserva de stands.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          ${fila("Razon social", datos.razonSocial)}
          ${fila("Contacto", `${datos.nombre} ${datos.apellidos}`)}
          ${fila("Correo", datos.email)}
          ${datos.ruc ? fila("RUC", datos.ruc) : ""}
          ${datos.telefono ? fila("Telefono", datos.telefono) : ""}
          ${datos.cargo ? fila("Cargo", datos.cargo) : ""}
        </table>
        ${datos.mensaje ? `<p style="font-size:13px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">${datos.mensaje}</p>` : ""}
        <div style="text-align:center;margin:20px 0 0 0">
          <a href="${APP_URL}/dashboard/roles" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Revisar solicitud</a>
        </div>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Este es un correo automatico, por favor no responder a este mensaje.</p>
      </div>
    </div>
  `;
  return { subject, html };
}

function envoltura(titulo: string, contenido: string): string {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#0f172a">
      <div style="background:#1b365d;padding:16px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">IIMP — ${titulo}</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        ${contenido}
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Este es un correo automatico, por favor no responder a este mensaje.</p>
      </div>
    </div>
  `;
}

/** Invitacion al exhibidor aprobado para que defina su contrasena. */
export function buildInvitacionCuentaEmail(datos: {
  nombre: string;
  razonSocial: string;
  token: string;
}): { subject: string; html: string } {
  const url = `${APP_URL}/auth/recuperar/${datos.token}`;
  const contenido = `
    <p>Hola ${datos.nombre}, tu cuenta de exhibidor para <strong>${datos.razonSocial}</strong> fue habilitada.</p>
    <p>Para ingresar al portal, crea tu contrasena con el siguiente enlace:</p>
    <div style="text-align:center;margin:20px 0">
      <a href="${url}" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Crear mi contrasena</a>
    </div>
    <p style="font-size:13px;color:#475569">El enlace expira en ${INVITACION_CUENTA_MINUTOS_VIGENCIA} minutos. Si vence, solicita uno nuevo desde <strong>Recuperar contrasena</strong>.</p>
  `;
  return { subject: "Tu cuenta de exhibidor fue habilitada — IIMP", html: envoltura("Cuenta habilitada", contenido) };
}

/** Aviso al solicitante cuando su solicitud de cuenta es rechazada. */
export function buildRechazoCuentaEmail(datos: {
  nombre: string;
  razonSocial: string;
  motivo: string;
}): { subject: string; html: string } {
  const contenido = `
    <p>Hola ${datos.nombre}, revisamos tu solicitud de cuenta para <strong>${datos.razonSocial}</strong>.</p>
    <p style="font-size:14px;color:#dc2626;font-weight:600">En esta ocasion no pudimos habilitarla.</p>
    ${datos.motivo ? `<p style="font-size:13px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px"><strong>Motivo:</strong> ${datos.motivo}</p>` : ""}
    <p style="font-size:13px;color:#475569">Si consideras que fue un error, responde a este correo o contacta a la Mesa de Ayuda del IIMP.</p>
  `;
  return { subject: "Solicitud de cuenta rechazada — IIMP", html: envoltura("Solicitud de cuenta", contenido) };
}

