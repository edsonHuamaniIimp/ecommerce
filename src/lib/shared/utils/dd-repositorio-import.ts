import {
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_TIPOS_VINCULO,
} from "@/lib/shared/constants";
import { normalizarTexto } from "@/lib/shared/utils/normalizar-texto";

export interface ImportacionVinculo {
  id: string;
  nombre: string;
  tipo: string;
}

export interface ValidacionNomenclatura {
  cumple: boolean;
  detalle: string;
}

export interface ClasificacionNombre {
  vinculoId: string | null;
  categoria: string;
  motivo: string;
}

const PREFIJO_NUMERICO = /^\d{2}\s*[.\-]\s*/;
const IDENTIFICADOR = /\b(?:\d{8,11}|[A-Z]{1,4}\d{5,}[A-Z0-9]*)\b/i;

const CATEGORIA_POR_PALABRA: { claves: string[]; categoria: string }[] = [
  {
    claves: ["informe", "reporte", "report"],
    categoria: DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_INFORME,
  },
  {
    claves: ["ofac", "onu", "sentinel", "indecopi", "corrupcion", "soborno", "lavado", "pep", "pep's", "oefa", "sancion", "restrictiva"],
    categoria: DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_SUSTENTO,
  },
  {
    claves: ["reputacion", "reputacional", "prensa", "medio", "medios", "web", "internet", "noticia"],
    categoria: DD_MATRIZ_ADJUNTO_CATEGORIAS.REPUTACIONAL_SUSTENTO,
  },
  {
    claves: ["legal", "compliance", "poder", "poderes", "representante", "dni", "identidad", "ficha", "ruc", "sunat"],
    categoria: DD_MATRIZ_ADJUNTO_CATEGORIAS.COMPLIANCE_SUSTENTO,
  },
];

const TIPO_POR_PALABRA: { claves: string[]; tipo: string }[] = [
  {
    claves: ["representante", "rep legal", "dni", "identidad", "poder", "poderes"],
    tipo: DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE,
  },
  {
    claves: ["socio", "beneficiario", "accionista", "participacion"],
    tipo: DD_MATRIZ_TIPOS_VINCULO.BENEFICIARIO,
  },
  {
    claves: ["vinculada", "vinculado", "matriz", "subsidiaria", "filial"],
    tipo: DD_MATRIZ_TIPOS_VINCULO.VINCULADO,
  },
];

export function validarNomenclaturaArchivo(nombre: string): ValidacionNomenclatura {
  const base = nombre.replace(/\.[^.]+$/, "").trim();
  const prefijo = PREFIJO_NUMERICO.test(base);
  const identificador = IDENTIFICADOR.test(base);

  if (prefijo && identificador) {
    return { cumple: true, detalle: "Cumple la nomenclatura." };
  }
  if (!prefijo && !identificador) {
    return { cumple: false, detalle: "Falta el prefijo numérico y el RUC/DNI." };
  }
  if (!prefijo) {
    return { cumple: false, detalle: "Falta el prefijo numérico: 01." };
  }
  return { cumple: false, detalle: "No se detectó RUC/DNI en el nombre." };
}

export function clasificarNombreArchivo(
  nombre: string,
  vinculos: ImportacionVinculo[],
): ClasificacionNombre {
  const texto = normalizarTexto(nombre);
  const vinculoPorNombre = vinculos.find((vinculo) => {
    const nombreVinculo = normalizarTexto(vinculo.nombre);
    return nombreVinculo.length >= 3 && texto.includes(nombreVinculo);
  });
  const tipo = TIPO_POR_PALABRA.find((regla) => regla.claves.some((clave) => texto.includes(normalizarTexto(clave))))?.tipo;
  const vinculo = vinculoPorNombre ?? (tipo ? vinculos.find((item) => item.tipo === tipo) : undefined);
  const categoria =
    CATEGORIA_POR_PALABRA.find((regla) => regla.claves.some((clave) => texto.includes(normalizarTexto(clave))))?.categoria ??
    DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_SUSTENTO;

  return {
    vinculoId: vinculo?.id ?? vinculos[0]?.id ?? null,
    categoria,
    motivo: vinculoPorNombre
      ? `Coincide con el vínculo "${vinculoPorNombre.nombre}".`
      : "Clasificación por palabras clave del nombre.",
  };
}
