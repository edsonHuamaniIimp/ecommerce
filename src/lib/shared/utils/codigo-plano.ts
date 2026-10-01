import {
  PLANO_CODIGO_PREFIJO,
  PLANO_CODIGO_REGEX,
  PLANO_TIPO_CODIGO_MAX,
  PLANO_TIPO_CODIGO_REGEX,
} from "@/lib/shared/constants";

const RANGO_CODIGO_MIN = 10000;
const RANGO_CODIGO_MAX = 100000;
const INTENTOS_CODIGO = 50;

function normalizar(texto: string): string {
  return texto.trim().toUpperCase();
}

function normalizarCodigoTipo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PLANO_TIPO_CODIGO_MAX)
    .replace(/-+$/g, "");
}

function estaUsado(codigo: string, existentes: Iterable<string>): boolean {
  const objetivo = normalizar(codigo);
  for (const existente of existentes) {
    if (normalizar(existente) === objetivo) return true;
  }
  return false;
}

export const codigoPlanoUtils = {
  /** Codigo de mapa unico con formato pab-XXXXX, libre de colisiones con `existentes`. */
  generar(existentes: Iterable<string> = []): string {
    const usados = new Set(Array.from(existentes, (c) => c.trim().toLowerCase()));
    for (let i = 0; i < INTENTOS_CODIGO; i++) {
      const sufijo = String(Math.floor(Math.random() * (RANGO_CODIGO_MAX - RANGO_CODIGO_MIN)) + RANGO_CODIGO_MIN);
      const codigo = `${PLANO_CODIGO_PREFIJO}-${sufijo}`;
      if (!usados.has(codigo)) return codigo;
    }
    return `${PLANO_CODIGO_PREFIJO}-${Date.now().toString().slice(-6)}`;
  },

  /** true si el codigo cumple la regla de la BD (minusculas, numeros y guiones). */
  esValido(codigo: string): boolean {
    return PLANO_CODIGO_REGEX.test(codigo.trim());
  },

  /** true si el codigo ya existe en la lista (comparacion sin mayusculas). */
  existe(codigo: string, existentes: Iterable<string>): boolean {
    return estaUsado(codigo, existentes);
  },

  /** true si el codigo de tipo de bloque es valido en formato y longitud. */
  esTipoCodigoValido(codigo: string): boolean {
    const limpio = codigo.trim();
    return limpio.length > 0 && limpio.length <= PLANO_TIPO_CODIGO_MAX && PLANO_TIPO_CODIGO_REGEX.test(limpio);
  },

  /** Normaliza un texto libre a codigo de tipo (mayusculas, sin acentos, separado por guiones). */
  normalizarCodigoTipo,

  /** Sugiere un codigo unico de tipo de bloque a partir de un texto libre. */
  sugerirTipoCodigo(texto: string, existentes: Iterable<string> = []): string {
    const base = normalizarCodigoTipo(texto) || "TIPO";
    if (!estaUsado(base, existentes)) return base;
    for (let n = 2; n < 100; n++) {
      const sufijo = `-${n}`;
      const prefijo = base.slice(0, PLANO_TIPO_CODIGO_MAX - sufijo.length).replace(/-+$/g, "");
      const candidato = `${prefijo}${sufijo}`;
      if (!estaUsado(candidato, existentes)) return candidato;
    }
    return `${base.slice(0, PLANO_TIPO_CODIGO_MAX - 3)}-99`;
  },
};
