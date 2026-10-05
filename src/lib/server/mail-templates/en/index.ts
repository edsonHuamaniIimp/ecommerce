import { INVITACION_CUENTA_MINUTOS_VIGENCIA, REGISTRO_CODIGO, RESULTADOS_APROBACION, TIPOS_COMPROBANTE } from "@/lib/shared/constants";
import { getAppUrl } from "@/lib/server/app-url";
import { PIE_EN, envoltura, esc, fila } from "../i18n";
import type { PlantillasEmail } from "../tipos";

/** Plantillas de correo en ingles (misma estructura y marca que espanol). */
export const plantillasEn: PlantillasEmail = {
  "codigo-registro": ({ codigo, nombre }) => ({
    subject: "Verification code - IIMP Contratos Stands",
    html: envoltura(
      "Account verification",
      `
        <p>Hi ${esc(nombre)},</p>
        <p>Use this code to complete the registration of your exhibitor account:</p>
        <div style="text-align:center;margin:24px 0">
          <span style="display:inline-block;letter-spacing:8px;font-size:32px;font-weight:700;color:#1b365d;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:14px 24px">${esc(codigo)}</span>
        </div>
        <p>The code expires in ${REGISTRO_CODIGO.MINUTOS_VIGENCIA} minutes. If you did not request this account, please ignore this message.</p>
      `,
      PIE_EN,
    ),
  }),

  "reset-password": ({ nombre, url, minutos }) => ({
    subject: "Reset your password - IIMP Contratos Stands",
    html: envoltura(
      "Reset password",
      `
        <p>${nombre ? `Hi ${esc(nombre)},` : "Hello,"}</p>
        <p>We received a request to reset your password. Create a new one with the link below:</p>
        <div style="text-align:center;margin:20px 0">
          <a href="${url}" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Reset password</a>
        </div>
        <p style="font-size:13px;color:#475569">The link expires in ${minutos} minutes. If you did not request it, please ignore this message.</p>
      `,
      PIE_EN,
    ),
  }),

  "credenciales-empresa": ({ razonSocial, nombreContacto, email, passwordTemporal }) => ({
    subject: "Your Client Portal credentials - IIMP",
    html: envoltura(
      "Access credentials",
      `
        <p>Hi${nombreContacto ? ` ${esc(nombreContacto)}` : ""}, we enabled the Client Portal account for <strong>${esc(razonSocial)}</strong>.</p>
        <p>These are your access credentials:</p>
        <table style="width:100%;border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;margin:16px 0">
          <tr>
            <td style="padding:10px 14px;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0">Username</td>
            <td style="padding:10px 14px;font-size:14px;font-weight:600">${esc(email)}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-size:13px;color:#475569">Temporary password</td>
            <td style="padding:10px 14px;font-size:14px;font-weight:600;font-family:Menlo,Consolas,monospace;letter-spacing:1px">${esc(passwordTemporal)}</td>
          </tr>
        </table>
        <div style="text-align:center;margin:20px 0">
          <a href="${getAppUrl()}/auth/login" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Sign in to the portal</a>
        </div>
        <p style="font-size:13px;color:#475569">On your first sign-in you will be asked to <strong>change the password</strong> and validate your company data (legal name, RUC, address and legal representative), which will be used to generate the contract.</p>
        <p style="font-size:13px;color:#475569">If you do not recognize this account, please contact the IIMP Help Desk.</p>
      `,
      PIE_EN,
    ),
  }),

  "notificacion-solicitud-cuenta": (datos) => ({
    subject: `New account request - ${datos.razonSocial}`,
    html: envoltura(
      "Exhibitor account request",
      `
        <p>A new exhibitor requested access to the stand booking portal.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          ${fila("Legal name", esc(datos.razonSocial))}
          ${fila("Contact", esc(`${datos.nombre} ${datos.apellidos}`))}
          ${fila("Email", esc(datos.email))}
          ${datos.ruc ? fila("RUC", esc(datos.ruc)) : ""}
          ${datos.telefono ? fila("Phone", esc(datos.telefono)) : ""}
          ${datos.cargo ? fila("Position", esc(datos.cargo)) : ""}
        </table>
        ${datos.mensaje ? `<p style="font-size:13px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">${esc(datos.mensaje)}</p>` : ""}
        <div style="text-align:center;margin:20px 0 0 0">
          <a href="${getAppUrl()}/dashboard/roles" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Review request</a>
        </div>
      `,
      PIE_EN,
    ),
  }),

  "invitacion-cuenta": ({ nombre, razonSocial, token }) => {
    const url = `${getAppUrl()}/auth/recuperar/${token}`;
    return {
      subject: "Your exhibitor account is ready - IIMP",
      html: envoltura(
        "Account enabled",
        `
          <p>Hi ${esc(nombre)}, your exhibitor account for <strong>${esc(razonSocial)}</strong> has been enabled.</p>
          <p>To access the portal, create your password with the link below:</p>
          <div style="text-align:center;margin:20px 0">
            <a href="${url}" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Create my password</a>
          </div>
          <p style="font-size:13px;color:#475569">The link expires in ${INVITACION_CUENTA_MINUTOS_VIGENCIA} minutes. If it expires, request a new one from <strong>Forgot password</strong>.</p>
        `,
        PIE_EN,
      ),
    };
  },

  "rechazo-cuenta": ({ nombre, razonSocial, motivo }) => ({
    subject: "Account request rejected - IIMP",
    html: envoltura(
      "Account request",
      `
        <p>Hi ${esc(nombre)}, we reviewed your account request for <strong>${esc(razonSocial)}</strong>.</p>
        <p style="font-size:14px;color:#dc2626;font-weight:600">On this occasion we could not enable it.</p>
        ${motivo ? `<p style="font-size:13px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px"><strong>Reason:</strong> ${esc(motivo)}</p>` : ""}
        <p style="font-size:13px;color:#475569">If you believe this was a mistake, reply to this email or contact the IIMP Help Desk.</p>
      `,
      PIE_EN,
    ),
  }),

  "reserva-confirmacion": ({ standCodes, razonSocial, documento, esMultiple, solicitudId }) => {
    const linkUrl = solicitudId
      ? `${getAppUrl()}/dashboard/mis-solicitudes?id=${encodeURIComponent(solicitudId)}`
      : `${getAppUrl()}/dashboard/mis-solicitudes`;
    const subject = esMultiple
      ? "Multiple request registered - IIMP Contratos Stands"
      : "Stand booking registered - IIMP Contratos Stands";

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
        <p style="font-weight:700;color:#0369a1;font-size:14px;margin:0 0 12px 0">How to continue with your multiple request:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%">
          ${paso("1", "#0ea5e9", "The administrator will upload the contract", "#0c4a6e", "IIMP administration will attach the official contract template to your request. You will receive an email when it is ready.")}
          ${paso("2", "#f59e0b", "Download, complete and attach your documents", "#92400e", "Go to <strong>My bookings</strong> in the dashboard, download the contract, complete it and attach the required documents to continue.")}
          ${paso("3", "#8b5cf6", "Review by IIMP areas", "#5b21b6", "IIMP areas will review your documentation and issue their decision.")}
          ${paso("4", "#059669", "Final result", "#065f46", "You will receive an email with the result. If rejected, you may request a re-evaluation with new documents.", true)}
        </table>
        <p style="margin:16px 0 0 0;font-size:12px;color:#0369a1;font-style:italic">You can monitor your request status at any time from <strong>My bookings</strong> in the dashboard.</p>
      </div>`
      : `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
        <p style="font-weight:700;color:#15803d;font-size:14px;margin:0 0 12px 0">Next steps:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%">
          ${paso("1", "#16a34a", "Review by IIMP areas", "#14532d", "IIMP areas will review your request and documentation.")}
          ${paso("!", "#dc2626", "In case of rejection", "#991b1b", "If any area rejects your request, you will receive an email with the reasons and you may request a re-evaluation.", true)}
        </table>
        <p style="margin:16px 0 0 0;font-size:12px;color:#15803d;font-style:italic">The stand will remain <strong>Under evaluation</strong> until every area issues its decision.</p>
      </div>`;

    return {
      subject,
      html: `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
      <div style="background:#059669;padding:16px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">IIMP - Contratos Stands</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        <h2 style="color:#059669;margin-top:0">${esMultiple ? "Multiple request registered" : "Booking registered"}</h2>
        <p>Hello, your booking request was registered successfully.</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Stands</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${esc(standCodes)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Legal name</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${esc(razonSocial)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Document</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${esc(documento)}</td></tr>
        </table>

        ${flowSteps}

        <div style="text-align:center;margin:20px 0 0 0">
          <a href="${linkUrl}" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">View my request status</a>
        </div>

        <p style="color:#94a3b8;font-size:12px;margin-top:24px">${PIE_EN}</p>
      </div>
    </div>
  `,
    };
  },

  "reserva-admin": ({ standCodes, razonSocial, documento, emailCliente, solicitudId }) => {
    const stands = standCodes.split(",").map((s) => s.trim()).filter(Boolean);
    const subject = `New booking request (${stands.length} ${stands.length === 1 ? "stand" : "stands"}) - ${razonSocial}`;
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
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden">New request from ${esc(razonSocial)} for ${esc(standCodes)}. Review required.</span>
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px 16px;color:#191C1E">
      <div style="background:#1B365D;border-radius:12px 12px 0 0;padding:18px 24px">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="vertical-align:middle">
              <span style="display:inline-block;background:#FFFFFF;color:#1B365D;font-weight:800;font-size:12px;letter-spacing:.08em;padding:6px 8px;border-radius:6px">IIMP</span>
              <span style="color:#FFFFFF;font-weight:600;font-size:14px;margin-left:10px">Contratos Stands</span>
            </td>
            <td align="right" style="color:#AEC7F7;font-size:11px;text-transform:uppercase;letter-spacing:.12em;white-space:nowrap">Internal notification</td>
          </tr>
        </table>
      </div>

      <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-top:0;border-radius:0 0 12px 12px;padding:28px 24px">
        <span style="display:inline-block;background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;border-radius:999px;font-size:11px;font-weight:700;padding:4px 10px">Review required</span>

        <h1 style="margin:14px 0 6px;font-size:22px;line-height:1.25;color:#1B365D">New booking request</h1>
        <p style="margin:0;color:#64748B;font-size:14px;line-height:1.55">A client registered a stand booking request. Open the panel to review it and continue the process.</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0 6px;font-size:14px">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B;width:40%">Legal name</td>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-weight:600">${esc(razonSocial)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B">Document</td>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-weight:600">${esc(documento)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B">Client email</td>
            <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-weight:600">${esc(emailCliente)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#64748B">Requested stands</td>
            <td style="padding:10px 0;font-weight:600">${stands.length}</td>
          </tr>
        </table>

        <div style="margin:6px 0 20px">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#64748B">Stand detail</p>
          ${chips}
        </div>

        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 16px;margin:0 0 22px">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#64748B">Next step</p>
          <ol style="margin:0;padding-left:18px;color:#334155;font-size:13px;line-height:1.6">
            <li>Review the request and stand availability.</li>
            <li>Manage the contract and documentation in the panel.</li>
            <li>Follow up the review flow.</li>
          </ol>
        </div>

        <div style="text-align:center">
          <a href="${link}" style="display:inline-block;background:#B8860B;color:#FFFFFF;padding:13px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700">Review in the panel</a>
        </div>
      </div>

      <p style="color:#94A3B8;font-size:12px;text-align:center;margin:16px 0 0">Automated message from the IIMP Stand Contracts system. Do not reply.</p>
    </div>
  </div>`,
    };
  },

  "revision-resultado": (opts) => {
    const rechazada = opts.revisiones.some((r) => r.estado === RESULTADOS_APROBACION.RECHAZADO);
    const totalmenteAprobada = opts.revisiones.every((r) => r.estado === RESULTADOS_APROBACION.APROBADO);
    const titulo = totalmenteAprobada ? "Request approved" : rechazada ? "Request rejected" : "Review result";
    const saludo = opts.nombre && opts.nombre !== "-" ? opts.nombre : "Dear applicant";

    let cuerpo: string;
    if (opts.modo === "personalizado" && opts.mensaje) {
      cuerpo = `<div style="padding:8px 0 0 0;font-size:14px;color:#334155;line-height:1.7">
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px 0">
          The review of your rental request for stand <strong style="color:#1e293b">${esc(opts.standCode)}</strong> has been completed.
        </p>
        ${opts.mensaje}
      </div>`;
    } else if (totalmenteAprobada) {
      cuerpo = `<div style="padding:8px 0 16px 0">
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px 0">
          The review of your request for stand <strong style="color:#1e293b">${esc(opts.standCode)}</strong> has been completed.
        </p>
        <p style="font-size:14px;color:#16a34a;font-weight:600;line-height:1.6;margin:0">
          Your request has been <strong>approved</strong> by every IIMP area.
        </p>
      </div>`;
    } else if (rechazada) {
      cuerpo = `<div style="padding:8px 0 16px 0">
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px 0">
          The review of your request for stand <strong style="color:#1e293b">${esc(opts.standCode)}</strong> has been completed.
        </p>
        <p style="font-size:14px;color:#dc2626;font-weight:600;line-height:1.6;margin:0">
          We are sorry to inform you that your request was not approved on this occasion.
        </p>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:8px 0 0 0">
          You may request a <strong>re-evaluation</strong> from the My bookings section by attaching additional documentation.
        </p>
      </div>`;
    } else {
      cuerpo = `<div style="padding:8px 0 16px 0">
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0">
          Your request for stand <strong style="color:#1e293b">${esc(opts.standCode)}</strong> is under review.
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
          <td style="text-align:right"><span style="color:#94a3b8;font-size:11px">Stand Contracts</span></td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:${rechazada ? "0" : "28px"} 32px 0 32px">
      ${rechazada ? `<table cellpadding="0" cellspacing="0" style="width:100%;background:#fef2f2;border-bottom:2px solid #fecaca;padding:16px 32px">
        <tr>
          <td style="padding:16px 0 4px 0">
            <span style="display:inline-block;background:#dc2626;color:#ffffff;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700">REJECTED</span>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 16px 0;font-size:18px;font-weight:700;color:#991b1b">Your request has been rejected</td>
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
      <a href="${getAppUrl()}/dashboard/mis-solicitudes?id=${encodeURIComponent(opts.gessStandId)}" style="display:inline-block;background:#1e293b;color:#ffffff;border-radius:999px;padding:10px 28px;font-size:13px;font-weight:600;text-decoration:none">View my request status</a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 28px 32px">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e2e8f0;padding-top:20px">
        <tr>
          <td style="font-size:11px;color:#94a3b8;line-height:1.5">
            Automated message generated by the IIMP Stand Contracts System.<br/>
            If you have questions, contact your assigned executive.
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
    const label = tipo === TIPOS_COMPROBANTE.FACTURA ? "Invoice" : "Receipt";
    return {
      subject: `Payment document (${label} ${numero}) - IIMP Stand Contracts`,
      html: envoltura(
        "Payment document available",
        `
        <p>Billing attached the document for your payment:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          ${fila("Stand", esc(standCode))}
          ${fila("Document", esc(`${label} ${numero}`))}
        </table>
        <div style="text-align:center;margin:20px 0">
          <a href="${getAppUrl()}/dashboard/mis-pagos" style="display:inline-block;background:#1b365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">View my payments</a>
        </div>
        <p style="font-size:13px;color:#475569">You can view and download it from the Client Portal.</p>
      `,
        PIE_EN,
      ),
    };
  },
};
