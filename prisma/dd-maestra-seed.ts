import {
  DD_DOCUMENTO_ESTADO_LABELS,
  DD_DOCUMENTO_ESTADOS,
  DD_ESTADO_EVALUACION_LABELS,
  DD_ESTADO_LABELS,
  DD_ESTADO_RELACION_LABELS,
  DD_ESTADOS,
  DD_ESTADOS_EVALUACION,
  DD_ESTADOS_RELACION,
  DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS,
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_CONCLUSION_LABELS,
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADO_LABELS,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_REPUTACION_ESTADO_LABELS,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_RESULTADO_LABELS,
  DD_REPUTACION_RESULTADOS,
  DD_REPUTACION_RESULTADOS_OPCIONES,
  DD_REPOSITORIO_IMPORT_CATEGORIA_AYUDAS,
  DD_REPOSITORIO_IMPORT_CATEGORIAS,
} from "../src/lib/shared/constants";

export type DdMaestraSeedItem = {
  tipo: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
};

function filas(
  tipo: string,
  codigos: Record<string, string>,
  etiquetas: Record<string, string>,
  activos: ReadonlySet<string> | null = null,
): DdMaestraSeedItem[] {
  return Object.values(codigos).map((codigo, indice) => ({
    tipo,
    codigo,
    nombre: etiquetas[codigo] ?? codigo,
    descripcion: null,
    orden: indice + 1,
    activo: activos ? activos.has(codigo) : true,
  }));
}

const resultadosReputacionActivos = new Set<string>(DD_REPUTACION_RESULTADOS_OPCIONES);

export const DD_MAESTRA_SEED: DdMaestraSeedItem[] = [
  ...filas("expediente_estado", DD_ESTADOS, DD_ESTADO_LABELS),
  ...filas("reputacion_estado", DD_REPUTACION_ESTADOS, DD_REPUTACION_ESTADO_LABELS),
  ...filas(
    "reputacion_resultado",
    DD_REPUTACION_RESULTADOS,
    DD_REPUTACION_RESULTADO_LABELS,
    resultadosReputacionActivos,
  ),
  ...filas("matriz_resultado", DD_MATRIZ_RESULTADOS, DD_MATRIZ_RESULTADO_LABELS),
  ...filas("matriz_conclusion", DD_MATRIZ_CONCLUSIONES, DD_MATRIZ_CONCLUSION_LABELS),
  ...filas(
    "matriz_resultado_final",
    DD_MATRIZ_RESULTADOS_FINALES,
    DD_MATRIZ_RESULTADO_FINAL_LABELS,
  ),
  ...filas("matriz_tipo_vinculo", DD_MATRIZ_TIPOS_VINCULO, DD_MATRIZ_TIPO_VINCULO_LABELS),
  ...filas("matriz_adjunto_categoria", DD_MATRIZ_ADJUNTO_CATEGORIAS, DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS),
  ...DD_REPOSITORIO_IMPORT_CATEGORIAS.map((categoria, indice) => ({
    tipo: "repositorio_import_categoria",
    codigo: categoria.value,
    nombre: categoria.label,
    descripcion: DD_REPOSITORIO_IMPORT_CATEGORIA_AYUDAS[categoria.value] ?? null,
    orden: indice + 1,
    activo: true,
  })),
  ...filas("documento_estado", DD_DOCUMENTO_ESTADOS, DD_DOCUMENTO_ESTADO_LABELS),
  ...filas("estado_evaluacion", DD_ESTADOS_EVALUACION, DD_ESTADO_EVALUACION_LABELS),
  ...filas("estado_relacion", DD_ESTADOS_RELACION, DD_ESTADO_RELACION_LABELS),
];
