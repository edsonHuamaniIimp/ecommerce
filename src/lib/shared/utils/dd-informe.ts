import {
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_SI_NO_NA,
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

export interface DdInformeGrupo {
  expedienteId: string;
  codigo: string;
  empresaRazonSocial: string;
  empresaRuc: string;
  filas: DdMatrizEvaluacionFilaDTO[];
  totalVinculos: number;
  pendientes: number;
  conObservaciones: number;
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
        resultadoFinal: empresa.resultadoFinal ?? null,
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
 * Anexos del PDF: solo las evidencias de criterios donde el resultado del vinculo fue SI
 * (se encontro algo). Las de criterios en NO o NA, y los sustentos generales, no se anexan.
 */
export function evidenciasConHallazgo(detalles: DdMatrizEvaluacionDetalleDTO[]): DdMatrizAdjuntoDTO[] {
  const porId = new Map<string, DdMatrizAdjuntoDTO>();
  for (const detalle of detalles) {
    const codigosSi = new Set(
      detalle.listas.filter((lista) => lista.valor === DD_MATRIZ_SI_NO_NA.SI).map((lista) => lista.codigo),
    );
    for (const adjunto of detalle.adjuntos) {
      if (!adjunto.categoria.startsWith(DD_MATRIZ_CRITERIO_PREFIJO)) continue;
      if (codigosSi.has(adjunto.categoria.slice(DD_MATRIZ_CRITERIO_PREFIJO.length))) porId.set(adjunto.id, adjunto);
    }
  }
  return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Observaciones de los criterios dados, solo de criterios con resultado SI (los mismos cuyas
 * evidencias se anexan). La empresa titular va primero.
 */
export function notasPorCriterios(
  detalles: DdMatrizEvaluacionDetalleDTO[],
  codigos: readonly string[],
): DdInformeNotaCriterio[] {
  const notas: DdInformeNotaCriterio[] = [];
  const ordenados = [...detalles].sort(
    (a, b) =>
      Number(b.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA) - Number(a.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA),
  );
  for (const detalle of ordenados) {
    for (const lista of detalle.listas) {
      const texto = lista.observacion?.trim();
      if (!texto || lista.valor !== DD_MATRIZ_SI_NO_NA.SI || !codigos.includes(lista.codigo)) continue;
      notas.push({
        id: `${detalle.id}-${lista.codigo}`,
        vinculo: detalle.nombre,
        esTitular: detalle.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
        criterio: lista.label,
        texto,
      });
    }
  }
  return notas;
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
