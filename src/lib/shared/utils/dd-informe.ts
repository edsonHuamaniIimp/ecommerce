import {
  DD_INFORME_CRITERIOS_DETALLAR,
  DD_INFORME_GRUPOS_OBSERVACION,
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_RESULTADOS,
} from "@/lib/shared/constants";
import type {
  DdReputacionCasoDTO,
  DdMatrizAdjuntoDTO,
  DdMatrizEvaluacionDetalleDTO,
  DdMatrizEvaluacionFilaDTO,
} from "@/types/dto/debida-diligencia";
import { esHallazgo, resultadoFinalEfectivo } from "@/lib/shared/utils/dd-matriz-evaluacion";

/** Resultados que aun no son una conclusion (el proceso sigue abierto). */
const FINALES_EN_PROCESO = new Set<string>([
  DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_RECIBIDA,
  DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION,
]);

/** true si el resultado es una conclusion registrada (no vacio, ni en revision, ni documentacion recibida). */
export function esConclusionFinal(resultado: string | null | undefined): boolean {
  return Boolean(resultado) && !FINALES_EN_PROCESO.has(resultado as string);
}

export interface DdInformeGrupo {
  expedienteId: string;
  codigo: string;
  empresaRazonSocial: string;
  empresaRuc: string;
  filas: DdMatrizEvaluacionFilaDTO[];
  totalVinculos: number;
  pendientes: number;
  conObservaciones: number;
  /** Resultado efectivo de la empresa (incluye DOCUMENTACION RECIBIDA / EN REVISION derivados del estado). */
  resultadoFinal: string | null;
  actualizadoEn: string;
}

export interface DdInformeObservacion {
  id: string;
  vinculo: string;
  tipoVinculo: string;
  area: string;
  texto: string;
  responsable: string | null;
}

/** Observacion de un criterio lista para el informe. */
export interface DdInformeNotaCriterio {
  id: string;
  /** Codigo del criterio (lista restrictiva). */
  codigo: string;
  /** Vinculo al que pertenece el criterio. */
  vinculo: string;
  /** true cuando la nota es de la empresa titular (no hace falta nombrar al vinculo). */
  esTitular: boolean;
  criterio: string;
  texto: string;
}

export interface DdInformeResumen {
  totalVinculos: number;
  pendientes: number;
  conObservaciones: number;
  totalEvidencias: number;
  sigCompleto: boolean;
  reputacionalCompleto: boolean;
  complianceCompleto: boolean;
}

function tieneObservacion(fila: DdMatrizEvaluacionFilaDTO): boolean {
  return (
    fila.sigResultado === DD_MATRIZ_RESULTADOS.OBSERVADO ||
    fila.repResultado === DD_MATRIZ_RESULTADOS.OBSERVADO ||
    fila.cmpResultado === DD_MATRIZ_RESULTADOS.OBSERVADO ||
    fila.sigConclusion === DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA ||
    fila.repConclusion === DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA ||
    fila.repConclusion === DD_MATRIZ_CONCLUSIONES.OBSERVADO ||
    fila.repConclusion === DD_MATRIZ_CONCLUSIONES.REQUIERE_DEBIDA_DILIGENCIA
  );
}

/** Agrupa filas de matriz por expediente para la bandeja de informes. */
export function agruparInformes(filas: DdMatrizEvaluacionFilaDTO[]): DdInformeGrupo[] {
  const grupos = new Map<string, DdMatrizEvaluacionFilaDTO[]>();
  for (const fila of filas) {
    const actual = grupos.get(fila.expedienteId);
    if (actual) actual.push(fila);
    else grupos.set(fila.expedienteId, [fila]);
  }

  return [...grupos.values()]
    .map((grupo): DdInformeGrupo | null => {
      const empresa = grupo.find((fila) => fila.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA) ?? grupo[0];
      if (!empresa) return null;
      const actualizadoEn = grupo.reduce(
        (ultimo, fila) => (fila.updatedAt > ultimo ? fila.updatedAt : ultimo),
        empresa.updatedAt,
      );
      return {
        expedienteId: empresa.expedienteId,
        codigo: empresa.codigo,
        empresaRazonSocial: empresa.empresaRazonSocial,
        empresaRuc: empresa.empresaRuc,
        filas: grupo,
        totalVinculos: grupo.length,
        pendientes: grupo.filter((fila) => !fila.resultadoFinal).length,
        conObservaciones: grupo.filter(tieneObservacion).length,
        resultadoFinal: resultadoFinalEfectivo(empresa.resultadoFinal, empresa.expedienteEstado),
        actualizadoEn,
      };
    })
    .filter((grupo): grupo is DdInformeGrupo => grupo !== null)
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
}

function textoBloque(
  detalle: DdMatrizEvaluacionDetalleDTO,
  area: string,
  bloque: DdMatrizEvaluacionDetalleDTO["sig"],
): DdInformeObservacion | null {
  const texto = bloque.observaciones?.trim();
  if (!texto) return null;
  return {
    id: `${detalle.id}-${area}`,
    vinculo: detalle.nombre,
    tipoVinculo: detalle.tipo,
    area,
    texto,
    responsable: bloque.responsable,
  };
}

/** Observaciones de las tres areas, ordenadas por vinculo. */
export function observacionesInforme(detalles: DdMatrizEvaluacionDetalleDTO[]): DdInformeObservacion[] {
  return detalles.flatMap((detalle) => [
    textoBloque(detalle, "SIG", detalle.sig),
    textoBloque(detalle, "Comunicaciones", detalle.reputacional),
    textoBloque(detalle, "Legal / Compliance", detalle.compliance),
  ].filter((item): item is DdInformeObservacion => item !== null));
}

function normalizarNombre(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

/**
 * Un vinculo tiene observaciones si alguna area lo dejo OBSERVADO, exige debida
 * diligencia reforzada o escribio un texto de observacion.
 */
export function detalleTieneObservacion(detalle: DdMatrizEvaluacionDetalleDTO): boolean {
  const bloques = [detalle.sig, detalle.reputacional, detalle.compliance];
  return bloques.some(
    (bloque) =>
      bloque.resultado === DD_MATRIZ_RESULTADOS.OBSERVADO ||
      bloque.conclusion === DD_MATRIZ_CONCLUSIONES.OBSERVADO ||
      bloque.conclusion === DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA ||
      bloque.conclusion === DD_MATRIZ_CONCLUSIONES.REQUIERE_DEBIDA_DILIGENCIA ||
      Boolean(bloque.observaciones?.trim()),
  ) || detalle.listas.some((lista) => Boolean(lista.observacion?.trim()));
}

/** Vinculos que deben salir en el PDF del informe: solo los que tienen observaciones. */
export function vinculosConObservaciones(detalles: DdMatrizEvaluacionDetalleDTO[]): DdMatrizEvaluacionDetalleDTO[] {
  return detalles.filter(detalleTieneObservacion);
}

/**
 * Casos reputacionales para el PDF: los que tienen hallazgos / observacion o
 * corresponden a un vinculo con observaciones (se cruzan por nombre).
 */
export function casosReputacionConObservacion(
  casos: DdReputacionCasoDTO[],
  detalles: DdMatrizEvaluacionDetalleDTO[],
): DdReputacionCasoDTO[] {
  const nombresObservados = new Set(vinculosConObservaciones(detalles).map((detalle) => normalizarNombre(detalle.nombre)));
  const resultadosConObservacion: string[] = [
    DD_REPUTACION_RESULTADOS.OBSERVADO,
    DD_REPUTACION_RESULTADOS.CON_HALLAZGOS,
    DD_REPUTACION_RESULTADOS.REQUIERE_DEBIDA_DILIGENCIA,
  ];
  return casos.filter(
    (caso) =>
      caso.estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS ||
      (caso.resultado !== null && resultadosConObservacion.includes(caso.resultado)) ||
      nombresObservados.has(normalizarNombre(caso.nombreARevisar)),
  );
}

/** Evidencias de todos los vinculos, sin duplicados. */
export function evidenciasInforme(detalles: DdMatrizEvaluacionDetalleDTO[]): DdMatrizAdjuntoDTO[] {
  const porId = new Map<string, DdMatrizAdjuntoDTO>();
  for (const detalle of detalles) {
    for (const adjunto of detalle.adjuntos) porId.set(adjunto.id, adjunto);
  }
  return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Anexos del PDF: solo las evidencias de criterios con hallazgo (SI, o NO en las preguntas en
 * positivo como central de riesgo). Las demas respuestas y los sustentos generales no se anexan.
 */
export function evidenciasConHallazgo(detalles: DdMatrizEvaluacionDetalleDTO[]): DdMatrizAdjuntoDTO[] {
  const porId = new Map<string, DdMatrizAdjuntoDTO>();
  for (const detalle of detalles) {
    const codigosHallazgo = new Set(
      detalle.listas.filter((lista) => esHallazgo(lista.codigo, lista.valor)).map((lista) => lista.codigo),
    );
    for (const adjunto of detalle.adjuntos) {
      if (!adjunto.categoria.startsWith(DD_MATRIZ_CRITERIO_PREFIJO)) continue;
      if (codigosHallazgo.has(adjunto.categoria.slice(DD_MATRIZ_CRITERIO_PREFIJO.length))) porId.set(adjunto.id, adjunto);
    }
  }
  return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Observaciones de los criterios dados (null = todos), solo de criterios con hallazgo (los mismos
 * cuyas evidencias se anexan). La empresa titular va primero.
 */
export function notasPorCriterios(
  detalles: DdMatrizEvaluacionDetalleDTO[],
  codigos: readonly string[] | null,
): DdInformeNotaCriterio[] {
  const notas: DdInformeNotaCriterio[] = [];
  const ordenados = [...detalles].sort(
    (a, b) =>
      Number(b.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA) - Number(a.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA),
  );
  for (const detalle of ordenados) {
    for (const lista of detalle.listas) {
      const texto = lista.observacion?.trim();
      if (!texto || !esHallazgo(lista.codigo, lista.valor) || (codigos && !codigos.includes(lista.codigo))) continue;
      notas.push({
        id: `${detalle.id}-${lista.codigo}`,
        codigo: lista.codigo,
        vinculo: detalle.nombre,
        esTitular: detalle.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
        criterio: lista.label,
        texto,
      });
    }
  }
  return notas;
}

/** Criterios con lugar propio en el informe oficial: grupos de la seccion 6 / 3.1 y los «Detallar». */
const CODIGOS_CON_SECCION = new Set<string>([
  ...Object.values(DD_INFORME_GRUPOS_OBSERVACION).flat(),
  ...Object.values(DD_INFORME_CRITERIOS_DETALLAR),
]);

/**
 * Observaciones de los criterios con hallazgo sin seccion propia en el informe oficial (listas
 * internacionales, bancarizado, central de riesgo de personas...): van en OTROS con su criterio.
 */
export function notasCriteriosSinSeccion(detalles: DdMatrizEvaluacionDetalleDTO[]): DdInformeNotaCriterio[] {
  return notasPorCriterios(detalles, null).filter((nota) => !CODIGOS_CON_SECCION.has(nota.codigo));
}

/**
 * Texto del «Detallar» de un criterio en el informe oficial: su observacion con cualquier valor
 * (SIG puede detallar tambien un NO). La empresa va primero; en las personas se antepone el nombre.
 */
export function detalleCriterio(detalles: DdMatrizEvaluacionDetalleDTO[], codigo: string): string | null {
  const ordenados = [...detalles].sort(
    (a, b) =>
      Number(b.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA) - Number(a.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA),
  );
  const textos = ordenados.flatMap((detalle) => {
    const texto = detalle.listas.find((lista) => lista.codigo === codigo)?.observacion?.trim();
    if (!texto) return [];
    return [detalle.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA ? texto : `${detalle.nombre}: ${texto}`];
  });
  return textos.length > 0 ? textos.join(" ") : null;
}

export function resumenInforme(detalles: DdMatrizEvaluacionDetalleDTO[]): DdInformeResumen {
  const sigCompleto = detalles.every((detalle) => Boolean(detalle.sig.resultado || detalle.sig.conclusion));
  const reputacionalCompleto = detalles.every(
    (detalle) => Boolean(detalle.reputacional.resultado || detalle.reputacional.conclusion),
  );
  const complianceCompleto = detalles.every(
    (detalle) => Boolean(detalle.compliance.resultado || detalle.compliance.conclusion),
  );
  return {
    totalVinculos: detalles.length,
    pendientes: detalles.filter((detalle) => !detalle.resultadoFinal).length,
    conObservaciones: detalles.filter(
      (detalle) =>
        detalle.sig.resultado === DD_MATRIZ_RESULTADOS.OBSERVADO ||
        detalle.reputacional.resultado === DD_MATRIZ_RESULTADOS.OBSERVADO ||
        detalle.compliance.resultado === DD_MATRIZ_RESULTADOS.OBSERVADO,
    ).length,
    totalEvidencias: evidenciasInforme(detalles).length,
    sigCompleto,
    reputacionalCompleto,
    complianceCompleto,
  };
}
