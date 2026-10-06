import 'server-only';

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { construirSvgMacro } from "@/lib/shared/utils/macro-plano-svg";
import type { PlanoEntity } from "@/domain/models/plano-entities";

/**
 * "Mapa de pabellones" del contrato: rasteriza el fondo del macro (PDF o imagen),
 * resalta las secciones de los pabellones del contrato y devuelve un JPEG liviano.
 *
 * El render del PDF es pesado (~20 s la primera vez), por eso el fondo se cachea en
 * memoria y en disco (EFS en produccion: sobrevive reinicios y deploys) por
 * macro+updatedAt; las composiciones se serializan (una a la vez) y el render del
 * fondo tiene timeout: si excede, el contrato se genera sin la imagen (nunca 504).
 */
const ANCHO_SALIDA = 2200;
const MAX_FONDOS_CACHE = 3;
const TIMEOUT_FONDO_MS = 35_000;
/* En produccion public/uploads es el EFS: la cache persiste entre tasks y deploys. */
const CACHE_DIR = path.join(process.cwd(), "public", "uploads", ".cache-macro");

const fondosCache = new Map<string, { usado: number; base: Buffer }>();

let composicionesActivas = 0;
const espera: Array<() => void> = [];
const MAX_COMPOSICIONES = 1;

async function adquirirTurno(): Promise<void> {
  if (composicionesActivas < MAX_COMPOSICIONES) {
    composicionesActivas++;
    return;
  }
  await new Promise<void>((resolve) => {
    espera.push(() => {
      composicionesActivas++;
      resolve();
    });
  });
}

function liberarTurno(): void {
  composicionesActivas = Math.max(0, composicionesActivas - 1);
  espera.shift()?.();
}

function esPdf(url: string): boolean {
  return url.toLowerCase().endsWith(".pdf");
}

async function leerArchivo(url: string): Promise<Buffer> {
  if (url.startsWith("http")) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo leer ${url}: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(path.join(process.cwd(), "public", url.replace(/^\//, "")));
}

async function pdfAPng(pdf: Buffer): Promise<Buffer> {
  /*
   * Carga diferida: si el binario nativo no esta disponible, el error se captura
   * arriba y la imagen del macro se omite — ninguna otra ruta se ve afectada.
   */
  const { createCanvas } = await import("@napi-rs/canvas");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(pdf), disableWorker: true } as never).promise;
  const page = await doc.getPage(1);
  /* Render directo al ancho de salida: evita ~2.4x de pixeles frente a escala fija. */
  const anchoPagina = page.getViewport({ scale: 1 }).width;
  const escala = Math.min(1, ANCHO_SALIDA / anchoPagina);
  const viewport = page.getViewport({ scale: escala });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx as never, viewport, canvas } as never).promise;
  return canvas.toBuffer("image/png");
}

function rutaCache(key: string): string {
  return path.join(CACHE_DIR, `${key.replace(/[^A-Za-z0-9._-]/g, "_")}.png`);
}

function guardarEnMemoria(key: string, base: Buffer): void {
  fondosCache.set(key, { usado: Date.now(), base });
  if (fondosCache.size > MAX_FONDOS_CACHE) {
    const masViejo = [...fondosCache.entries()].sort((a, b) => a[1].usado - b[1].usado)[0];
    if (masViejo) fondosCache.delete(masViejo[0]);
  }
}

function leerDeDisco(ruta: string): Buffer | null {
  try {
    return fs.readFileSync(ruta);
  } catch {
    return null;
  }
}

function guardarEnDisco(ruta: string, base: Buffer): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(ruta, base);
  } catch {
    /* sin disco persistente: solo cache en memoria */
  }
}

function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promesa
      .then((valor) => {
        clearTimeout(timer);
        resolve(valor);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

async function fondoDelMacro(macro: PlanoEntity): Promise<Buffer | null> {
  if (!macro.imagenFondo) return null;
  const key = `${macro.id}:${macro.updatedAt.getTime()}`;
  const cacheado = fondosCache.get(key);
  if (cacheado) {
    cacheado.usado = Date.now();
    return cacheado.base;
  }
  const ruta = rutaCache(key);
  const enDisco = leerDeDisco(ruta);
  if (enDisco) {
    guardarEnMemoria(key, enDisco);
    return enDisco;
  }
  const crudo = await leerArchivo(macro.imagenFondo);
  const png = esPdf(macro.imagenFondo) ? await pdfAPng(crudo) : crudo;
  const base = await sharp(png).resize({ width: ANCHO_SALIDA, withoutEnlargement: true }).png().toBuffer();
  guardarEnMemoria(key, base);
  guardarEnDisco(ruta, base);
  return base;
}

/** Imagen del macro con las secciones de los planos hijos indicados resaltadas; null si no aplica. */
export async function renderizarMacroConSecciones(macro: PlanoEntity, planosHijoIds: string[]): Promise<Buffer | null> {
  const secciones = macro.secciones.filter((s) => s.planoHijoId && planosHijoIds.includes(s.planoHijoId));
  if (secciones.length === 0) return null;
  await adquirirTurno();
  try {
    const base = await conTimeout(fondoDelMacro(macro), TIMEOUT_FONDO_MS);
    if (!base) return null;
    const meta = await sharp(base).metadata();
    const ancho = meta.width ?? 0;
    const alto = meta.height ?? 0;
    if (!ancho || !alto) return null;
    const svg = Buffer.from(
      construirSvgMacro(
        ancho,
        alto,
        secciones.map((s) => ({ nombre: s.nombre, x: s.x, y: s.y, w: s.w, h: s.h, puntos: s.puntos ?? null })),
      ),
    );
    return await sharp(base).composite([{ input: svg, top: 0, left: 0 }]).jpeg({ quality: 86 }).toBuffer();
  } catch {
    return null;
  } finally {
    liberarTurno();
  }
}

/** Precalienta (y persiste en EFS) el fondo del macro sin componer secciones; para usar tras un deploy. */
export async function precalentarMacro(macro: PlanoEntity): Promise<boolean> {
  await adquirirTurno();
  try {
    return (await conTimeout(fondoDelMacro(macro), TIMEOUT_FONDO_MS)) !== null;
  } finally {
    liberarTurno();
  }
}
