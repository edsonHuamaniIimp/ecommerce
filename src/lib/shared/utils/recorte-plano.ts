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
const OBJETIVO_LINEA = "#b45309";
const OBJETIVO_TEXTO = "#92400e";
const OBJETIVO_CONTORNO = "#ffffff";

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

  /* Bloques uniformes; los objetivos se resaltan (ambar + halo) y ademas llevan flecha. */
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

  /*
   * Anotaciones de los stands objetivo: flecha (linea + punta, con contorno blanco
   * para contraste en el contrato) que entra desde el lado con mas espacio libre y
   * apunta al stand; etiqueta en la cola ("TU STAND" + codigo, o numero en multiple).
   */
  const anotaciones = objetivos
    .map((it, i) => anotarObjetivo(it, items, vb, refUnit, i, multiple))
    .join("");

  const leyenda = opciones.sinLeyenda ? "" : construirLeyenda(items, vb, refUnit, opciones.etiquetas ?? {});

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(vb.x)} ${fmt(vb.y)} ${fmt(vb.w)} ${fmt(vb.h)}" width="${fmt(vb.w * 32)}" height="${fmt(vb.h * 32)}">` +
    `<rect x="${fmt(vb.x)}" y="${fmt(vb.y)}" width="${fmt(vb.w)}" height="${fmt(vb.h)}" fill="#f8fafc"/>` +
    bloques +
    anotaciones +
    leyenda +
    `</svg>`;

  return { svg, encontrado };
}

type DireccionFlecha = "arriba" | "abajo" | "izq" | "der";

/** Distancia libre en una direccion hasta el bloque mas cercano del carril (Infinity si libre). */
function espacioLibre(it: PlanoItem, items: PlanoItem[], dir: DireccionFlecha, holgura = 0): number {
  let menor = Infinity;
  const vertical = dir === "arriba" || dir === "abajo";
  for (const o of items) {
    if (o.id === it.id) continue;
    const mismoCarril = vertical
      ? Math.abs(o.x - it.x) < (o.dim.w + it.dim.w) / 2 + holgura
      : Math.abs(o.z - it.z) < (o.dim.d + it.dim.d) / 2 + holgura;
    if (!mismoCarril) continue;
    let d: number;
    if (dir === "arriba" && o.z < it.z) d = (it.z - it.dim.d / 2) - (o.z + o.dim.d / 2);
    else if (dir === "abajo" && o.z > it.z) d = (o.z - o.dim.d / 2) - (it.z + it.dim.d / 2);
    else if (dir === "izq" && o.x < it.x) d = (it.x - it.dim.w / 2) - (o.x + o.dim.w / 2);
    else if (dir === "der" && o.x > it.x) d = (o.x - o.dim.w / 2) - (it.x + it.dim.w / 2);
    else continue;
    if (d >= 0 && d < menor) menor = d;
  }
  return menor;
}

/** Espacio hasta el borde del encuadre en una direccion (para no salirse del viewBox). */
function espacioHaciaBorde(it: PlanoItem, vb: { x: number; y: number; w: number; h: number }, dir: DireccionFlecha, margen: number): number {
  if (dir === "arriba") return it.z - it.dim.d / 2 - (vb.y + margen);
  if (dir === "abajo") return vb.y + vb.h - margen - (it.z + it.dim.d / 2);
  if (dir === "izq") return it.x - it.dim.w / 2 - (vb.x + margen);
  return vb.x + vb.w - margen - (it.x + it.dim.w / 2);
}

/** Huella de la etiqueta a lo largo de la flecha: ancho si es horizontal, alto si es vertical. */
function huellaEtiqueta(dir: DireccionFlecha, refUnit: number): number {
  return dir === "izq" || dir === "der" ? refUnit * 0.16 : refUnit * 0.06;
}

/** Direccion con mas espacio real (bloques + borde del encuadre); desempata arriba > abajo > izq > der. */
function direccionLibre(it: PlanoItem, items: PlanoItem[], vb: { x: number; y: number; w: number; h: number }, margen: number, refUnit: number): DireccionFlecha {
  const orden: DireccionFlecha[] = ["arriba", "abajo", "izq", "der"];
  const holguraAncho = refUnit * 0.06;
  let mejor: DireccionFlecha = "arriba";
  let mejorEspacio = -Infinity;
  for (const dir of orden) {
    /* El espacio util descuenta la huella de la etiqueta (texto/circulo tras la cola). */
    const espacio = Math.min(espacioLibre(it, items, dir, holguraAncho), espacioHaciaBorde(it, vb, dir, margen)) - huellaEtiqueta(dir, refUnit);
    if (espacio > mejorEspacio) {
      mejorEspacio = espacio;
      mejor = dir;
    }
  }
  return mejor;
}

/**
 * Flecha + etiqueta del stand objetivo. La flecha entra desde el lado con mas espacio
 * libre (sin cruzar otros bloques) y apunta a la orilla del stand; la etiqueta va en la
 * cola: "TU STAND" + codigo (un stand) o circulo numerado (reserva multiple).
 */
function anotarObjetivo(
  it: PlanoItem,
  items: PlanoItem[],
  vb: { x: number; y: number; w: number; h: number },
  refUnit: number,
  indice: number,
  multiple: boolean,
): string {
  const margen = refUnit * 0.02;
  const holguraAncho = refUnit * 0.06;
  const dir = direccionLibre(it, items, vb, margen, refUnit);
  const horizontal = dir === "izq" || dir === "der";
  const signo = dir === "arriba" || dir === "izq" ? -1 : 1;
  const gap = refUnit * 0.012;
  const headL = refUnit * 0.030;
  const headW = refUnit * 0.024;
  const espacio = Math.min(espacioLibre(it, items, dir, holguraAncho), espacioHaciaBorde(it, vb, dir, margen));
  /* Deja libre la huella de la etiqueta mas un margen de seguridad. */
  const largo = Math.min(refUnit * 0.12, Math.max(refUnit * 0.03, espacio - huellaEtiqueta(dir, refUnit) - refUnit * 0.015));

  const borde = horizontal ? it.x + (signo * it.dim.w) / 2 : it.z + (signo * it.dim.d) / 2;
  const punta = borde + signo * gap;
  const base = punta + signo * headL;
  /* Sin clamp invertido: si el borde del encuadre aprieta, la cola se acorta pero nunca cruza la punta. */
  const colaLibre = base + signo * largo;
  const colaFinal = signo * (colaLibre - base) > 0 ? colaLibre : base + signo * refUnit * 0.02;
  const baseFinal = base;

  const eje = (valor: number) => (horizontal ? { x: valor, y: it.z } : { x: it.x, y: valor });
  const inicio = eje(colaFinal);
  const fin = eje(baseFinal);
  const puntaPt = eje(punta);
  const esquinaA = horizontal ? { x: baseFinal, y: it.z - headW / 2 } : { x: it.x - headW / 2, y: baseFinal };
  const esquinaB = horizontal ? { x: baseFinal, y: it.z + headW / 2 } : { x: it.x + headW / 2, y: baseFinal };

  const casing = `<line x1="${fmt(inicio.x)}" y1="${fmt(inicio.y)}" x2="${fmt(fin.x)}" y2="${fmt(fin.y)}" stroke="${OBJETIVO_CONTORNO}" stroke-width="${fmt(refUnit * 0.012)}" stroke-linecap="round"/>`;
  const linea = `<line x1="${fmt(inicio.x)}" y1="${fmt(inicio.y)}" x2="${fmt(fin.x)}" y2="${fmt(fin.y)}" stroke="${OBJETIVO_LINEA}" stroke-width="${fmt(refUnit * 0.005)}" stroke-linecap="round"/>`;
  const puntaContorno = `<polygon points="${fmt(puntaPt.x)},${fmt(puntaPt.y)} ${fmt(esquinaA.x)},${fmt(esquinaA.y)} ${fmt(esquinaB.x)},${fmt(esquinaB.y)}" fill="${OBJETIVO_CONTORNO}"/>`;
  const puntaSvg = `<polygon points="${fmt(puntaPt.x)},${fmt(puntaPt.y)} ${fmt(esquinaA.x)},${fmt(esquinaA.y)} ${fmt(esquinaB.x)},${fmt(esquinaB.y)}" fill="${OBJETIVO_LINEA}"/>`;
  const flecha = casing + linea + puntaContorno + puntaSvg;

  if (multiple) {
    return (
      flecha +
      `<circle cx="${fmt(inicio.x)}" cy="${fmt(inicio.y)}" r="${fmt(refUnit * 0.019)}" fill="${OBJETIVO_LINEA}" stroke="${OBJETIVO_CONTORNO}" stroke-width="${fmt(refUnit * 0.004)}"/>` +
      `<text x="${fmt(inicio.x)}" y="${fmt(inicio.y + refUnit * 0.0075)}" text-anchor="middle" font-size="${fmt(refUnit * 0.023)}" font-weight="700" fill="#ffffff">${indice + 1}</text>`
    );
  }

  const estiloTitulo = `font-size="${fmt(refUnit * 0.028)}" font-weight="700" fill="${OBJETIVO_TEXTO}" stroke="${OBJETIVO_CONTORNO}" stroke-width="${fmt(refUnit * 0.006)}" paint-order="stroke"`;
  const estiloCodigo = `font-size="${fmt(refUnit * 0.024)}" font-weight="600" fill="#1f2937" stroke="${OBJETIVO_CONTORNO}" stroke-width="${fmt(refUnit * 0.005)}" paint-order="stroke"`;
  const titulo = "TU STAND";
  const codigo = esc(it.id);
  const aire = refUnit * 0.018;
  let etiqueta: string;
  if (dir === "arriba") {
    etiqueta =
      `<text x="${fmt(inicio.x)}" y="${fmt(inicio.y - aire - refUnit * 0.020)}" text-anchor="middle" ${estiloTitulo}>${titulo}</text>` +
      `<text x="${fmt(inicio.x)}" y="${fmt(inicio.y - aire)}" text-anchor="middle" ${estiloCodigo}>${codigo}</text>`;
  } else if (dir === "abajo") {
    etiqueta =
      `<text x="${fmt(inicio.x)}" y="${fmt(inicio.y + aire)}" text-anchor="middle" ${estiloTitulo}>${titulo}</text>` +
      `<text x="${fmt(inicio.x)}" y="${fmt(inicio.y + aire + refUnit * 0.026)}" text-anchor="middle" ${estiloCodigo}>${codigo}</text>`;
  } else if (dir === "izq") {
    etiqueta =
      `<text x="${fmt(inicio.x - aire)}" y="${fmt(inicio.y - refUnit * 0.002)}" text-anchor="end" ${estiloTitulo}>${titulo}</text>` +
      `<text x="${fmt(inicio.x - aire)}" y="${fmt(inicio.y + refUnit * 0.024)}" text-anchor="end" ${estiloCodigo}>${codigo}</text>`;
  } else {
    etiqueta =
      `<text x="${fmt(inicio.x + aire)}" y="${fmt(inicio.y - refUnit * 0.002)}" text-anchor="start" ${estiloTitulo}>${titulo}</text>` +
      `<text x="${fmt(inicio.x + aire)}" y="${fmt(inicio.y + refUnit * 0.024)}" text-anchor="start" ${estiloCodigo}>${codigo}</text>`;
  }
  return flecha + etiqueta;
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
