import {
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_CRITERIO_PREFIJO,
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

const categoriaCriterio = (codigo: string) => `${DD_MATRIZ_CRITERIO_PREFIJO}${codigo}`;

const CATEGORIAS_PERSONA_POR_EMPRESA: Record<string, string> = {
  [categoriaCriterio("central_riesgo_empresa")]: categoriaCriterio("central_riesgo_persona"),
  [categoriaCriterio("peps_prp_empresa")]: categoriaCriterio("peps_prp_persona"),
  [categoriaCriterio("corrupcion_empresa")]: categoriaCriterio("corrupcion_persona"),
  [categoriaCriterio("bancarizado_empresa")]: categoriaCriterio("bancarizado_persona"),
};

const CATEGORIA_POR_PALABRA: { claves: string[]; categoria: string }[] = [
  {
    claves: ["indecopi"],
    categoria: categoriaCriterio("indecopi"),
  },
  {
    claves: ["oefa"],
    categoria: categoriaCriterio("oefa"),
  },
  {
    claves: ["osce", "tribunal de contrataciones"],
    categoria: categoriaCriterio("osce"),
  },
  {
    claves: ["ofac"],
    categoria: categoriaCriterio("ofac"),
  },
  {
    claves: ["onu", "naciones unidas"],
    categoria: categoriaCriterio("naciones_unidas"),
  },
  {
    claves: ["opensanctions"],
    categoria: categoriaCriterio("opensanctions"),
  },
  {
    claves: ["sentinel", "sentinell", "central de riesgo"],
    categoria: categoriaCriterio("central_riesgo_empresa"),
  },
  {
    claves: ["pep", "pep's", "prp"],
    categoria: categoriaCriterio("peps_prp_empresa"),
  },
  {
    claves: ["conflicto"],
    categoria: categoriaCriterio("conflicto_interes"),
  },
  {
    claves: ["corrupcion", "soborno", "lavado"],
    categoria: categoriaCriterio("corrupcion_empresa"),
  },
  {
    claves: ["bancarizado"],
    categoria: categoriaCriterio("bancarizado_empresa"),
  },
  {
    claves: ["reputacion", "reputacional", "prensa", "medio", "medios", "web", "internet", "noticia", "publicacion", "portal", "periodistico"],
    categoria: DD_MATRIZ_ADJUNTO_CATEGORIAS.REPUTACIONAL_SUSTENTO,
  },
  {
    claves: ["legal", "compliance", "poder", "poderes", "representante", "dni", "identidad", "ficha", "ruc", "sunat", "existencia", "certificado", "constancia", "pasaporte", "carnet"],
    categoria: DD_MATRIZ_ADJUNTO_CATEGORIAS.COMPLIANCE_SUSTENTO,
  },
  {
    claves: ["informe", "reporte", "report"],
    categoria: DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_INFORME,
  },
  {
    claves: ["osce", "sancion", "restrictiva"],
    categoria: DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_SUSTENTO,
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
  const categoriaBase =
    CATEGORIA_POR_PALABRA.find((regla) => regla.claves.some((clave) => texto.includes(normalizarTexto(clave))))?.categoria ??
    (vinculo?.tipo === DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE ||
    vinculo?.tipo === DD_MATRIZ_TIPOS_VINCULO.BENEFICIARIO
      ? DD_MATRIZ_ADJUNTO_CATEGORIAS.COMPLIANCE_SUSTENTO
      : DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_SUSTENTO);
  const categoria =
    vinculo && vinculo.tipo !== DD_MATRIZ_TIPOS_VINCULO.EMPRESA
      ? (CATEGORIAS_PERSONA_POR_EMPRESA[categoriaBase] ?? categoriaBase)
      : categoriaBase;

  return {
    vinculoId: vinculo?.id ?? vinculos[0]?.id ?? null,
    categoria,
    motivo: vinculoPorNombre
      ? `Coincide con el vínculo "${vinculoPorNombre.nombre}".`
      : "Clasificación por palabras clave del nombre.",
  };
}
