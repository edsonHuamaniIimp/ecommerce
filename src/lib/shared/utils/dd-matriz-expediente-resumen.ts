import {
  DD_MATRIZ_TIPOS_VINCULO,
  type DdMatrizResultadoFinal,
} from "@/lib/shared/constants";
import { resultadoFinalEfectivo } from "@/lib/shared/utils/dd-matriz-evaluacion";
import type { DdMatrizEvaluacionFilaDTO } from "@/types/dto/debida-diligencia";

/** Avance agregado de un area (SIG, Comunicaciones o Legal) sobre los vinculos de un expediente. */
export interface DdMatrizAreaResumen {
  /** `observado` si algun vinculo lo esta; `aceptado` si todos estan evaluados y ninguno observado. */
  estado: "pendiente" | "parcial" | "observado" | "aceptado";
  evaluados: number;
  total: number;
}

/** Una fila de la vista extendida: un expediente (empresa) con sus indicadores clave. */
export interface DdMatrizExpedienteResumen {
  expedienteId: string;
  codigo: string;
  eventoLabel: string;
  empresaRazonSocial: string;
  empresaRuc: string;
  motivo: string | null;
  fechaIngreso: string;
  expedienteEstado: string;
  /** Id de la fila de la empresa en la matriz (destino del enlace "Abrir"). */
  empresaVinculoId: string;
  vinculoIds: string[];
  totalVinculos: number;
  vinculosObservados: number;
  sig: DdMatrizAreaResumen;
  comunicaciones: DdMatrizAreaResumen;
  legal: DdMatrizAreaResumen;
  conclusionFinal: DdMatrizResultadoFinal | null;
}

const MARCAS_OBSERVACION = ["observ", "hallazgo", "rechaz", "reforzada", "debida_diligencia"];

function esObservado(valor: string): boolean {
  const texto = valor.toLowerCase();
  return MARCAS_OBSERVACION.some((marca) => texto.includes(marca));
}

/** Agrega los resultados de un area; los valores `null` cuentan como pendientes. */
export function resumenArea(valores: (string | null)[]): DdMatrizAreaResumen {
  const total = valores.length;
  const evaluados = valores.filter((valor): valor is string => Boolean(valor));
  if (evaluados.length === 0) return { estado: "pendiente", evaluados: 0, total };
  if (evaluados.some(esObservado)) return { estado: "observado", evaluados: evaluados.length, total };
  return {
    estado: evaluados.length === total ? "aceptado" : "parcial",
    evaluados: evaluados.length,
    total,
  };
}

/** Agrupa las filas de la matriz por expediente y calcula los indicadores de cada uno. */
export function resumenesPorExpediente(filas: DdMatrizEvaluacionFilaDTO[]): DdMatrizExpedienteResumen[] {
  const grupos = new Map<string, DdMatrizEvaluacionFilaDTO[]>();
  for (const fila of filas) {
    grupos.set(fila.expedienteId, [...(grupos.get(fila.expedienteId) ?? []), fila]);
  }
  return [...grupos.values()].map((grupo) => {
    const empresa = grupo.find((fila) => fila.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA) ?? grupo[0]!;
    const observados = grupo.filter((fila) =>
      [fila.sigResultado, fila.repResultado, fila.cmpResultado].some((valor) => Boolean(valor) && esObservado(valor!)),
    ).length;
    return {
      expedienteId: empresa.expedienteId,
      codigo: empresa.codigo,
      eventoLabel: empresa.eventoLabel,
      empresaRazonSocial: empresa.empresaRazonSocial,
      empresaRuc: empresa.empresaRuc,
      motivo: empresa.motivo,
      fechaIngreso: empresa.fechaIngreso,
      expedienteEstado: empresa.expedienteEstado,
      empresaVinculoId: empresa.id,
      vinculoIds: grupo.map((fila) => fila.id),
      totalVinculos: grupo.length,
      vinculosObservados: observados,
      sig: resumenArea(grupo.map((fila) => fila.sigResultado)),
      comunicaciones: resumenArea(grupo.map((fila) => fila.repResultado)),
      legal: resumenArea(grupo.map((fila) => fila.cmpResultado)),
      conclusionFinal: resultadoFinalEfectivo(empresa.resultadoFinal, empresa.expedienteEstado),
    };
  });
}
