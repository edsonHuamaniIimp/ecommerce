import {
  DD_ESTADOS,
  DD_MATRIZ_AMBITOS,
  DD_MATRIZ_AREAS,
  DD_MATRIZ_CONCLUSION_ALIAS,
  DD_MATRIZ_CONCLUSION_COMPLIANCE_ALIAS,
  DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS,
  DD_MATRIZ_CONCLUSION_LABELS,
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_CONCLUSIONES_COMPLIANCE,
  DD_MATRIZ_GRUPOS_LISTA,
  DD_MATRIZ_LISTA_URLS,
  DD_MATRIZ_LISTAS,
  DD_MATRIZ_RESULTADO_ALIAS,
  DD_MATRIZ_RESULTADO_FINAL_ALIAS,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADO_LABELS,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_SI_NO_NA_ALIAS,
  DD_MATRIZ_SI_NO_NA_LABELS,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_REPUTACION_RESULTADO_LABELS,
  DD_REPUTACION_RESULTADOS,
  type DdMatrizAmbito,
  type DdMatrizArea,
  type DdMatrizConclusion,
  type DdMatrizConclusionCompliance,
  type DdMatrizListaDef,
  type DdMatrizResultado,
  type DdMatrizResultadoFinal,
  type DdMatrizSiNoNa,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import { normalizarTexto } from "@/lib/shared/utils/normalizar-texto";
import { esPaisNacional, paisDeTexto } from "@/lib/shared/utils/pais";

/** Normaliza un texto para comparar (ver `normalizarTexto`). */
export const normalizarTextoMatriz = normalizarTexto;

/**
 * Mapper de valores del catalogo: acepta la etiqueta de negocio ("EN REVISIÓN"), el
 * codigo de desarrollo ("en_revision") y los alias historicos del Excel. Devuelve el
 * codigo canonico o `null` si el valor esta vacio o no se reconoce.
 */
export function normalizarValorMatriz<T extends string>(
  valor: unknown,
  etiquetas: Record<T, string>,
  alias: Record<string, T> = {},
): T | null {
  const normalizado = normalizarTextoMatriz(valor);
  if (!normalizado) return null;

  for (const codigo of Object.keys(etiquetas) as T[]) {
    if (normalizarTextoMatriz(codigo) === normalizado) return codigo;
    if (normalizarTextoMatriz(etiquetas[codigo]) === normalizado) return codigo;
  }
  for (const [clave, codigo] of Object.entries(alias)) {
    if (normalizarTextoMatriz(clave) === normalizado) return codigo;
  }
  return null;
}

export const normalizarSiNoNa = (valor: unknown): DdMatrizSiNoNa | null =>
  normalizarValorMatriz(valor, DD_MATRIZ_SI_NO_NA_LABELS, DD_MATRIZ_SI_NO_NA_ALIAS);

export const normalizarResultado = (valor: unknown): DdMatrizResultado | null =>
  normalizarValorMatriz(valor, DD_MATRIZ_RESULTADO_LABELS, DD_MATRIZ_RESULTADO_ALIAS);

const REPUTACIONAL_RESULTADO_ALIAS: Record<string, string> = {
  ACEPTADO: DD_REPUTACION_RESULTADOS.SIN_OBSERVACIONES,
  "SIN OBSERVACIONES": DD_REPUTACION_RESULTADOS.SIN_OBSERVACIONES,
  "REQUIERE DEBIDA DILIGENCIA": DD_REPUTACION_RESULTADOS.REQUIERE_DEBIDA_DILIGENCIA,
  OBSERVADO: DD_REPUTACION_RESULTADOS.OBSERVADO,
  "EN REVISION": DD_REPUTACION_RESULTADOS.EN_REVISION,
};

export const normalizarResultadoReputacional = (valor: unknown): string | null =>
  normalizarValorMatriz(valor, DD_REPUTACION_RESULTADO_LABELS, REPUTACIONAL_RESULTADO_ALIAS);

export const normalizarConclusion = (valor: unknown): DdMatrizConclusion | null =>
  normalizarValorMatriz(valor, DD_MATRIZ_CONCLUSION_LABELS, DD_MATRIZ_CONCLUSION_ALIAS);

export const normalizarConclusionCompliance = (valor: unknown): DdMatrizConclusionCompliance | null =>
  normalizarValorMatriz(valor, DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS, DD_MATRIZ_CONCLUSION_COMPLIANCE_ALIAS);

export const normalizarResultadoFinal = (valor: unknown): DdMatrizResultadoFinal | null =>
  normalizarValorMatriz(valor, DD_MATRIZ_RESULTADO_FINAL_LABELS, DD_MATRIZ_RESULTADO_FINAL_ALIAS);

/**
 * Resultado final visible para expedientes legacy que aun no tienen backfill en
 * `dd_matriz_vinculo.resultado_final`. No persiste ni modifica el estado.
 */
export function resultadoFinalEfectivo(
  resultadoFinal: string | null | undefined,
  estadoExpediente: string | null | undefined,
): DdMatrizResultadoFinal | null {
  const guardado = normalizarResultadoFinal(resultadoFinal);
  if (guardado) return guardado;

  const estado = normalizarTextoMatriz(estadoExpediente);
  if (estado === normalizarTextoMatriz(DD_ESTADOS.APROBADA)) return DD_MATRIZ_RESULTADOS_FINALES.APTO;
  if (estado === normalizarTextoMatriz(DD_ESTADOS.OBSERVADA)) {
    return DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA;
  }
  if (estado === normalizarTextoMatriz(DD_ESTADOS.RECHAZADA)) return DD_MATRIZ_RESULTADOS_FINALES.NO_APTO;
  if (
    estado === normalizarTextoMatriz(DD_ESTADOS.EN_LEGAL) ||
    estado === normalizarTextoMatriz(DD_ESTADOS.EN_REVISION)
  ) {
    return DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION;
  }
  return null;
}

/** Estados legacy que representan un resultado final cuando la matriz no lo tiene. */
export function estadoExpedienteDeResultadoFinal(
  resultadoFinal: string | null | undefined,
): string | null {
  switch (normalizarResultadoFinal(resultadoFinal)) {
    case DD_MATRIZ_RESULTADOS_FINALES.APTO:
      return DD_ESTADOS.APROBADA;
    case DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA:
      return DD_ESTADOS.OBSERVADA;
    case DD_MATRIZ_RESULTADOS_FINALES.NO_APTO:
      return DD_ESTADOS.RECHAZADA;
    default:
      return null;
  }
}

/**
 * Tipos de documento que implican persona extranjera: texto del expediente DD
 * ("Carnet de extranjería") y codigos de TIPOS_DOCUMENTO_PERSONA (4 = CE, 7 = pasaporte).
 */
const DOCUMENTOS_EXTRANJEROS = new Set(["CE", "PASAPORTE", "PTP", "CARNET DE EXTRANJERIA", "4", "7"]);
/** DNI y RUC (texto) o codigos 1 = DNI y 6 = RUC. */
const DOCUMENTOS_NACIONALES = new Set(["DNI", "RUC", "1", "6"]);

export interface DatosAmbito {
  /** Pais ISO alpha-2 ya conocido (p. ej. `Empresa.pais`). */
  paisIso?: string | null;
  /** Pais de constitucion en texto libre. */
  pais?: string | null;
  /** Nacionalidad en texto libre ("Peruana"). */
  nacionalidad?: string | null;
  tipoDocumento?: string | null;
}

/** Pais ISO del vinculo: el codigo conocido o el reconocido desde pais/nacionalidad. */
export function resolverPais(datos: DatosAmbito): string | null {
  return paisDeTexto(datos.paisIso) ?? paisDeTexto(datos.pais) ?? paisDeTexto(datos.nacionalidad);
}

/**
 * Deriva si el vinculo es nacional o extranjero mientras la nacionalidad definitiva
 * no exista en todos los registros. Prioridad: pais (PE nacional, otro extranjero),
 * luego tipo de documento; sin datos se asume nacional. SIG puede corregirlo a mano.
 */
export function derivarAmbito(datos: DatosAmbito): DdMatrizAmbito {
  const pais = resolverPais(datos);
  if (pais) return esPaisNacional(pais) ? DD_MATRIZ_AMBITOS.NACIONAL : DD_MATRIZ_AMBITOS.EXTRANJERO;
  const documento = normalizarTexto(datos.tipoDocumento);
  if (DOCUMENTOS_EXTRANJEROS.has(documento)) return DD_MATRIZ_AMBITOS.EXTRANJERO;
  if (DOCUMENTOS_NACIONALES.has(documento)) return DD_MATRIZ_AMBITOS.NACIONAL;
  return DD_MATRIZ_AMBITOS.NACIONAL;
}

/** Etiqueta de cantidad de vinculos con plural correcto. */
export function etiquetaCantidadVinculos(total: number): string {
  return `${total} ${total === 1 ? "vínculo" : "vínculos"}`;
}

/** URL oficial del criterio, con busqueda directa cuando el portal lo permite. */
export function fuenteAutomatizable(codigo: string): boolean {
  return DD_MATRIZ_LISTA_URLS[codigo]?.automatizable !== false;
}

export function urlFuenteLista(
  codigo: string,
  nombre?: string | null,
  documento?: string | null,
): string | null {
  const fuente = DD_MATRIZ_LISTA_URLS[codigo];
  if (!fuente) return null;
  if (!fuente.consultaParam) return fuente.url;
  const termino = (nombre ?? "").trim() || (documento ?? "").trim();
  return termino
    ? `${fuente.url}${fuente.consultaParam}${encodeURIComponent(termino)}`
    : fuente.url;
}

/** Listas restrictivas que aplican a un vinculo segun su tipo y ambito. */
export function listasAplicables(tipo: DdMatrizTipoVinculo, ambito: DdMatrizAmbito): DdMatrizListaDef[] {
  const esEmpresa = tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA;
  if (ambito === DD_MATRIZ_AMBITOS.EXTRANJERO) {
    return DD_MATRIZ_LISTAS.filter(
      (l) =>
        l.grupo === DD_MATRIZ_GRUPOS_LISTA.EXTRANJERA ||
        (!esEmpresa && l.codigo === "conflicto_interes"),
    );
  }
  const grupo = esEmpresa ? DD_MATRIZ_GRUPOS_LISTA.EMPRESA_NACIONAL : DD_MATRIZ_GRUPOS_LISTA.PERSONA_VINCULADA;
  return DD_MATRIZ_LISTAS.filter((l) => l.grupo === grupo);
}

export interface BloqueAreaEntrada {
  resultado?: unknown;
  observaciones?: string | null;
  conclusion?: unknown;
}

export interface BloqueAreaValor {
  resultado: string | null;
  observaciones: string | null;
  conclusion: string | null;
}

export interface BloqueAreaEvaluado {
  valor: BloqueAreaValor;
  errores: string[];
}

/**
 * Reglas del proceso para el bloque de un area (SIG, Reputacional o Compliance):
 * - ACEPTADO completa por defecto la conclusion (SIN OBSERVACIONES / ACEPTADO).
 * - OBSERVADO obliga a escribir observacion y a elegir una conclusion definitiva
 *   (en SIG/Reputacional: SIN OBSERVACIONES o REQUIERE DEBIDA DILIGENCIA REFORZADA).
 * - EN REVISION es solo informativo y no exige resultado.
 * Normaliza los valores con el mapper (negocio o desarrollo).
 */
export function evaluarBloqueArea(area: DdMatrizArea, entrada: BloqueAreaEntrada): BloqueAreaEvaluado {
  const errores: string[] = [];
  const esCompliance = area === DD_MATRIZ_AREAS.COMPLIANCE;
  const esReputacional = area === DD_MATRIZ_AREAS.REPUTACIONAL;
  const observaciones = entrada.observaciones?.trim() || null;

  const resultadoVacio = normalizarTextoMatriz(entrada.resultado) === "";
  const resultado = resultadoVacio
    ? null
    : esReputacional
      ? normalizarResultadoReputacional(entrada.resultado)
      : normalizarResultado(entrada.resultado);
  if (!resultadoVacio && !resultado) errores.push("Resultado de la evaluación no reconocido");

  const conclusionVacia = normalizarTextoMatriz(entrada.conclusion) === "";
  const conclusion: string | null = conclusionVacia
    ? null
    : esCompliance
      ? normalizarConclusionCompliance(entrada.conclusion)
      : esReputacional
        ? normalizarResultadoReputacional(entrada.conclusion)
        : normalizarConclusion(entrada.conclusion);
  if (!conclusionVacia && !conclusion) errores.push("Conclusión no reconocida");

  let conclusionFinal = conclusion;

  if (esReputacional) {
    if (resultado && !conclusionFinal) conclusionFinal = resultado;
    if (
      (resultado === DD_REPUTACION_RESULTADOS.OBSERVADO ||
        resultado === DD_REPUTACION_RESULTADOS.REQUIERE_DEBIDA_DILIGENCIA) &&
      !observaciones
    ) {
      errores.push("El resultado reputacional seleccionado exige registrar la observación");
    }
    return { valor: { resultado, observaciones, conclusion: conclusionFinal }, errores };
  }

  if (resultado === DD_MATRIZ_RESULTADOS.ACEPTADO && !conclusionFinal) {
    conclusionFinal = esCompliance
      ? DD_MATRIZ_CONCLUSIONES_COMPLIANCE.ACEPTADO
      : DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES;
  }

  if (resultado === DD_MATRIZ_RESULTADOS.OBSERVADO) {
    if (!observaciones) errores.push("Una evaluación OBSERVADA exige registrar la observación");
    if (!conclusionFinal) {
      errores.push("Una evaluación OBSERVADA exige elegir la conclusión");
    } else if (!esCompliance && conclusionFinal === DD_MATRIZ_CONCLUSIONES.EN_REVISION) {
      errores.push("Una evaluación OBSERVADA debe concluir en SIN OBSERVACIONES o REQUIERE DEBIDA DILIGENCIA REFORZADA");
    }
  }

  return { valor: { resultado, observaciones, conclusion: conclusionFinal }, errores };
}

/**
 * Regla 5: solo pasan a Compliance (Legal) los vinculos que SIG marca como
 * REQUIERE DEBIDA DILIGENCIA REFORZADA y siempre que exista informe/sustento adjunto.
 */
export function complianceDesbloqueado(conclusionSig: string | null | undefined, informesSig: number): boolean {
  return conclusionSig === DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA && informesSig > 0;
}

/** Comunicaciones aprobo el vinculo sin hallazgos. */
export function comunicacionesAprobadas(
  resultado: string | null | undefined,
  conclusion: string | null | undefined,
): boolean {
  return (
    (resultado === DD_MATRIZ_RESULTADOS.ACEPTADO ||
      resultado === DD_REPUTACION_RESULTADOS.SIN_OBSERVACIONES) &&
    conclusion === DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES
  );
}
