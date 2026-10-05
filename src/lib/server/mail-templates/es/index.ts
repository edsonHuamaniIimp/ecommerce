import { INVITACION_CUENTA_MINUTOS_VIGENCIA, REGISTRO_CODIGO, RESULTADOS_APROBACION, TIPOS_COMPROBANTE } from "@/lib/shared/constants";
import { getAppUrl } from "@/lib/server/app-url";
import { PIE_ES, envoltura, esc, fila } from "../i18n";
import type { PlantillasEmail } from "../tipos";

/** Plantillas de correo en espanol (idioma por defecto). */
export const plantillasEs: PlantillasEmail = {
  "codigo-registro": ({ codigo, nombre }) => ({
    subject: "Codigo de verificacion - IIMP Contratos Stands",
    html: envoltura(
      "Verificacion de cuenta",
      `
        <p>Hola ${esc(nombre)},</p>
        <p>Usa este codigo para completar el registro de tu cuenta de exhibidor:</p>
        <div style="text-align:center;margin:24px 0">
          <span style="display:inline-block;letter-spacing:8px;font-size:32px;font-weight:700;color:#1b365d;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:14px 24px">${esc(codigo)}</span>
        </div>
        <p>El codigo vence en ${REGISTRO_CODIGO.MINUTOS_VIGENCIA} minutos. Si no solicitaste esta cuenta, ignora este mensaje.</p>
      `,
      PIE_ES,
    ),
  }),

  "reset-password": ({ nombre, url, minutos }) => ({
    subject: "Restablecer contrasena - IIMP Contratos Stands",
    html: envoltura(
      "Restablecer contrasena",
      `
        <p>${nombre ? `Hola ${esc(nombre)},` : "Hola,"}</p>
        <p>Recibimos una solicitud para restablecer tu contrasena. Crea una nueva con el siguiente enlace:</p>
        <div style="text-align:center;margin:20px 0">
          <a href="${url}" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Restablecer contrasena</a>
        </div>
        <p style="font-size:13px;color:#475569">El enlace expira en ${minutos} minutos. Si no lo solicitaste, ignora este mensaje.</p>
      `,
      PIE_ES,
    ),
  }),

  "credenciales-empresa": ({ razonSocial, nombreContacto, email, passwordTemporal }) => ({
    subject: "Tus credenciales del Portal del Cliente - IIMP",
    html: envoltura(
      "Credenciales de acceso",
      `
        <p>Hola${nombreContacto ? ` ${esc(nombreContacto)}` : ""}, habilitamos la cuenta del Portal del Cliente para <strong>${esc(razonSocial)}</strong>.</p>
        <p>Estas son tus credenciales de acceso:</p>
        <table style="width:100%;border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;margin:16px 0">
          <tr>
            <td style="padding:10px 14px;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0">Usuario</td>
            <td style="padding:10px 14px;font-size:14px;font-weight:600">${esc(email)}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-size:13px;color:#475569">Contrasena temporal</td>
            <td style="padding:10px 14px;font-size:14px;font-weight:600;font-family:Menlo,Consolas,monospace;letter-spacing:1px">${esc(passwordTemporal)}</td>
          </tr>
        </table>
        <div style="text-align:center;margin:20px 0">
          <a href="${getAppUrl()}/auth/login" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ingresar al portal</a>
        </div>
        <p style="font-size:13px;color:#475569">En tu primer ingreso te pediremos <strong>cambiar la contrasena</strong> y validar los datos de tu empresa (razon social, RUC, direccion y representante legal), que se usaran para generar el contrato.</p>
        <p style="font-size:13px;color:#475569">Si no reconoces esta cuenta, contacta a la Mesa de Ayuda del IIMP.</p>
      `,
      PIE_ES,
    ),
  }),

  "notificacion-solicitud-cuenta": (datos) => ({
    subject: `Nueva solicitud de cuenta - ${datos.razonSocial}`,
    html: envoltura(
      "Solicitud de cuenta de exhibidor",
      `
        <p>Un nuevo exhibidor solicito acceso al portal de reserva de stands.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          ${fila("Razon social", esc(datos.razonSocial))}
          ${fila("Contacto", esc(`${datos.nombre} ${datos.apellidos}`))}
          ${fila("Correo", esc(datos.email))}
          ${datos.ruc ? fila("RUC", esc(datos.ruc)) : ""}
          ${datos.telefono ? fila("Telefono", esc(datos.telefono)) : ""}
          ${datos.cargo ? fila("Cargo", esc(datos.cargo)) : ""}
        </table>
        ${datos.mensaje ? `<p style="font-size:13px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">${esc(datos.mensaje)}</p>` : ""}
        <div style="text-align:center;margin:20px 0 0 0">
          <a href="${getAppUrl()}/dashboard/roles" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Revisar solicitud</a>
        </div>
      `,
      PIE_ES,
    ),
  }),

  "invitacion-cuenta": ({ nombre, razonSocial, token }) => {
    const url = `${getAppUrl()}/auth/recuperar/${token}`;
    return {
      subject: "Tu cuenta de exhibidor fue habilitada - IIMP",
      html: envoltura(
        "Cuenta habilitada",
        `
          <p>Hola ${esc(nombre)}, tu cuenta de exhibidor para <strong>${esc(razonSocial)}</strong> fue habilitada.</p>
          <p>Para ingresar al portal, crea tu contrasena con el siguiente enlace:</p>
          <div style="text-align:center;margin:20px 0">
            <a href="${url}" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Crear mi contrasena</a>
          </div>
          <p style="font-size:13px;color:#475569">El enlace expira en ${INVITACION_CUENTA_MINUTOS_VIGENCIA} minutos. Si vence, solicita uno nuevo desde <strong>Recuperar contrasena</strong>.</p>
        `,
        PIE_ES,
      ),
    };
  },

  "rechazo-cuenta": ({ nombre, razonSocial, motivo }) => ({
    subject: "Solicitud de cuenta rechazada - IIMP",
    html: envoltura(
      "Solicitud de cuenta",
      `
        <p>Hola ${esc(nombre)}, revisamos tu solicitud de cuenta para <strong>${esc(razonSocial)}</strong>.</p>
        <p style="font-size:14px;color:#dc2626;font-weight:600">En esta ocasion no pudimos habilitarla.</p>
        ${motivo ? `<p style="font-size:13px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px"><strong>Motivo:</strong> ${esc(motivo)}</p>` : ""}
        <p style="font-size:13px;color:#475569">Si consideras que fue un error, responde a este correo o contacta a la Mesa de Ayuda del IIMP.</p>
      `,
      PIE_ES,
    ),
  }),

  "reserva-confirmacion": ({ standCodes, razonSocial, documento, esMultiple, solicitudId }) => {
    const linkUrl = solicitudId
      ? `${getAppUrl()}/dashboard/mis-solicitudes?id=${encodeURIComponent(solicitudId)}`
      : `${getAppUrl()}/dashboard/mis-solicitudes`;
    const subject = esMultiple
      ? "Solicitud multiple registrada - IIMP Contratos Stands"
      : "Reserva de stands registrada - IIMP Contratos Stands";

    const paso = (numero: string, color: string, titulo: string, tituloColor: string, texto: string, ultimo = false) => `
      <tr>
        <td style="vertical-align:top;padding:0 0 ${ultimo ? "0" : "12px"} 0;text-align:center;width:36px">
          <span style="display:inline-block;width:28px;height:28px;background:${color};color:#fff;border-radius:50%;line-height:28px;font-size:13px;font-weight:700">${numero}</span>
        </td>
        <td style="padding:0 0 ${ultimo ? "0" : "12px"} 8px">
          <p style="margin:0;font-size:13px;font-weight:600;color:${tituloColor}">${titulo}</p>
          <p style="margin:2px 0 0 0;font-size:12px;color:#64748b">${texto}</p>
        </td>
      </tr>`;

    const flowSteps = esMultiple
      ? `
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0">
        <p style="font-weight:700;color:#0369a1;font-size:14px;margin:0 0 12px 0">Como continuar con tu solicitud multiple:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%">
          ${paso("1", "#0ea5e9", "El administrador subira el contrato", "#0c4a6e", "La administracion del IIMP adjuntara el formato de contrato oficial a tu solicitud. Recibiras un correo cuando este listo.")}
          ${paso("2", "#f59e0b", "Descarga, completa y adjunta tus documentos", "#92400e", "Ingresa a <strong>Mis solicitudes</strong> en el dashboard, descarga el contrato, completalo y adjunta los documentos requeridos para continuar.")}
          ${paso("3", "#8b5cf6", "Revision por las areas del IIMP", "#5b21b6", "Las areas del IIMP revisaran tu documentacion y emitiran su veredicto.")}
          ${paso("4", "#059669", "Resultado final", "#065f46", "Recibiras un correo con el resultado. Si es rechazada, podras solicitar una re-evaluacion adjuntando nuevos documentos.", true)}
        </table>
        <p style="margin:16px 0 0 0;font-size:12px;color:#0369a1;font-style:italic">Puedes monitorear el estado de tu solicitud en cualquier momento desde <strong>Mis solicitudes</strong> en el dashboard.</p>
      </div>`
      : `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
        <p style="font-weight:700;color:#15803d;font-size:14px;margin:0 0 12px 0">Proximos pasos:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%">
          ${paso("1", "#16a34a", "Revision por las areas del IIMP", "#14532d", "Las areas del IIMP revisaran tu solicitud y documentacion.")}
          ${paso("!", "#dc2626", "En caso de rechazo", "#991b1b", "Si alguna area rechaza tu solicitud, recibiras un correo con los motivos y podras solicitar una re-evaluacion.", true)}
        </table>
        <p style="margin:16px 0 0 0;font-size:12px;color:#15803d;font-style:italic">El stand permanecera en estado <strong>En evaluacion</strong> hasta que todas las areas emitan su veredicto.</p>
      </div>`;

    return {
      subject,
      html: `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
      <div style="background:#059669;padding:16px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">IIMP - Contratos Stands</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        <h2 style="color:#059669;margin-top:0">${esMultiple ? "Solicitud multiple registrada" : "Reserva registrada"}</h2>
        <p>Hola, tu solicitud de reserva ha sido registrada exitosamente.</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Stands</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${esc(standCodes)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Razon social</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${esc(razonSocial)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Documento</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${esc(documento)}</td></tr>
        </table>

        ${flowSteps}

        <div style="text-align:center;margin:20px 0 0 0">
          <a href="${linkUrl}" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Ver estado de mi solicitud</a>
        </div>

        <p style="color:#94a3b8;font-size:12px;margin-top:24px">${PIE_ES}</p>
      </div>
    </div>
  `,
    };
  },

  "reserva-admin": ({ standCodes, razonSocial, documento, emailCliente, solicitudId }) => {
    const stands = standCodes.split(",").map((s) => s.trim()).filter(Boolean);
    const subject = `Nueva solicitud de reserva (${stands.length} ${stands.length === 1 ? "stand" : "stands"}) - ${razonSocial}`;
    const link = solicitudId
      ? `${getAppUrl()}/dashboard/solicitudes?id=${encodeURIComponent(solicitudId)}`
      : `${getAppUrl()}/dashboard/solicitudes`;
    const chips = stands
      .map(
        (s) =>
          `<span style="display:inline-block;background:#EEF2F8;color:#1B365D;border:1px solid #D6DEEA;border-radius:4px;padding:5px 9px;margin:0 6px 6px 0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;font-weight:700">${esc(s)}</span>`,
      )
      .join("");

    return {
      subject,
      html: `
  <div style="margin:0;padding:0;background:#F8FAFC">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden">Nueva solicitud de ${esc(razonSocial)} para ${esc(standCodes)}. Requiere tu revision.</span>
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
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-weight:600">${esc(razonSocial)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B">Documento</td>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-weight:600">${esc(documento)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B">Correo del cliente</td>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-weight:600">${esc(emailCliente)}</td>
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

      <p style="color:#94A3B8;font-size:12px;text-align:center;margin:16px 0 0">Correo automatico del sistema de Contratos de Stands - IIMP. No responder a este mensaje.</p>
    </div>
  </div>`,
    };
  },

  "revision-resultado": (opts) => {
    const rechazada = opts.revisiones.some((r) => r.estado === RESULTADOS_APROBACION.RECHAZADO);
    const totalmenteAprobada = opts.revisiones.every((r) => r.estado === RESULTADOS_APROBACION.APROBADO);
    const titulo = totalmenteAprobada ? "Solicitud aprobada" : rechazada ? "Solicitud rechazada" : "Resultado de revision";
    const saludo = opts.nombre && opts.nombre !== "-" ? opts.nombre : "Estimad@";

    let cuerpo: string;
    if (opts.modo === "personalizado" && opts.mensaje) {
      cuerpo = `<div style="padding:8px 0 0 0;font-size:14px;color:#334155;line-height:1.7">
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px 0">
          Se ha completado la revision de su solicitud de alquiler para el stand <strong style="color:#1e293b">${esc(opts.standCode)}</strong>.
        </p>
        ${opts.mensaje}
      </div>`;
    } else if (totalmenteAprobada) {
      cuerpo = `<div style="padding:8px 0 16px 0">
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px 0">
          Se ha completado la revision de su solicitud para el stand <strong style="color:#1e293b">${esc(opts.standCode)}</strong>.
        </p>
        <p style="font-size:14px;color:#16a34a;font-weight:600;line-height:1.6;margin:0">
          Tu solicitud ha sido <strong>aprobada</strong> por todas las areas del IIMP.
        </p>
      </div>`;
    } else if (rechazada) {
      cuerpo = `<div style="padding:8px 0 16px 0">
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px 0">
          Se ha completado la revision de su solicitud para el stand <strong style="color:#1e293b">${esc(opts.standCode)}</strong>.
        </p>
        <p style="font-size:14px;color:#dc2626;font-weight:600;line-height:1.6;margin:0">
          Lamentamos informarte que tu solicitud no ha sido aprobada en esta ocasion.
        </p>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:8px 0 0 0">
          Puedes solicitar una <strong>re-evaluacion</strong> desde la seccion Mis solicitudes adjuntando documentacion adicional.
        </p>
      </div>`;
    } else {
      cuerpo = `<div style="padding:8px 0 16px 0">
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0">
          Tu solicitud para el stand <strong style="color:#1e293b">${esc(opts.standCode)}</strong> se encuentra en proceso de revision.
        </p>
      </div>`;
    }

    return {
      subject: `${titulo} - Stand ${opts.standCode}`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
  <tr>
    <td style="background:linear-gradient(135deg,#1e293b,#334155);padding:24px 32px">
      <table cellpadding="0" cellspacing="0" style="width:100%">
        <tr>
          <td><span style="display:inline-block;background:rgba(255,255,255,0.15);color:#ffffff;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:0.5px">IIMP</span></td>
          <td style="text-align:right"><span style="color:#94a3b8;font-size:11px">Contratos de Stands</span></td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:${rechazada ? "0" : "28px"} 32px 0 32px">
      ${rechazada ? `<table cellpadding="0" cellspacing="0" style="width:100%;background:#fef2f2;border-bottom:2px solid #fecaca;padding:16px 32px">
        <tr>
          <td style="padding:16px 0 4px 0">
            <span style="display:inline-block;background:#dc2626;color:#ffffff;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700">RECHAZADA</span>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 16px 0;font-size:18px;font-weight:700;color:#991b1b">Tu solicitud ha sido rechazada</td>
        </tr>
      </table>` : ""}
      <p style="margin:${rechazada ? "16px" : "0"} 0 8px 0;font-size:14px;color:#64748b">${esc(saludo)},</p>
      <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#0f172a">${titulo}</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:8px;padding:12px 16px">
        <tr>
          <td style="font-size:13px;color:#64748b">Stand: <strong style="color:#1e293b">${esc(opts.standCode)}</strong></td>
          <td style="text-align:right;font-size:13px;color:#64748b">${esc(opts.empresa && opts.empresa !== "-" ? opts.empresa : opts.email)}</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 32px 24px 32px">
      ${cuerpo}
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 20px 32px;text-align:center">
      <a href="${getAppUrl()}/dashboard/mis-solicitudes?id=${encodeURIComponent(opts.gessStandId)}" style="display:inline-block;background:#1e293b;color:#ffffff;border-radius:999px;padding:10px 28px;font-size:13px;font-weight:600;text-decoration:none">Ver estado de mi solicitud</a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 28px 32px">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e2e8f0;padding-top:20px">
        <tr>
          <td style="font-size:11px;color:#94a3b8;line-height:1.5">
            Este es un correo automatico generado por el Sistema de Contratos de Stands del IIMP.<br/>
            Si tienes dudas, contacta a tu ejecutivo asignado.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`,
    };
  },

  "comprobante-pago": ({ standCode, tipo, numero }) => {
    const label = tipo === TIPOS_COMPROBANTE.FACTURA ? "Factura" : "Boleta";
    return {
      subject: `Comprobante de pago (${label} ${numero}) - IIMP Contratos Stands`,
      html: envoltura(
        "Comprobante de pago disponible",
        `
        <p>Facturacion adjunto el comprobante de tu pago:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          ${fila("Stand", esc(standCode))}
          ${fila("Comprobante", esc(`${label} ${numero}`))}
        </table>
        <div style="text-align:center;margin:20px 0">
          <a href="${getAppUrl()}/dashboard/mis-pagos" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Ver mis pagos</a>
        </div>
        <p style="font-size:13px;color:#475569">Puedes verlo y descargarlo desde el Portal del Cliente.</p>
      `,
        PIE_ES,
      ),
    };
  },
};
