export interface TipoCatalogoEntrante {
  codigo: string;
  label: string;
  nombre: string;
  w: number;
  d: number;
  h: number;
  color: string;
  ambito: string;
  flgActivo: boolean;
}

export type TipoCatalogoExistente = TipoCatalogoEntrante;

export interface PlanSincronizacionCatalogo {
  altas: TipoCatalogoEntrante[];
  cambios: TipoCatalogoEntrante[];
  desactivar: string[];
  bloqueados: string[];
}

const normalizar = (codigo: string) => codigo.trim().toUpperCase();

export function normalizarCodigoTipo(codigo: string): string {
  return normalizar(codigo);
}

function mismaData(a: TipoCatalogoExistente, b: TipoCatalogoEntrante): boolean {
  return (
    a.label === b.label &&
    a.nombre === b.nombre &&
    a.w === b.w &&
    a.d === b.d &&
    a.h === b.h &&
    a.color === b.color &&
    a.ambito === b.ambito &&
    a.flgActivo === b.flgActivo
  );
}

/**
 * Calcula como sincronizar el catalogo global con los tipos que envia un mapa.
 * - Los tipos entrantes se dan de alta o se actualizan por codigo normalizado.
 * - Desactivar (soft delete) solo aplica a codigos activos que desaparecen del payload
 *   y que no tienen bloques en ningun mapa; si estan en uso quedan bloqueados.
 * - Un tipo entrante marcado inactivo pero con uso global tampoco se desactiva.
 */
export function planSincronizacionCatalogo(
  existentes: TipoCatalogoExistente[],
  entrantes: TipoCatalogoEntrante[],
  usoGlobal: Map<string, number>,
): PlanSincronizacionCatalogo {
  const existentesPorCodigo = new Map(existentes.map((e) => [normalizar(e.codigo), e]));
  const entrantesPorCodigo = new Map<string, TipoCatalogoEntrante>();
  for (const t of entrantes) entrantesPorCodigo.set(normalizar(t.codigo), t);

  const altas: TipoCatalogoEntrante[] = [];
  const cambios: TipoCatalogoEntrante[] = [];
  const bloqueados: string[] = [];

  for (const [key, entrante] of entrantesPorCodigo) {
    const existente = existentesPorCodigo.get(key);
    const enUso = (usoGlobal.get(key) ?? 0) > 0;
    if (!existente) {
      altas.push(entrante);
      continue;
    }
    if (mismaData(existente, entrante)) continue;
    if (!entrante.flgActivo && enUso) {
      bloqueados.push(existente.codigo);
      continue;
    }
    cambios.push(entrante);
  }

  const desactivar: string[] = [];
  for (const [key, existente] of existentesPorCodigo) {
    if (entrantesPorCodigo.has(key)) continue;
    if (!existente.flgActivo) continue;
    if ((usoGlobal.get(key) ?? 0) > 0) {
      bloqueados.push(existente.codigo);
      continue;
    }
    desactivar.push(existente.codigo);
  }

  return { altas, cambios, desactivar, bloqueados };
}
