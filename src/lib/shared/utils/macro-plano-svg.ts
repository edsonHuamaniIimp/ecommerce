/**
 * Overlay del "Mapa de pabellones" (macro) del anexo del contrato: resalta la(s)
 * seccion(es) del/los pabellon(es) involucrados sobre el fondo del macro.
 *
 * Util **pura** (sin IO): las secciones usan coordenadas normalizadas (0..1) del
 * plano macro, igual que `MacroMapaView`; si la seccion trae `puntos` (seccion libre)
 * se dibuja el poligono real, si no el rectangulo.
 */

export interface SeccionMacroDestacada {
  nombre: string;
  x: number;
  y: number;
  w: number;
  h: number;
  puntos?: Array<{ x: number; y: number }> | null;
}

const FILL = "#f59e0b";
const STROKE = "#92400e";
const TEXTO = "#7c2d12";
const CONTORNO = "#ffffff";

export function construirSvgMacro(ancho: number, alto: number, secciones: SeccionMacroDestacada[]): string {
  const grosor = Math.max(3, ancho * 0.0025);
  const formas = secciones
    .map((s) => {
      const pts = Array.isArray(s.puntos) && s.puntos.length >= 3 ? s.puntos : null;
      if (pts) {
        const puntos = pts.map((p) => `${fmt(p.x * ancho)},${fmt(p.y * alto)}`).join(" ");
        const cx = (pts.reduce((a, p) => a + p.x, 0) / pts.length) * ancho;
        const cy = (pts.reduce((a, p) => a + p.y, 0) / pts.length) * alto;
        const fs = tamanoTexto(s.w * ancho, s.h * alto);
        return (
          `<polygon points="${puntos}" fill="${FILL}" fill-opacity="0.35" stroke="${STROKE}" stroke-width="${fmt(grosor)}" stroke-linejoin="round"/>` +
          etiqueta(cx, cy, fs, s.nombre)
        );
      }
      const x = s.x * ancho;
      const y = s.y * alto;
      const rw = s.w * ancho;
      const rh = s.h * alto;
      const fs = tamanoTexto(rw, rh);
      return (
        `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(rw)}" height="${fmt(rh)}" rx="${fmt(Math.min(rw, rh) * 0.03)}" fill="${FILL}" fill-opacity="0.35" stroke="${STROKE}" stroke-width="${fmt(grosor)}"/>` +
        etiqueta(x + rw / 2, y + rh / 2, fs, s.nombre)
      );
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">${formas}</svg>`;
}

function tamanoTexto(ancho: number, alto: number): number {
  return Math.max(26, Math.min(ancho, alto) * 0.28);
}

function etiqueta(cx: number, cy: number, fs: number, texto: string): string {
  return `<text x="${fmt(cx)}" y="${fmt(cy + fs * 0.35)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fmt(fs)}" font-weight="700" fill="${TEXTO}" stroke="${CONTORNO}" stroke-width="${fmt(fs * 0.16)}" paint-order="stroke">${esc(texto)}</text>`;
}

function fmt(valor: number): string {
  return String(Math.round(valor * 1000) / 1000);
}

function esc(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
