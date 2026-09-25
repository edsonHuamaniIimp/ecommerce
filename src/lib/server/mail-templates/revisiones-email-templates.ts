import 'server-only';

import { RESULTADOS_APROBACION, APP_URL } from "@/lib/shared/constants";

/**
 * Plantillas de correo del flujo de revisiones (resultado de revision por areas).
 * Convencion (ref. montaje-iimp `lib/server/mail-templates/`): el HTML vive AQUI.
 */

interface RevisionEmailOpts {
  standCode: string;
  empresa: string;
  nombre: string;
  email: string;
  gessStandId: string;
  modo: "automatico" | "personalizado";
  mensaje?: string;
  revisiones: { area: string; estado: string; comentario: string | null }[];
}

function buildBody(opts: RevisionEmailOpts) {
  if (opts.modo === "personalizado" && opts.mensaje) {
    return `<div style="padding:8px 0 0 0;font-size:14px;color:#334155;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px 0">
          Se ha completado la revision de su solicitud de alquiler para el stand <strong style="color:#1e293b">${opts.standCode}</strong>.
        </p>
        ${opts.mensaje}
      </div>`;
  }
  const algunaRechazada = opts.revisiones.some((r) => r.estado === RESULTADOS_APROBACION.RECHAZADO);
  const todasAprobadas = opts.revisiones.every((r) => r.estado === RESULTADOS_APROBACION.APROBADO);
  if (todasAprobadas) {
    return `<div style="padding:8px 0 16px 0">
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px 0">
          Se ha completado la revision de su solicitud para el stand <strong style="color:#1e293b">${opts.standCode}</strong>.
        </p>
        <p style="font-size:14px;color:#16a34a;font-weight:600;line-height:1.6;margin:0">
          Tu solicitud ha sido <strong>aprobada</strong> por todas las areas del IIMP.
        </p>
      </div>`;
  }
  if (algunaRechazada) {
    return `<div style="padding:8px 0 16px 0">
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px 0">
          Se ha completado la revision de su solicitud para el stand <strong style="color:#1e293b">${opts.standCode}</strong>.
        </p>
        <p style="font-size:14px;color:#dc2626;font-weight:600;line-height:1.6;margin:0">
          Lamentamos informarte que tu solicitud no ha sido aprobada en esta ocasion.
        </p>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:8px 0 0 0">
          Puedes solicitar una <strong>re-evaluacion</strong> desde la seccion Mis solicitudes adjuntando documentacion adicional.
        </p>
      </div>`;
  }
  return `<div style="padding:8px 0 16px 0">
      <p style="font-size:14px;color:#475569;line-height:1.6;margin:0">
        Tu solicitud para el stand <strong style="color:#1e293b">${opts.standCode}</strong> se encuentra en proceso de revision.
      </p>
    </div>`;
}

export function buildRevisionEmail(opts: RevisionEmailOpts) {
  const rechazada = opts.revisiones.some((r) => r.estado === RESULTADOS_APROBACION.RECHAZADO);
  const totalmenteAprobada = opts.revisiones.every((r) => r.estado === RESULTADOS_APROBACION.APROBADO);
  const titulo = totalmenteAprobada ? "Solicitud aprobada" : rechazada ? "Solicitud rechazada" : "Resultado de revision";
  const saludo = opts.nombre !== "—" && opts.nombre !== "Estimado usuario" ? opts.nombre : "Estimad@";
  const cuerpo = buildBody(opts);

  return {
    subject: `${titulo} — Stand ${opts.standCode}`,
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
      <p style="margin:${rechazada ? "16px" : "0"} 0 8px 0;font-size:14px;color:#64748b">${saludo},</p>
      <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#0f172a">${titulo}</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-radius:8px;padding:12px 16px">
        <tr>
          <td style="font-size:13px;color:#64748b">Stand: <strong style="color:#1e293b">${opts.standCode}</strong></td>
          <td style="text-align:right;font-size:13px;color:#64748b">${opts.empresa !== "—" ? opts.empresa : opts.email}</td>
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
      <a href="${APP_URL}/dashboard/mis-solicitudes?id=${opts.gessStandId}" style="display:inline-block;background:#1e293b;color:#ffffff;border-radius:999px;padding:10px 28px;font-size:13px;font-weight:600;text-decoration:none">Ver estado de mi solicitud</a>
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
}
