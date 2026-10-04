import type { PlanoBounds, PlanoItem } from "@/lib/shared/planos/registry";

/**
 * Recorte del plano (RF-08): viewBox del pabellon completo + SVG top-down con los
 * stands objetivo destacados. Util **pura**, compartida entre el portal
 * (`RecortePlano`) y la generacion server-side de la imagen del contrato.
 */

/** Opciones del SVG del recorte. */
export interface RecorteSvgOpciones {
  /** Etiqueta legible por codigo de tipo (leyenda). */
  etiquetas?: Record<string, string>;
  /** Oculta la leyenda de tipos. */
  sinLeyenda?: boolean;
}

const OBJETIVO_FILL = "#f59e0b";
const OBJETIVO_STROKE = "#92400e";
const OBJETIVO_HALO = "#fbbf24";

/** ViewBox del pabellon completo + margen porcentual. */
export function viewBoxConMargen(bounds: PlanoBounds, margenPct = 0.06): { x: number; y: number; w: number; h: number } {
  const w = Math.max(bounds.maxX - bounds.minX, 1);
  const h = Math.max(bounds.maxZ - bounds.minZ, 1);
  const mx = w * margenPct;
  const mz = h * margenPct;
  return { x: bounds.minX - mx, y: bounds.minZ - mz, w: w + mx * 2, h: h + mz * 2 };
}

/**
 * Construye el SVG (top-down) del pabellon completo destacando uno o varios stands
 * objetivo (reserva multiple: numerados 1..n). Devuelve `encontrado = false` si
 * ninguno de los objetivos esta en el plano.
 */
export function construirSvgRecorte(
  items: PlanoItem[],
  objetivoIds: string[],
  opciones: RecorteSvgOpciones = {},
): { svg: string; encontrado: boolean } {
  const objetivos = items.filter((it) => objetivoIds.includes(it.id));
  const encontrado = objetivos.length > 0;
  const vb = viewBoxConMargen(computeBounds(items));
  const refUnit = Math.max(vb.w, vb.h);
  const multiple = objetivos.length > 1;

  const bloques = items
    .map((it) => {
      const esObjetivo = objetivoIds.includes(it.id);
      const { w, d, color } = it.dim;
      const rot = it.rotY ?? 0;
      const halo = esObjetivo
        ? `<rect x="${fmt(it.x - w / 2 - refUnit * 0.008)}" y="${fmt(it.z - d / 2 - refUnit * 0.008)}" width="${fmt(w + refUnit * 0.016)}" height="${fmt(d + refUnit * 0.016)}" rx="${fmt(refUnit * 0.006)}" fill="${OBJETIVO_HALO}" opacity="0.35"/>`
        : "";
      return (
        `<g transform="rotate(${fmt(rot)} ${fmt(it.x)} ${fmt(it.z)})">` +
        halo +
        `<rect x="${fmt(it.x - w / 2)}" y="${fmt(it.z - d / 2)}" width="${fmt(w)}" height="${fmt(d)}" rx="${fmt(Math.min(w, d) * 0.05)}" ` +
        `fill="${esObjetivo ? OBJETIVO_FILL : color}" opacity="${esObjetivo ? "1" : "0.45"}" ` +
        `stroke="${esObjetivo ? OBJETIVO_STROKE : "#94a3b8"}" stroke-width="${fmt(esObjetivo ? refUnit * 0.004 : refUnit * 0.0012)}"/></g>`
      );
    })
    .join("");

  /* Etiquetas: "TU STAND" para uno; numero por bloque para varios. */
  const etiquetas = objetivos
    .map((it, i) => {
      if (!multiple) {
        return (
          `<text x="${fmt(it.x)}" y="${fmt(it.z - it.dim.d / 2 - refUnit * 0.012)}" text-anchor="middle" font-size="${fmt(refUnit * 0.028)}" font-weight="700" fill="#7c2d12" stroke="#ffffff" stroke-width="${fmt(refUnit * 0.006)}" paint-order="stroke">TU STAND</text>` +
          `<text x="${fmt(it.x)}" y="${fmt(it.z + refUnit * 0.012)}" text-anchor="middle" font-size="${fmt(refUnit * 0.024)}" font-weight="600" fill="#1f2937" stroke="#ffffff" stroke-width="${fmt(refUnit * 0.005)}" paint-order="stroke">${esc(it.id)}</text>`
        );
      }
      const r = refUnit * 0.022;
      return (
        `<circle cx="${fmt(it.x)}" cy="${fmt(it.z)}" r="${fmt(r)}" fill="${OBJETIVO_STROKE}" stroke="#ffffff" stroke-width="${fmt(refUnit * 0.004)}"/>` +
        `<text x="${fmt(it.x)}" y="${fmt(it.z + refUnit * 0.009)}" text-anchor="middle" font-size="${fmt(refUnit * 0.026)}" font-weight="700" fill="#ffffff">${i + 1}</text>`
      );
    })
    .join("");

  const leyenda = opciones.sinLeyenda ? "" : construirLeyenda(items, vb, refUnit, opciones.etiquetas ?? {});

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(vb.x)} ${fmt(vb.y)} ${fmt(vb.w)} ${fmt(vb.h)}" width="${fmt(vb.w * 32)}" height="${fmt(vb.h * 32)}">` +
    `<rect x="${fmt(vb.x)}" y="${fmt(vb.y)}" width="${fmt(vb.w)}" height="${fmt(vb.h)}" fill="#f8fafc"/>` +
    bloques +
    etiquetas +
    leyenda +
    `</svg>`;

  return { svg, encontrado };
}

function computeBounds(items: PlanoItem[]): PlanoBounds {
  if (items.length === 0) return { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x - it.dim.w / 2);
    maxX = Math.max(maxX, it.x + it.dim.w / 2);
    minZ = Math.min(minZ, it.z - it.dim.d / 2);
    maxZ = Math.max(maxZ, it.z + it.dim.d / 2);
  }
  return { minX, maxX, minZ, maxZ };
}

function construirLeyenda(
  items: PlanoItem[],
  vb: { x: number; y: number; w: number; h: number },
  refUnit: number,
  etiquetas: Record<string, string>,
): string {
  const tipos: string[] = [];
  for (const it of items) {
    if (!tipos.includes(it.type)) tipos.push(it.type);
  }
  const filas = tipos.slice(0, 6).map((type) => {
    const item = items.find((i) => i.type === type);
    return { label: etiquetas[type] ?? type, color: item?.dim.color ?? "#94a3b8" };
  });
  if (filas.length === 0) return "";
  const rowH = refUnit * 0.042;
  const box = refUnit * 0.03;
  const fs = refUnit * 0.026;
  const x0 = vb.x + refUnit * 0.02;
  const y0 = vb.y + refUnit * 0.02;
  const ancho = Math.max(...filas.map((l) => l.label.length)) * fs * 0.55 + box + fs * 1.4;
  return (
    `<g>` +
    `<rect x="${fmt(x0 - fs * 0.5)}" y="${fmt(y0 - fs)}" width="${fmt(ancho)}" height="${fmt(filas.length * rowH + fs)}" rx="${fmt(fs * 0.4)}" fill="#ffffff" opacity="0.88" stroke="#e2e8f0" stroke-width="${fmt(refUnit * 0.0015)}"/>` +
    filas
      .map(
        (l, i) =>
          `<rect x="${fmt(x0)}" y="${fmt(y0 + i * rowH)}" width="${fmt(box)}" height="${fmt(box)}" rx="${fmt(box * 0.2)}" fill="${l.color}" opacity="0.85" stroke="#94a3b8" stroke-width="${fmt(refUnit * 0.001)}"/>` +
          `<text x="${fmt(x0 + box + fs * 0.4)}" y="${fmt(y0 + i * rowH + box * 0.85)}" font-size="${fmt(fs)}" fill="#334155">${esc(l.label)}</text>`,
      )
      .join("") +
    `</g>`
  );
}

function fmt(valor: number): string {
  return String(Math.round(valor * 1000) / 1000);
}

function esc(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
