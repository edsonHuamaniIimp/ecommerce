import {
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_TIPOS_VINCULO,
} from "@/lib/shared/constants";
import type {
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

/** Evidencias de todos los vinculos, sin duplicados. */
export function evidenciasInforme(detalles: DdMatrizEvaluacionDetalleDTO[]): DdMatrizAdjuntoDTO[] {
  const porId = new Map<string, DdMatrizAdjuntoDTO>();
  for (const detalle of detalles) {
    for (const adjunto of detalle.adjuntos) porId.set(adjunto.id, adjunto);
  }
  return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
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
