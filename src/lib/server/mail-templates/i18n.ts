/** Escapa texto para interpolarlo en HTML. */
export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fila etiqueta/valor de las tablas de correo (misma estetica en todos los idiomas). */
export function fila(etiqueta: string, valor: string): string {
  return `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">${etiqueta}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">${valor}</td></tr>`;
}

/** Envoltura institucional base (IIMP navy) con pie localizado. */
export function envoltura(titulo: string, contenido: string, pie: string): string {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#0f172a">
      <div style="background:#1b365d;padding:16px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">IIMP - ${titulo}</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        ${contenido}
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">${pie}</p>
      </div>
    </div>
  `;
}

/** Pie de correo automatico. */
export const PIE_ES = "Este es un correo automatico, por favor no responder a este mensaje.";
export const PIE_EN = "This is an automated message, please do not reply.";
