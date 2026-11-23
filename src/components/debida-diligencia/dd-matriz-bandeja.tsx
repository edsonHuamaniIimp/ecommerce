"use client";

import { esVinculoEmpresa, etiquetaTipoVinculo } from "@/lib/shared/utils/dd-matriz-vinculo-vista";
import { pendientesPorExpediente } from "@/lib/shared/utils/dd-matriz-conclusiones";
import type { DdVinculoSinConclusion } from "@/lib/shared/utils/dd-matriz-conclusiones";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Table2,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import type {
  DdMatrizEvaluacionExportarRequestDTO,
  DdMatrizEvaluacionFilaDTO,
  DdMatrizEvaluacionResponseDTO,
  DdMatrizEvaluacionResumenDTO,
  DdVinculoObservadoRequestDTO,
} from "@/types/dto/debida-diligencia";

import { DdPaisBandera } from "./dd-pais-bandera";
import { DdEventoSelect } from "./dd-evento-select";
import { DdRevisionModal } from "./dd-revision-modal";
import { useConfirm } from "@/hooks/use-confirm";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  BADGE_STYLES,
  DD_ACCIONES_REVISION,
  DD_ESTADOS,
  DD_MATRIZ_AMBITO_LABELS,
  DD_MATRIZ_FILTRO_SIN_EVALUAR,
  DD_MATRIZ_FILTRO_SIN_PAIS,
  DD_MATRIZ_FILTRO_TODOS,
  DD_MATRIZ_ORIGENES,
  DD_EVENTO_TODOS,
  DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS,
  DD_MATRIZ_CONCLUSION_LABELS,
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_CONCLUSIONES_COMPLIANCE,
  DD_MATRIZ_FINAL_COMENTARIO_MAX,
  DD_MATRIZ_PER_PAGE_DEFAULT,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADO_LABELS,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_AREA_CONCLUSION_LABELS,
  DD_MATRIZ_FILTRO_FECHA,
  DD_MATRIZ_FILTRO_FECHA_LABELS,
  type DdMatrizFiltroFecha,
  DD_MATRIZ_EVAL_PER_PAGE_MAX,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_REPUTACION_RESULTADO_LABELS,
  DD_REPUTACION_RESULTADOS,
  DD_RUTAS,
  PER_PAGE_OPCIONES,
  REGEX_PAIS,
  type DdDocumentoTipo,
  type DdMatrizResultadoFinal,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";
import {
  etiquetaCantidadVinculos,
  resultadoFinalEfectivo,
} from "@/lib/shared/utils/dd-matriz-evaluacion";
import { COLUMNAS_MATRIZ_CSV, exportarMatrizExcel } from "@/lib/shared/utils/dd-matriz-excel";
import { exportarTablaCsv, nombreArchivoExport } from "@/lib/shared/utils/export-tabla";
import { nombrePais } from "@/lib/shared/utils/pais";
import { rangoDeFiltroFecha } from "@/lib/shared/utils/dd-matriz-filtro-fecha";
import { DdPaisMultiSelect } from "./dd-pais-multi-select";

interface Filtros {
  eventoId: string;
  page: number;
  perPage: number;
  search: string;
  tipo: string;
  ambito: string;
  /** Codigos ISO elegidos (y/o "sin_pais"); vacio = todos. */
  paises: string[];
  fechaPreset: DdMatrizFiltroFecha;
  fechaDesde: string;
  fechaHasta: string;
  resultadoFinal: string;
}

const FILTROS_INICIALES: Filtros = {
  eventoId: DD_EVENTO_TODOS,
  page: 1,
  perPage: DD_MATRIZ_PER_PAGE_DEFAULT,
  search: "",
  tipo: DD_MATRIZ_FILTRO_TODOS,
  ambito: DD_MATRIZ_FILTRO_TODOS,
  paises: [],
  fechaPreset: DD_MATRIZ_FILTRO_FECHA.TODOS,
  fechaDesde: "",
  fechaHasta: "",
  resultadoFinal: DD_MATRIZ_FILTRO_TODOS,
};

interface GrupoEmpresa {
  expedienteId: string;
  eventoId: string;
  eventoLabel: string;
  empresaRazonSocial: string;
  empresaRuc: string;
  codigo: string;
  motivo: string | null;
  eventoProyecto: string | null;
  fechaIngreso: string;
  filas: DdMatrizEvaluacionFilaDTO[];
}


function filtrosComunes(filtros: Filtros): DdMatrizEvaluacionExportarRequestDTO {
  const sinEvaluar = filtros.resultadoFinal === DD_MATRIZ_FILTRO_SIN_EVALUAR;
  return {
    eventoId: filtros.eventoId,
    search: filtros.search.trim() || undefined,
    tipo: filtros.tipo !== DD_MATRIZ_FILTRO_TODOS ? filtros.tipo : undefined,
    ambito: filtros.ambito !== DD_MATRIZ_FILTRO_TODOS ? filtros.ambito : undefined,
    pais: filtros.paises.filter((pais) => REGEX_PAIS.test(pais)).join(",") || undefined,
    sinPais: filtros.paises.includes(DD_MATRIZ_FILTRO_SIN_PAIS) || undefined,
    ...rangoDeFiltroFecha(filtros.fechaPreset, filtros),
    resultadoFinal:
      filtros.resultadoFinal !== DD_MATRIZ_FILTRO_TODOS && !sinEvaluar ? filtros.resultadoFinal : undefined,
    sinEvaluar: sinEvaluar || undefined,
  };
}

function consultaDe(filtros: Filtros) {
  return { ...filtrosComunes(filtros), page: filtros.page, perPage: filtros.perPage, porEmpresa: true };
}

function contarFinal(
  resumen: DdMatrizEvaluacionResumenDTO | null,
  codigo: DdMatrizResultadoFinal | null,
  porEmpresa = false,
): number {
  const conteos = porEmpresa ? resumen?.resultadoFinalEmpresas : resumen?.resultadoFinal;
  return conteos?.find((item) => item.valor === codigo)?.total ?? 0;
}

/** Porcentaje declarado en el cargo; los beneficiarios lo guardan como "Beneficiario final (10%)". */
function porcentajeParticipacion(cargo: string | null): string | null {
  const coincidencia = cargo?.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const valor = coincidencia?.[1];
  if (!valor) return null;
  return `${Number(valor.replace(",", ".")).toFixed(2)}%`;
}

/** Estado compacto de un área (SIG, Comunicaciones o Legal), con su conclusión. */
function EstadoArea({
  resultado,
  conclusion,
  compliance = false,
  reputacional = false,
  variant = "pill",
}: {
  resultado: string | null;
  conclusion: string | null;
  compliance?: boolean;
  reputacional?: boolean;
  variant?: "pill" | "dot";
}) {
  const catalogoResultado: Record<string, string> = compliance
    ? DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS
    : reputacional
      ? DD_REPUTACION_RESULTADO_LABELS
      : DD_MATRIZ_RESULTADO_LABELS;
  const catalogoConclusion: Record<string, string> = compliance
    ? DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS
    : DD_MATRIZ_CONCLUSION_LABELS;
  const resultadoNormalizado = reputacional
    ? ddUtils.normalizarResultadoReputacion(resultado)
    : resultado;
  const etiquetaResultado = resultadoNormalizado
    ? (catalogoResultado[resultadoNormalizado] ?? resultadoNormalizado)
    : null;
  const etiquetaConclusion = conclusion ? (catalogoConclusion[conclusion] ?? conclusion) : null;

  if (!etiquetaResultado && !etiquetaConclusion) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-medium text-slate-600">
        <Clock3 className="h-3 w-3" />
        Pendiente
      </span>
    );
  }

  const observado =
    resultadoNormalizado === DD_MATRIZ_RESULTADOS.OBSERVADO ||
    resultadoNormalizado === DD_REPUTACION_RESULTADOS.OBSERVADO ||
    resultadoNormalizado === DD_MATRIZ_CONCLUSIONES_COMPLIANCE.ACEPTADO_CON_OBSERVACIONES ||
    conclusion === DD_MATRIZ_CONCLUSIONES.OBSERVADO ||
    conclusion === DD_MATRIZ_CONCLUSIONES.REQUIERE_DEBIDA_DILIGENCIA ||
    conclusion === DD_MATRIZ_CONCLUSIONES_COMPLIANCE.ACEPTADO_CON_OBSERVACIONES;
  const aceptado =
    resultadoNormalizado === DD_MATRIZ_RESULTADOS.ACEPTADO ||
    resultadoNormalizado === DD_REPUTACION_RESULTADOS.ACEPTADO ||
    resultadoNormalizado === DD_MATRIZ_CONCLUSIONES_COMPLIANCE.ACEPTADO;
  const rechazado =
    resultadoNormalizado === DD_MATRIZ_CONCLUSIONES_COMPLIANCE.RECHAZADO ||
    conclusion === DD_MATRIZ_CONCLUSIONES_COMPLIANCE.RECHAZADO;
  const enRevision =
    !observado &&
    !rechazado &&
    (!resultadoNormalizado ||
      resultadoNormalizado === DD_REPUTACION_RESULTADOS.EN_REVISION ||
      conclusion === DD_MATRIZ_CONCLUSIONES.EN_REVISION);
  const color = rechazado
    ? "border-red-300 bg-red-50 text-red-900"
    : observado
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : aceptado
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : enRevision
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-slate-200 bg-slate-50 text-slate-600";
  const textColor = rechazado
    ? "text-red-800"
    : observado
      ? "text-amber-800"
      : aceptado
        ? "text-emerald-800"
        : enRevision
          ? "text-blue-800"
          : "text-slate-600";
  const dotColor = rechazado
    ? "bg-red-600"
    : observado
      ? "bg-amber-600"
      : aceptado
        ? "bg-emerald-600"
        : enRevision
          ? "bg-blue-600"
          : "bg-slate-400";
  const conclusionDotColor = rechazado
    ? "bg-red-600"
    : conclusion === DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA ||
        conclusion === DD_MATRIZ_CONCLUSIONES.OBSERVADO ||
        conclusion === DD_MATRIZ_CONCLUSIONES.REQUIERE_DEBIDA_DILIGENCIA ||
        conclusion === DD_MATRIZ_CONCLUSIONES_COMPLIANCE.ACEPTADO_CON_OBSERVACIONES
      ? "bg-amber-600"
      : conclusion === DD_MATRIZ_CONCLUSIONES.EN_REVISION
        ? "bg-blue-600"
        : conclusion
          ? "bg-emerald-600"
          : "bg-slate-400";
  const Icono = rechazado ? XCircle : observado ? AlertTriangle : aceptado ? CheckCircle2 : Clock3;

  return (
    <div className="space-y-1">
      {etiquetaResultado ? (
        <div className="space-y-0.5">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
            Resultado
          </p>
          {variant === "dot" ? (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${textColor}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
              {etiquetaResultado}
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}>
              <Icono className="h-3 w-3" />
              {etiquetaResultado}
            </span>
          )}
        </div>
      ) : null}
      {etiquetaConclusion ? (
        <p
          className="flex max-w-[170px] items-start gap-1.5 text-[9px] leading-tight text-muted-foreground"
          title={etiquetaConclusion}
        >
          <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${conclusionDotColor}`} />
          <span>
            <span className="font-semibold uppercase tracking-wide">Conclusión: </span>
            {etiquetaConclusion}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Estado lineal de Comunicaciones: solo muestra la etapa actual. */
function EstadoComunicaciones({ fila }: { fila: DdMatrizEvaluacionFilaDTO }) {
  if (fila.reputacionCasos === 0) {
    return (
      <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-800">
        No derivado
      </span>
    );
  }

  if (fila.repResultado || fila.repConclusion) {
    return (
      <div className="space-y-1">
        <EstadoArea
          resultado={fila.repResultado}
          conclusion={fila.repConclusion}
          reputacional
        />
        {!fila.repConclusion ? (
          <p className="flex items-start gap-1.5 text-[9px] leading-tight text-muted-foreground">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
            <span>
              <span className="font-semibold uppercase tracking-wide">Conclusión: </span>
              Pendiente dictamen SIG
            </span>
          </p>
        ) : null}
      </div>
    );
  }

  if (fila.reputacionEnAnalisis > 0) {
    return (
      <div className="space-y-0.5">
        <span className="inline-flex rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-semibold text-sky-800">
          En revisión
        </span>
        <p className="text-[9px] text-muted-foreground">
          {fila.reputacionEnAnalisis} caso(s) en revisión
        </p>
      </div>
    );
  }

  if (fila.reputacionPendientes > 0) {
    return (
      <span className="inline-flex rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-semibold text-sky-800">
        Derivado
      </span>
    );
  }

  return (
    <span className="inline-flex rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-semibold text-violet-800">
      Pendiente dictamen SIG
    </span>
  );
}

/** Resultado final con la paleta de estados de la matriz del Stitch. */
function ResultadoFinalStitch({ valor }: { valor: string | null }) {
  if (!valor) {
    return (
      <span className="inline-flex rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
        Sin evaluar
      </span>
    );
  }
  const estilos: Record<string, string> = {
    [DD_MATRIZ_RESULTADOS_FINALES.APTO]: "border-emerald-300 bg-emerald-100 text-emerald-900",
    [DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES]: "border-amber-300 bg-amber-100 text-amber-900",
    [DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA]: "border-amber-300 bg-amber-100 text-amber-900",
    [DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION]: "border-blue-300 bg-blue-100 text-blue-900",
    [DD_MATRIZ_RESULTADOS_FINALES.NO_APTO]: "border-red-300 bg-red-100 text-red-900",
    [DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA]: "border-slate-300 bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${estilos[valor] ?? "border-slate-300 bg-slate-100 text-slate-700"}`}>
      {DD_MATRIZ_RESULTADO_FINAL_LABELS[valor as DdMatrizResultadoFinal] ?? valor}
    </span>
  );
}

/** Bandeja operativa de la matriz, siguiendo la vista "Matriz DD" del Stitch refinado. */
export function DdMatrizBandeja() {
  const [data, setData] = useState<DdMatrizEvaluacionResponseDTO | null>(null);
  const [resumen, setResumen] = useState<DdMatrizEvaluacionResumenDTO | null>(null);
  /* Cards: "dd" cuenta empresas (resultado de la DD); "matriz" cuenta vinculos. */
  const [vistaCards, setVistaCards] = useState<"dd" | "matriz">("dd");
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formato, setFormato] = useState<"cards" | "tabla">("tabla");
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [revisionFila, setRevisionFila] = useState<{
    id: string;
    codigo: string;
    estado: string;
    empresa: { razonSocial: string; ruc: string };
  } | null>(null);
  const [exportando, setExportando] = useState<"csv" | "xlsx" | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [procesando, setProcesando] = useState<string | null>(null);
  const [aceptarAbierto, setAceptarAbierto] = useState(false);
  const [aceptarComentario, setAceptarComentario] = useState("");
  const [legalAbierto, setLegalAbierto] = useState(false);
  const [legalMotivo, setLegalMotivo] = useState("");
  const [legalInforme, setLegalInforme] = useState("");
  const [legalVerificando, setLegalVerificando] = useState(false);
  const [legalPendientes, setLegalPendientes] = useState<
    { expedienteId: string; codigo: string; empresa: string; vinculos: DdVinculoSinConclusion[] }[]
  >([]);
  const [legalNoVerificado, setLegalNoVerificado] = useState(false);
  const [legalAcepta, setLegalAcepta] = useState(false);
  const filtrosRef = useRef(filtros);
  const { confirm, confirmDialog } = useConfirm();

  const cargar = useCallback(async (siguientes?: Filtros, conResumen = false) => {
    const actual = siguientes ?? filtrosRef.current;
    filtrosRef.current = actual;
    try {
      const respuesta = await ddMatrizEvaluacionService.listar(consultaDe(actual));
      setData(respuesta);
      if (conResumen) setResumen(await ddMatrizEvaluacionService.resumen(actual.eventoId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la matriz");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar(undefined, true);
  }, [cargar]);

  const aplicar = (cambios: Partial<Filtros>, conResumen = false) => {
    const siguientes = { ...filtrosRef.current, page: 1, ...cambios };
    setLoading(true);
    setFiltros(siguientes);
    void cargar(siguientes, conResumen);
  };

  const filtrosActivos =
    [filtros.eventoId, filtros.tipo, filtros.ambito, filtros.resultadoFinal].filter(
      (valor) => valor !== DD_MATRIZ_FILTRO_TODOS,
    ).length +
    (filtros.paises.length > 0 ? 1 : 0) +
    (filtros.fechaPreset !== DD_MATRIZ_FILTRO_FECHA.TODOS ? 1 : 0);

  const idsPagina = data?.data.map((fila) => fila.id) ?? [];
  const marcadosPagina = idsPagina.filter((id) => seleccion.has(id)).length;
  const estadoCabecera: boolean | "indeterminate" =
    idsPagina.length > 0 && marcadosPagina === idsPagina.length ? true : marcadosPagina > 0 ? "indeterminate" : false;

  const alternar = (id: string, marcado: boolean) =>
    setSeleccion((previa) => {
      const siguiente = new Set(previa);
      if (marcado) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });

  const alternarFila = (event: ReactMouseEvent<HTMLElement>, id: string) => {
    const target = event.target as HTMLElement;
    if (target.closest("a,button,input,[role='checkbox']")) return;
    alternar(id, !seleccion.has(id));
  };

  const alternarPagina = (marcado: boolean) =>
    setSeleccion((previa) => {
      const siguiente = new Set(previa);
      for (const id of idsPagina) {
        if (marcado) siguiente.add(id);
        else siguiente.delete(id);
      }
      return siguiente;
    });

  const alternarGrupo = (expedienteId: string) =>
    setAbiertos((previos) => {
      if (formato === "tabla") {
        return previos.has(expedienteId) ? new Set() : new Set([expedienteId]);
      }
      const siguiente = new Set(previos);
      if (siguiente.has(expedienteId)) siguiente.delete(expedienteId);
      else siguiente.add(expedienteId);
      return siguiente;
    });

  const cambiarFormato = (nuevo: "cards" | "tabla") => {
    setFormato(nuevo);
    if (nuevo === "tabla") {
      setAbiertos((previos) => {
        const primero = previos.values().next().value;
        return primero ? new Set([primero]) : new Set();
      });
    }
  };

  const grupos = useMemo<GrupoEmpresa[]>(() => {
    if (!data) return [];
    const mapa = new Map<string, GrupoEmpresa>();
    for (const fila of data.data) {
      const actual = mapa.get(fila.expedienteId);
      if (actual) {
        actual.filas.push(fila);
        continue;
      }
      mapa.set(fila.expedienteId, {
        expedienteId: fila.expedienteId,
        eventoId: fila.eventoId,
        eventoLabel: fila.eventoLabel,
        empresaRazonSocial: fila.empresaRazonSocial,
        empresaRuc: fila.empresaRuc,
        codigo: fila.codigo,
        motivo: fila.motivo,
        eventoProyecto: fila.eventoProyecto,
        fechaIngreso: fila.fechaIngreso,
        filas: [fila],
      });
    }
    return [...mapa.values()];
  }, [data]);

  const filasSeleccionadas = useMemo(
    () => data?.data.filter((fila) => seleccion.has(fila.id)) ?? [],
    [data, seleccion],
  );
  const expedientesSeleccionados = useMemo(
    () => [...new Set(filasSeleccionadas.map((fila) => fila.expedienteId))],
    [filasSeleccionadas],
  );
  const expedientesParaComunicaciones = expedientesSeleccionados;
  const legalYaDerivado =
    filasSeleccionadas.length > 0 &&
    filasSeleccionadas.every((fila) => fila.expedienteEstado === DD_ESTADOS.EN_LEGAL);

  const exportar = async (formato: "csv" | "xlsx") => {
    setExportando(formato);
    try {
      const respuesta = await ddMatrizEvaluacionService.exportar(
        /* La exportacion depende solo de los filtros; la seleccion de la bandeja es para las acciones. */
        filtrosComunes(filtrosRef.current),
      );
      if (respuesta.data.length === 0) {
        toast.error("No hay registros para exportar con los filtros actuales");
        return;
      }
      if (formato === "csv") {
        exportarTablaCsv(respuesta.data, COLUMNAS_MATRIZ_CSV, nombreArchivoExport("dd-matriz-evaluacion", "csv"));
      } else {
        await exportarMatrizExcel(respuesta.data, nombreArchivoExport("dd-matriz-evaluacion", "xlsx"));
      }
      toast.success(`${respuesta.data.length} vínculo(s) exportado(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar la matriz");
    } finally {
      setExportando(null);
    }
  };

  const marcarAceptado = () => {
    if (filasSeleccionadas.length === 0) return;
    setAceptarComentario("");
    setAceptarAbierto(true);
  };

  const confirmarAceptar = async () => {
    if (!aceptarComentario.trim()) {
      toast.error("Escribe el comentario interno antes de marcar los vínculos como APTO");
      return;
    }
    setAceptarAbierto(false);
    setProcesando("aceptar");
    try {
      for (const fila of filasSeleccionadas) {
        await ddMatrizEvaluacionService.guardar({
          id: fila.id,
          resultadoFinal: DD_MATRIZ_RESULTADOS_FINALES.APTO,
          finalComentario: aceptarComentario.trim(),
        });
      }
      toast.success(`${filasSeleccionadas.length} vínculo(s) marcado(s) como APTO`);
      setSeleccion(new Set());
      await cargar(undefined, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron marcar los vínculos");
    } finally {
      setProcesando(null);
    }
  };

  const enviarComunicaciones = async () => {
    if (filasSeleccionadas.length === 0) return;
    const vinculosPorExpediente = new Map<string, string[]>();
    for (const fila of filasSeleccionadas) {
      const actuales = vinculosPorExpediente.get(fila.expedienteId) ?? [];
      actuales.push(fila.id);
      vinculosPorExpediente.set(fila.expedienteId, actuales);
    }

    const expedienteIds = [...vinculosPorExpediente.keys()];
    let detalles: Awaited<ReturnType<typeof debidaDiligenciaService.detalle>>[];
    try {
      detalles = await Promise.all(
        expedienteIds.map((id) => debidaDiligenciaService.detalle(id)),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo validar la declaración de vínculos");
      return;
    }
    const sinDeclarar = detalles.filter((detalle) => !detalle.vinculosCompletos);
    if (sinDeclarar.length > 0) {
      await confirm({
        title: "Vínculos no declarados",
        description: `Aún no se ha declarado que todos los vínculos estén registrados y completos para: ${sinDeclarar
          .map((detalle) => detalle.codigo)
          .join(", ")}. Abre “Revisar expediente”, marca la declaración y vuelve a intentar.`,
        confirmLabel: "Entendido",
        cancelLabel: "Cerrar",
      });
      return;
    }

    const ok = await confirm({
      title: "Enviar a Comunicaciones",
      description: `Se derivarán ${filasSeleccionadas.length} vínculo(s) de ${vinculosPorExpediente.size} expediente(s) a Comunicaciones.`,
      confirmLabel: "Enviar a Comunicaciones",
    });
    if (!ok) return;
    setProcesando("comunicaciones");
    try {
      let derivados = 0;
      for (const [expedienteId, vinculoIds] of vinculosPorExpediente) {
        const respuesta = await debidaDiligenciaService.derivarComunicaciones(
          expedienteId,
          vinculoIds,
        );
        derivados += respuesta.derivados;
      }
      if (derivados === 0) {
        toast.info("No hay vínculos nuevos para Comunicaciones");
      } else {
        toast.success(`${derivados} vínculo(s) nuevo(s) derivado(s) a Comunicaciones`);
      }
      setSeleccion(new Set());
      await cargar(undefined, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo derivar a Comunicaciones");
    } finally {
      setProcesando(null);
    }
  };

  const abrirLegal = () => {
    if (expedientesSeleccionados.length === 0) return;
    setLegalMotivo("");
    setLegalInforme("");
    setLegalPendientes([]);
    setLegalNoVerificado(false);
    setLegalAcepta(false);
    setLegalVerificando(true);
    setLegalAbierto(true);
    /* Se revisan todos los vinculos de cada expediente (no solo los seleccionados): Legal recibe el expediente completo. */
    const resumenes = new Map(filasSeleccionadas.map((fila) => [fila.expedienteId, fila]));
    void Promise.all(
      expedientesSeleccionados.map((expedienteId) =>
        ddMatrizEvaluacionService.listar({ expedienteId, perPage: DD_MATRIZ_EVAL_PER_PAGE_MAX }),
      ),
    )
      .then((respuestas) => {
        const pendientes = pendientesPorExpediente(respuestas.flatMap((respuesta) => respuesta.data));
        setLegalPendientes(
          [...pendientes].map(([expedienteId, vinculos]) => ({
            expedienteId,
            codigo: resumenes.get(expedienteId)?.codigo ?? "",
            empresa: resumenes.get(expedienteId)?.empresaRazonSocial ?? "",
            vinculos,
          })),
        );
      })
      .catch(() => setLegalNoVerificado(true))
      .finally(() => setLegalVerificando(false));
  };

  const hayPendientesLegal = legalNoVerificado || legalPendientes.length > 0;
  const legalListoParaDerivar = !legalVerificando && (!hayPendientesLegal || legalAcepta);

  const asignarLegal = async () => {
    if (!legalMotivo.trim()) {
      toast.error("Indica el motivo de la derivación a Legal");
      return;
    }
    if (!legalListoParaDerivar) return;
    setProcesando("legal");
    try {
      for (const expedienteId of expedientesSeleccionados) {
        await debidaDiligenciaService.revisar({
          expedienteId,
          accion: DD_ACCIONES_REVISION.RECHAZAR,
          motivo: legalMotivo.trim(),
          informeLogisticaUrl: legalInforme.trim() || null,
          documentosObservados: [],
          observaciones: [],
        });
      }
      toast.success(`${expedientesSeleccionados.length} expediente(s) derivado(s) a Legal`);
      setLegalAbierto(false);
      setSeleccion(new Set());
      await cargar(undefined, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo derivar a Legal");
    } finally {
      setProcesando(null);
    }
  };

  const porEmpresa = vistaCards === "dd";
  const aprobados = contarFinal(resumen, DD_MATRIZ_RESULTADOS_FINALES.APTO, porEmpresa);
  const observados =
    contarFinal(resumen, DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES, porEmpresa) +
    contarFinal(resumen, DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA, porEmpresa);
  /* Pendientes = sin resultado final + en revision (incluye lo derivado a Legal): todo lo aun no cerrado. */
  const pendientes =
    contarFinal(resumen, null, porEmpresa) + contarFinal(resumen, DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION, porEmpresa);
  const sinRespuesta = contarFinal(resumen, DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA, porEmpresa);
  const noAptos = contarFinal(resumen, DD_MATRIZ_RESULTADOS_FINALES.NO_APTO, porEmpresa);

  const stats = [
    {
      titulo: "Empresas",
      valor: resumen?.empresas ?? 0,
      detalle: "Titulares con evaluación",
      icono: <Building2 className="h-4 w-4" />,
      color: "text-primary bg-primary/10",
    },
    {
      titulo: "Vínculos",
      valor: resumen?.total ?? 0,
      detalle: "Sujetos evaluados (matriz)",
      icono: <Users className="h-4 w-4" />,
      color: "text-primary bg-primary/10",
    },
    {
      titulo: "Pendientes",
      valor: pendientes,
      detalle: "Sin evaluación final o en revisión",
      icono: <Clock3 className="h-4 w-4" />,
      color: "text-blue-700 bg-blue-50",
    },
    {
      titulo: "APTO CON OBS.",
      valor: observados,
      detalle: "Apto con observaciones / documentación",
      icono: <AlertTriangle className="h-4 w-4" />,
      color: "text-amber-700 bg-amber-50",
    },
    {
      titulo: "APTO",
      valor: aprobados,
      detalle: "Resultado final APTO",
      icono: <CheckCircle2 className="h-4 w-4" />,
      color: "text-emerald-700 bg-emerald-50",
    },
    {
      titulo: "NO APTO",
      valor: noAptos,
      detalle: "Bloqueo de la empresa",
      icono: <XCircle className="h-4 w-4" />,
      color: "text-red-700 bg-red-50",
    },
    {
      titulo: "SIN RESPUESTA",
      valor: sinRespuesta,
      detalle: "Cierre sin respuesta del cliente",
      icono: <Clock3 className="h-4 w-4" />,
      color: "text-slate-700 bg-slate-100",
    },
    {
      titulo: "DD reforzada",
      valor: resumen?.requierenReforzada ?? 0,
      detalle: "Derivados a Compliance",
      icono: <ShieldAlert className="h-4 w-4" />,
      color: "text-violet-700 bg-violet-50",
    },
  ];

  return (
    <section className={`space-y-4 ${seleccion.size > 0 ? "pb-24" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Debida Diligencia / Matriz
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Matriz DD</h1>
                <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}>
                  <span>Supervisión activa</span>
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Monitoreo centralizado de debida diligencia de contrapartes, participantes y vínculos comerciales.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Evento</span>
            <DdEventoSelect
              value={filtros.eventoId}
              onChange={(valor) => aplicar({ eventoId: valor }, true)}
              incluirTodos
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={exportando !== null || loading}
            onClick={() => { void exportar("xlsx"); }}
          >
            <FileSpreadsheet className={`h-3.5 w-3.5 ${exportando === "xlsx" ? "animate-pulse" : ""}`} />
            <span>{exportando === "xlsx" ? "Exportando..." : "Exportar matriz"}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={exportando !== null || loading}
            onClick={() => { void exportar("csv"); }}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>CSV</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={loading}
            onClick={() => aplicar({ page: filtrosRef.current.page }, true)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Recargar</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">Resultados por:</span>
        {(
          [
            ["dd", "DD (por empresa)"],
            ["matriz", "Matriz (por vínculo)"],
          ] as const
        ).map(([valor, etiqueta]) => (
          <Button
            key={valor}
            type="button"
            size="sm"
            variant={vistaCards === valor ? "default" : "outline"}
            className="h-7 px-2.5 text-[11px]"
            aria-pressed={vistaCards === valor}
            onClick={() => setVistaCards(valor)}
          >
            {etiqueta}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {stats.map((stat) => (
          <div key={stat.titulo} className="rounded-xl border border-border bg-card p-3">
            <div className={`mb-2 inline-flex rounded-md p-1.5 ${stat.color}`}>{stat.icono}</div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.titulo}</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{stat.valor}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{stat.detalle}</p>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa, RUC, persona o documento..."
                value={filtros.search}
                onChange={(evento) => setFiltros((previos) => ({ ...previos, search: evento.target.value }))}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter") aplicar({ search: evento.currentTarget.value });
                }}
                className="h-8 border-border bg-secondary pl-8 text-xs placeholder:text-muted-foreground/60"
              />
            </div>
            <Button
              type="button"
              variant={filtersOpen ? "default" : "outline"}
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
              onClick={() => setFiltersOpen((valor) => !valor)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filtros</span>
              {filtrosActivos > 0 ? (
                <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-bold">{filtrosActivos}</span>
              ) : null}
            </Button>
            <div className="flex shrink-0 items-center rounded-md border border-border bg-card p-0.5">
              <Button
                type="button"
                variant={formato === "cards" ? "default" : "ghost"}
                size="sm"
                className="h-7 gap-1 px-2 text-[10px]"
                onClick={() => cambiarFormato("cards")}
                aria-pressed={formato === "cards"}
              >
                <LayoutGrid className="h-3 w-3" /><span>Cards</span>
              </Button>
              <Button
                type="button"
                variant={formato === "tabla" ? "default" : "ghost"}
                size="sm"
                className="h-7 gap-1 px-2 text-[10px]"
                onClick={() => cambiarFormato("tabla")}
                aria-pressed={formato === "tabla"}
              >
                <Table2 className="h-3 w-3" /><span>Tabla</span>
              </Button>
            </div>
            <Select value={String(filtros.perPage)} onValueChange={(valor) => aplicar({ perPage: Number(valor) })}>
              <SelectTrigger className="h-8 w-[80px] shrink-0 border-border text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PER_PAGE_OPCIONES.map((numero) => (
                  <SelectItem key={numero} value={String(numero)}><span>{numero}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtersOpen ? (
            <div className="grid gap-2 rounded-lg border border-border bg-secondary/40 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="mxb-tipo">Tipo de sujeto</label>
                <Select value={filtros.tipo} onValueChange={(valor) => aplicar({ tipo: valor })}>
                  <SelectTrigger id="mxb-tipo" className="h-8 border-border text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_MATRIZ_FILTRO_TODOS}><span>Todos</span></SelectItem>
                    {Object.entries(DD_MATRIZ_TIPO_VINCULO_LABELS).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="mxb-ambito">Nacional / extranjera</label>
                <Select value={filtros.ambito} onValueChange={(valor) => aplicar({ ambito: valor })}>
                  <SelectTrigger id="mxb-ambito" className="h-8 border-border text-xs"><SelectValue placeholder="Ámbito" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_MATRIZ_FILTRO_TODOS}><span>Todos</span></SelectItem>
                    {Object.entries(DD_MATRIZ_AMBITO_LABELS).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="mxb-final">Resultado final</label>
                <Select value={filtros.resultadoFinal} onValueChange={(valor) => aplicar({ resultadoFinal: valor })}>
                  <SelectTrigger id="mxb-final" className="h-8 border-border text-xs"><SelectValue placeholder="Resultado final" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DD_MATRIZ_FILTRO_TODOS}><span>Todos</span></SelectItem>
                    <SelectItem value={DD_MATRIZ_FILTRO_SIN_EVALUAR}><span>Sin evaluar</span></SelectItem>
                    {Object.entries(DD_MATRIZ_RESULTADO_FINAL_LABELS).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="mxb-pais">País</label>
                <DdPaisMultiSelect
                  id="mxb-pais"
                  opciones={data?.paises ?? []}
                  value={filtros.paises}
                  onChange={(paises) => aplicar({ paises })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase text-muted-foreground" htmlFor="mxb-fecha">Fecha de ingreso</label>
                <Select
                  value={filtros.fechaPreset}
                  onValueChange={(valor) => aplicar({ fechaPreset: valor as DdMatrizFiltroFecha })}
                >
                  <SelectTrigger id="mxb-fecha" className="h-8 border-border text-xs"><SelectValue placeholder="Fecha" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DD_MATRIZ_FILTRO_FECHA_LABELS).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}><span>{label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filtros.fechaPreset === DD_MATRIZ_FILTRO_FECHA.RANGO ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input
                      type="date"
                      aria-label="Desde"
                      value={filtros.fechaDesde}
                      max={filtros.fechaHasta || undefined}
                      onChange={(evento) => aplicar({ fechaDesde: evento.target.value })}
                      className="h-8 border-border px-2 text-xs"
                    />
                    <Input
                      type="date"
                      aria-label="Hasta"
                      value={filtros.fechaHasta}
                      min={filtros.fechaDesde || undefined}
                      onChange={(evento) => aplicar({ fechaHasta: evento.target.value })}
                      className="h-8 border-border px-2 text-xs"
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground"
                  disabled={filtrosActivos === 0 && !filtros.search}
                  onClick={() => aplicar({ ...FILTROS_INICIALES, perPage: filtrosRef.current.perPage })}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Limpiar filtros</span>
                </Button>
              </div>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {loading ? (
            <TableSkeleton rows={filtros.perPage} columns={11} />
          ) : !data || data.data.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No hay sujetos evaluados con estos filtros.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cuando un cliente envíe su debida diligencia, la empresa y sus personas vinculadas aparecerán aquí.
              </p>
            </div>
          ) : (
            <>
              {formato === "cards" ? (
              <div className="space-y-3">
                {grupos.map((grupo) => (
                  <div key={`mobile-${grupo.expedienteId}`} className="overflow-hidden rounded-lg border border-border">
                    <button
                      type="button"
                      className="flex w-full min-w-0 items-center gap-2 bg-secondary/40 px-3 py-2.5 text-left"
                      onClick={() => alternarGrupo(grupo.expedienteId)}
                      aria-expanded={abiertos.has(grupo.expedienteId)}
                    >
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${abiertos.has(grupo.expedienteId) ? "" : "-rotate-90"}`} />
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary/10 text-primary">
                        <Building2 className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground" title={grupo.empresaRazonSocial}>
                        {grupo.empresaRazonSocial}
                      </span>
                      <Badge className={`pointer-events-none shrink-0 text-[9px] ${BADGE_STYLES.INFO}`}>
                        <span>{grupo.eventoLabel}</span>
                      </Badge>
                      <span className="shrink-0 text-[9px] text-muted-foreground">
                        Enviado {dateUtils.format(grupo.fechaIngreso)}
                      </span>
                      <span className="shrink-0 text-[9px] text-muted-foreground">
                        {etiquetaCantidadVinculos(grupo.filas.length)}
                      </span>
                    </button>
                    <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${abiertos.has(grupo.expedienteId) ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                      <div className={`overflow-hidden ${abiertos.has(grupo.expedienteId) ? "" : "pointer-events-none"}`}>
                      <div className="divide-y divide-border">
                        {grupo.filas.map((fila) => (
                          <div
                            key={`mobile-${fila.id}`}
                            className="cursor-pointer space-y-3 p-3 transition-colors hover:bg-secondary/20"
                            onClick={(event) => alternarFila(event, fila.id)}
                          >
                            <div className="flex items-start gap-2">
                              <Checkbox
                                checked={seleccion.has(fila.id)}
                                aria-label={`Seleccionar ${fila.nombre}`}
                                onCheckedChange={(valor) => alternar(fila.id, valor === true)}
                              />
                              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary/10 text-primary" aria-hidden="true">
                                  {esVinculoEmpresa(fila) ? <Building2 className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <DdPaisBandera pais={fila.pais} />
                                    <Link href={`${DD_RUTAS.MATRIZ}/${fila.id}`} className="truncate text-xs font-bold text-primary hover:underline">
                                      {fila.nombre}
                                    </Link>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    {etiquetaTipoVinculo(fila)}
                                    {fila.cargo ? ` · ${fila.cargo}` : ""}
                                  </p>
                                </div>
                              </div>
                              <Button asChild variant="outline" size="sm" className="h-7 w-7 shrink-0 p-0" title="Abrir detalle">
                                <Link href={`${DD_RUTAS.MATRIZ}/${fila.id}`} aria-label={`Abrir ${fila.nombre}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <p className="font-semibold uppercase tracking-wide text-muted-foreground">Documento</p>
                                <p className="mt-0.5 font-mono text-foreground">{[fila.tipoDocumento, fila.documento].filter(Boolean).join(" ") || "Sin documento"}</p>
                              </div>
                              <div>
                                <p className="font-semibold uppercase tracking-wide text-muted-foreground">% Particip.</p>
                                <p className="mt-0.5 font-mono font-bold text-primary">{porcentajeParticipacion(fila.cargo) ?? "—"}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <div className="rounded-md bg-secondary/30 p-2">
                                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Evaluación SIG</p>
                                <EstadoArea resultado={fila.sigResultado} conclusion={fila.sigConclusion} />
                              </div>
                              <div className="rounded-md bg-secondary/30 p-2">
                                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Comunicaciones</p>
                                <EstadoComunicaciones fila={fila} />
                              </div>
                              <div className="rounded-md bg-secondary/30 p-2">
                                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Legal</p>
                                <EstadoArea resultado={fila.cmpResultado} conclusion={fila.cmpConclusion} compliance variant="dot" />
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                              <span className="text-[10px] text-muted-foreground">Resultado final</span>
                              <ResultadoFinalStitch valor={resultadoFinalEfectivo(fila.resultadoFinal, fila.expedienteEstado)} />
                            </div>
                          </div>
                        ))}
                      </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              ) : null}

              {formato === "tabla" ? (
              <div className="overflow-hidden">
                <Table className="w-full table-fixed [&_th]:overflow-hidden" style={{ tableLayout: "fixed", width: "100%" }}>
                  <colgroup>
                    <col style={{ width: "4%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "6%" }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={estadoCabecera}
                          aria-label="Seleccionar los sujetos de esta página"
                          onCheckedChange={(valor) => alternarPagina(valor === true)}
                        />
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Sujeto evaluado</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Documento</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Cargo / rol</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide">% Particip.</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Ámbito</TableHead>
                      <TableHead className="hidden border-l border-border bg-emerald-50/60 text-[10px] uppercase tracking-wide text-emerald-900 lg:table-cell">
                        <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Evaluación SIG</span>
                      </TableHead>
                      <TableHead className="hidden border-l border-border bg-sky-50/60 text-[10px] uppercase tracking-wide text-sky-900 xl:table-cell">
                        <span className="inline-flex items-center gap-1"><Send className="h-3 w-3" />Comunicaciones</span>
                      </TableHead>
                      <TableHead className="hidden border-l border-border bg-violet-50/60 text-[10px] uppercase tracking-wide text-violet-900 xl:table-cell">
                        <span className="inline-flex items-center gap-1"><Scale className="h-3 w-3" />Legal</span>
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Resultado final</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupos.map((grupo) => (
                      <Fragment key={grupo.expedienteId}>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                          <TableCell colSpan={11} className="overflow-hidden py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden text-left"
                              onClick={() => alternarGrupo(grupo.expedienteId)}
                              aria-expanded={abiertos.has(grupo.expedienteId)}
                            >
                              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${abiertos.has(grupo.expedienteId) ? "" : "-rotate-90"}`} />
                              <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary/10 text-primary">
                                <Building2 className="h-3.5 w-3.5" />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground" title={grupo.empresaRazonSocial}>{grupo.empresaRazonSocial}</span>
                              <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.INFO}`}>
                                <span>{grupo.eventoLabel}</span>
                              </Badge>
                              <span className="font-mono text-[10px] text-muted-foreground">RUC {grupo.empresaRuc}</span>
                              <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.NEUTRAL}`}>
                                <span>{grupo.codigo}</span>
                              </Badge>
                              <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                                Enviado {dateUtils.format(grupo.fechaIngreso)}
                              </span>
                              {grupo.motivo ? (
                                <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.INDIGO}`}>
                                  <span>{grupo.motivo}</span>
                                </Badge>
                              ) : null}
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {etiquetaCantidadVinculos(grupo.filas.length)}
                      </span>
                            </button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                              onClick={() => setRevisionFila({ id: grupo.expedienteId, codigo: grupo.codigo, estado: "en_revision", empresa: { razonSocial: grupo.empresaRazonSocial, ruc: grupo.empresaRuc } })}
                            >
                              <FileText className="h-3 w-3" />
                              <span>Revisar expediente</span>
                            </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {abiertos.has(grupo.expedienteId) ? grupo.filas.map((fila) => (
                          <TableRow
                            key={fila.id}
                            className="animate-dd-row-in cursor-pointer transition-colors hover:bg-secondary/20"
                            data-state={seleccion.has(fila.id) ? "selected" : undefined}
                            onClick={(event) => alternarFila(event, fila.id)}
                          >
                            <TableCell className="w-8 align-top">
                              <Checkbox
                                checked={seleccion.has(fila.id)}
                                aria-label={`Seleccionar ${fila.nombre}`}
                                onCheckedChange={(valor) => alternar(fila.id, valor === true)}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary/10 text-primary" aria-hidden="true">
                                  {esVinculoEmpresa(fila) ? <Building2 className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold text-foreground">{fila.nombre}</p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                    <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.INDIGO}`}>
                                      <span>{etiquetaTipoVinculo(fila)}</span>
                                    </Badge>
                                    {fila.origen === DD_MATRIZ_ORIGENES.MANUAL ? (
                                      <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.NEUTRAL}`}>
                                        <span>Manual</span>
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <p className="font-mono text-[11px] text-foreground">
                                {[fila.tipoDocumento, fila.documento].filter(Boolean).join(" ") || "Sin documento"}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {fila.pais ? nombrePais(fila.pais) : "Sin país"}
                              </p>
                            </TableCell>
                            <TableCell className="hidden align-top lg:table-cell">
                              <p className="max-w-[180px] truncate text-[11px] text-foreground">{fila.cargo || "No aplica"}</p>
                              <p className="text-[10px] text-muted-foreground">{dateUtils.format(fila.fechaIngreso)}</p>
                            </TableCell>
                            <TableCell className="text-right align-top">
                              <span className="font-mono text-[11px] font-bold text-primary">{porcentajeParticipacion(fila.cargo) ?? "—"}</span>
                            </TableCell>
                            <TableCell className="align-top">
                              <span title={fila.pais ? nombrePais(fila.pais) : "Sin país registrado"}>
                                <DdPaisBandera pais={fila.pais} />
                              </span>
                            </TableCell>
                            <TableCell className="hidden border-l border-border bg-emerald-50/20 align-top lg:table-cell">
                              <EstadoArea resultado={fila.sigResultado} conclusion={fila.sigConclusion} />
                            </TableCell>
                            <TableCell className="hidden border-l border-border bg-sky-50/20 align-top xl:table-cell">
                              <EstadoComunicaciones fila={fila} />
                            </TableCell>
                            <TableCell className="hidden border-l border-border bg-violet-50/20 align-top xl:table-cell">
                              <EstadoArea resultado={fila.cmpResultado} conclusion={fila.cmpConclusion} compliance variant="dot" />
                            </TableCell>
                            <TableCell className="align-top"><ResultadoFinalStitch valor={resultadoFinalEfectivo(fila.resultadoFinal, fila.expedienteEstado)} /></TableCell>
                            <TableCell className="text-right align-top">
                              <Button asChild variant="outline" size="sm" className="h-7 w-7 p-0" title="Abrir detalle del sujeto evaluado">
                                <Link href={`${DD_RUTAS.MATRIZ}/${fila.id}`} aria-label={`Abrir ${fila.nombre}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        )) : null}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
              ) : null}

              <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">
                  {data.total} proceso(s) DD · página {data.page} de {data.totalPages || 1} · {filtros.perPage} empresas por página
                </span>
                <Pagination page={data.page} totalPages={data.totalPages} onPageChange={(pagina) => aplicar({ page: pagina })} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {seleccion.size > 0 ? (
        <div className="fixed bottom-5 left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white shadow-2xl">
          <div className="mr-2 min-w-[110px]">
            <p className="text-xs font-semibold">{seleccion.size} registro(s) seleccionado(s)</p>
            <p className="text-[10px] text-slate-300">Acciones de la matriz</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 text-[11px]"
            disabled={procesando !== null}
            onClick={() => { void marcarAceptado(); }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{procesando === "aceptar" ? "Marcando..." : "Marcar APTO"}</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 text-[11px]"
            disabled={procesando !== null}
            onClick={() => { void enviarComunicaciones(); }}
          >
            <Send className="h-3.5 w-3.5" />
            <span>
              {procesando === "comunicaciones"
                ? "Enviando..."
                : `Enviar a Comunicaciones (${expedientesParaComunicaciones.length})`}
            </span>
          </Button>
          {legalYaDerivado ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-violet-400/40 bg-violet-500/10 px-2.5 text-[10px] font-medium text-violet-200">
              <Scale className="h-3.5 w-3.5" />
              <span>Legal: en revisión</span>
            </span>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5 text-[11px]"
              disabled={procesando !== null}
              onClick={abrirLegal}
            >
              <Scale className="h-3.5 w-3.5" />
              <span>Derivar a Legal</span>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-300 hover:bg-white/10 hover:text-white"
            disabled={procesando !== null}
            onClick={() => setSeleccion(new Set())}
            title="Cerrar selección"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <Dialog open={aceptarAbierto} onOpenChange={(abierto) => { if (!abierto && procesando !== "aceptar") setAceptarAbierto(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Marcar APTO</span>
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground">
              Se marcarán {filasSeleccionadas.length} vínculo(s) con resultado final APTO.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mxb-aceptar-comentario">Comentario interno</Label>
              <Textarea
                id="mxb-aceptar-comentario"
                value={aceptarComentario}
                onChange={(evento) => setAceptarComentario(evento.target.value)}
                placeholder="Sustento interno de la aprobación. No se muestra al cliente."
                className="min-h-24 text-sm"
                maxLength={DD_MATRIZ_FINAL_COMENTARIO_MAX}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAceptarAbierto(false)} disabled={procesando === "aceptar"}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={() => { void confirmarAceptar(); }} disabled={procesando === "aceptar" || !aceptarComentario.trim()}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                <span>{procesando === "aceptar" ? "Marcando..." : "Marcar APTO"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={legalAbierto} onOpenChange={(abierto) => { if (!abierto && procesando !== "legal") setLegalAbierto(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-primary" />
              <span>Derivar a Legal</span>
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground">
              Se derivarán {expedientesSeleccionados.length} expediente(s) a Legal.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mxb-legal-motivo">Motivo de la derivación</Label>
              <Textarea
                id="mxb-legal-motivo"
                value={legalMotivo}
                onChange={(evento) => setLegalMotivo(evento.target.value)}
                placeholder="Describe el hallazgo que requiere revisión legal..."
                className="min-h-24 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mxb-legal-informe">Link del informe de Logística (opcional)</Label>
              <Input
                id="mxb-legal-informe"
                type="url"
                value={legalInforme}
                onChange={(evento) => setLegalInforme(evento.target.value)}
                placeholder="https://drive.google.com/..."
                className="h-9 text-sm"
              />
            </div>
            {legalVerificando ? (
              <div className="space-y-2" aria-label="Verificando conclusiones de los vínculos">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : hayPendientesLegal ? (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10" role="alert">
                <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                  <span>
                    {legalNoVerificado
                      ? "No se pudo verificar si todos los vínculos tienen conclusión final."
                      : "Se está derivando a Legal, pero aún no todos los vínculos tienen resultado y conclusión final de SIG y Reputacional."}
                  </span>
                </p>
                {legalPendientes.length > 0 ? (
                  <ul className="max-h-40 space-y-2 overflow-y-auto pr-1 text-[11px]">
                    {legalPendientes.map((grupo) => (
                      <li key={grupo.expedienteId}>
                        <p className="font-semibold text-foreground">
                          {grupo.empresa}
                          {grupo.codigo ? ` · ${grupo.codigo}` : ""}
                        </p>
                        <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
                          {grupo.vinculos.map((vinculo) => (
                            <li key={vinculo.id} className="flex flex-wrap items-center gap-x-1.5">
                              <span className="font-medium text-foreground">{vinculo.nombre}</span>
                              <span>({etiquetaTipoVinculo(vinculo)})</span>
                              <span>· falta {vinculo.faltan.map((area) => DD_MATRIZ_AREA_CONCLUSION_LABELS[area]).join(" y ")}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <label className="flex cursor-pointer items-start gap-2 text-[11px] text-foreground">
                  <Checkbox
                    checked={legalAcepta}
                    onCheckedChange={(valor) => setLegalAcepta(valor === true)}
                    aria-label="Derivar a Legal aunque falten conclusiones finales"
                    className="mt-0.5"
                  />
                  <span>Entiendo que la revisión de estos vínculos no ha culminado y aun así deseo derivar a Legal.</span>
                </label>
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setLegalAbierto(false)} disabled={procesando === "legal"}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={() => { void asignarLegal(); }} disabled={procesando === "legal" || !legalListoParaDerivar}>
                <Scale className="mr-1.5 h-3.5 w-3.5" />
                <span>{procesando === "legal" ? "Derivando..." : "Derivar a Legal"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {revisionFila ? (
        <DdRevisionModal
          fila={revisionFila}
          puedeMatriz
          onClose={() => setRevisionFila(null)}
          onDone={() => { void cargar(undefined, true); }}
          onResultadoFinal={(resultado, comentario, cierre) =>
            ddMatrizEvaluacionService.registrarResultadoFinal(revisionFila.id, resultado, comentario, cierre)
          }
        />
      ) : null}

      {confirmDialog}
    </section>
  );
}










