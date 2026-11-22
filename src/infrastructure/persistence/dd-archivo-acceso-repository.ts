import "server-only";

import { prisma } from "@/lib/server/db";

/**
 * Que es un archivo de `/uploads` respecto a Debida Diligencia:
 * - `ninguno`: no lo referencia ninguna tabla de DD (logos, planos, imagenes publicas...).
 * - `documento`: documento o version del expediente de una empresa (la propia empresa tambien lo ve).
 * - `interno`: evidencia de la matriz o informe legal (solo personal de DD).
 */
export interface ClasificacionArchivoDd {
  tipo: "ninguno" | "documento" | "interno";
  /** Empresas duenas del documento (vacio salvo `documento`). */
  empresaIds: string[];
}

const NINGUNO: ClasificacionArchivoDd = { tipo: "ninguno", empresaIds: [] };
const TTL_MS = 60_000;
const MAX_ENTRADAS = 500;

const globalCache = globalThis as unknown as {
  __ddArchivoAcceso?: Map<string, { expira: number; valor: ClasificacionArchivoDd }>;
};
const cache = (globalCache.__ddArchivoAcceso ??= new Map());

/** Variantes con las que puede estar guardada la URL del archivo. */
export function variantesUrlUpload(clave: string): string[] {
  return [`/uploads/${clave}`, clave];
}

/** Clasifica un archivo por las referencias que tiene en las tablas de DD (con cache corto). */
export async function clasificarArchivoDd(clave: string): Promise<ClasificacionArchivoDd> {
  const guardado = cache.get(clave);
  if (guardado && guardado.expira > Date.now()) return guardado.valor;

  const url = { in: variantesUrlUpload(clave) };
  const [documentos, versiones, adjunto, informeLegal] = await Promise.all([
    prisma.debidaDiligenciaDocumento.findMany({
      where: { url },
      select: { expediente: { select: { empresaId: true } } },
      take: 20,
    }),
    prisma.debidaDiligenciaDocumentoVersion.findMany({
      where: { url },
      select: { documento: { select: { expediente: { select: { empresaId: true } } } } },
      take: 20,
    }),
    prisma.ddMatrizAdjunto.findFirst({ where: { url }, select: { id: true } }),
    prisma.debidaDiligencia.findFirst({ where: { informeLegalUrl: url.in[0] }, select: { id: true } }),
  ]);

  const empresaIds = [
    ...documentos.map((d) => d.expediente.empresaId),
    ...versiones.map((v) => v.documento.expediente.empresaId),
  ];
  let valor: ClasificacionArchivoDd = NINGUNO;
  if (empresaIds.length > 0) valor = { tipo: "documento", empresaIds: [...new Set(empresaIds)] };
  else if (adjunto || informeLegal) valor = { tipo: "interno", empresaIds: [] };

  if (cache.size >= MAX_ENTRADAS) cache.clear();
  cache.set(clave, { expira: Date.now() + TTL_MS, valor });
  return valor;
}

/** Empresa del usuario (para que un cliente solo vea los documentos de la suya). */
export async function empresaIdDeUsuario(email: string): Promise<string | null> {
  const fila = await prisma.userRole.findFirst({ where: { email }, select: { empresaId: true } });
  return fila?.empresaId ?? null;
}
