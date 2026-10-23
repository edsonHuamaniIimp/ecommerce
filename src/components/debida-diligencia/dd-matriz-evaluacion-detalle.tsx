"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from "@nrivera-iimp/ui-kit-iimp";
import { ArrowLeft, FileText, Loader2, Lock, Paperclip, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type {
  DdMatrizAdjuntoDTO,
  DdMatrizBloqueDTO,
  DdMatrizEvaluacionDetalleDTO,
  DdMatrizEvaluacionGuardarRequestDTO,
  DdMatrizListaDTO,
} from "@/types/dto/debida-diligencia";
import {
  DdMatrizAmbitoBadge,
  DdMatrizResultadoFinalBadge,
} from "./dd-matriz-badges";
import { useConfirm } from "@/hooks/use-confirm";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  BADGE_STYLES,
  DD_MATRIZ_ADJUNTO_ACCEPT,
  DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS,
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_AMBITO_LABELS,
  DD_MATRIZ_AREAS,
  DD_MATRIZ_COLOR_LABELS,
  DD_MATRIZ_COLORES,
  DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS,
  DD_MATRIZ_CONCLUSION_LABELS,
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_OBSERVACION_MAX,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADO_LABELS,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_SI_NO_NA_LABELS,
  DD_MATRIZ_SIN_VALOR,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_RUTAS,
  type DdMatrizAdjuntoCategoria,
  type DdMatrizArea,
  type DdMatrizColor,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { evaluarBloqueArea } from "@/lib/shared/utils/dd-matriz-evaluacion";

/** Borde de acento por color de encabezado de la matriz oficial (lila / naranja / celeste). */
const ACENTO_COLOR: Record<DdMatrizColor, string> = {
  [DD_MATRIZ_COLORES.COMUN]: "border-l-violet-400",
  [DD_MATRIZ_COLORES.NACIONAL]: "border-l-orange-400",
  [DD_MATRIZ_COLORES.EXTRANJERO]: "border-l-sky-400",
};

const ESTILO_COLOR: Record<DdMatrizColor, string> = {
  [DD_MATRIZ_COLORES.COMUN]: "bg-violet-100 text-violet-800 border-violet-200",
  [DD_MATRIZ_COLORES.NACIONAL]: "bg-orange-100 text-orange-800 border-orange-200",
  [DD_MATRIZ_COLORES.EXTRANJERO]: "bg-sky-100 text-sky-800 border-sky-200",
};

const aValorSelect = (valor: string | null | undefined): string => valor || DD_MATRIZ_SIN_VALOR;
const deValorSelect = (valor: string): string | null => (valor === DD_MATRIZ_SIN_VALOR ? null : valor);

function formatearTamano(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface OpcionesSelectProps {
  id: string;
  valor: string | null | undefined;
  opciones: Record<string, string>;
  onCambio: (valor: string | null) => void;
  deshabilitado?: boolean;
  placeholder?: string;
}

/** Select de catalogo con opcion "Sin seleccionar" (cumple la regla de span para Radix). */
function SelectCatalogo({ id, valor, opciones, onCambio, deshabilitado, placeholder = "Sin seleccionar" }: OpcionesSelectProps) {
  return (
    <Select value={aValorSelect(valor)} onValueChange={(v) => onCambio(deValorSelect(v))} disabled={deshabilitado}>
      <SelectTrigger id={id} className="h-8 border-border text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={DD_MATRIZ_SIN_VALOR}><span>{placeholder}</span></SelectItem>
        {Object.entries(opciones).map(([codigo, label]) => (
          <SelectItem key={codigo} value={codigo}><span>{label}</span></SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Campo({ etiqueta, id, children }: { etiqueta: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px] font-medium uppercase text-muted-foreground"><span>{etiqueta}</span></Label>
      {children}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium uppercase text-muted-foreground">{etiqueta}</p>
      <p className="text-xs text-foreground">{valor || "—"}</p>
    </div>
  );
}

function Seccion({
  titulo,
  descripcion,
  color,
  acciones,
  children,
}: {
  titulo: string;
  descripcion?: string;
  color: DdMatrizColor;
  acciones?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className={`overflow-hidden border-l-4 ${ACENTO_COLOR[color]}`}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
          {descripcion ? <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`pointer-events-none text-[9px] ${ESTILO_COLOR[color]}`}><span>{DD_MATRIZ_COLOR_LABELS[color]}</span></Badge>
          {acciones}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">{children}</CardContent>
    </Card>
  );
}

interface AdjuntosProps {
  vinculoId: string;
  adjuntos: DdMatrizAdjuntoDTO[];
  categorias: DdMatrizAdjuntoCategoria[];
  puedeEditar: boolean;
  onCambio: () => void;
}

/** Adjuntos (informe y sustento) de un area, con carga y eliminacion. */
function Adjuntos({ vinculoId, adjuntos, categorias, puedeEditar, onCambio }: AdjuntosProps) {
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  const visibles = adjuntos.filter((a) => (categorias as string[]).includes(a.categoria));

  const subir = async (categoria: DdMatrizAdjuntoCategoria, archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(categoria);
    try {
      await ddMatrizEvaluacionService.subirAdjunto(vinculoId, categoria, archivo);
      toast.success("Adjunto cargado");
      onCambio();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el adjunto");
    } finally {
      setSubiendo(null);
    }
  };

  const quitar = async (adjunto: DdMatrizAdjuntoDTO) => {
    if (!(await confirm({ title: "Quitar adjunto", description: `Se quitará "${adjunto.nombre}" del vínculo.`, destructive: true }))) return;
    try {
      await ddMatrizEvaluacionService.eliminarAdjunto({ id: adjunto.id });
      toast.success("Adjunto eliminado");
      onCambio();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el adjunto");
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-secondary/30 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" /><span>Informe y sustento</span>
      </p>
      {visibles.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin adjuntos.</p>
      ) : (
        <ul className="space-y-1">
          {visibles.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5 text-xs">
              <a href={a.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 text-primary hover:underline">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{a.nombre}</span>
              </a>
              <span className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
                <span>{DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS[a.categoria as DdMatrizAdjuntoCategoria] ?? a.categoria} · {formatearTamano(a.tamano)}</span>
                {puedeEditar ? (
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" title="Quitar adjunto" onClick={() => { void quitar(a); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {puedeEditar ? (
        <div className="flex flex-wrap gap-3">
          {categorias.map((categoria) => (
            <div key={categoria} className="space-y-1">
              <Label htmlFor={`adj-${categoria}`} className="flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
                {subiendo === categoria ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                <span>{DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS[categoria]}</span>
              </Label>
              <Input
                id={`adj-${categoria}`}
                type="file"
                accept={DD_MATRIZ_ADJUNTO_ACCEPT}
                disabled={subiendo !== null}
                className="h-8 text-xs"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  e.target.value = "";
                  void subir(categoria, archivo);
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
      {confirmDialog}
    </div>
  );
}

interface BloqueAreaProps {
  area: DdMatrizArea;
  titulo: string;
  descripcion: string;
  bloque: DdMatrizBloqueDTO;
  conclusionLabels: Record<string, string>;
  /** Resultado y observaciones editables. */
  puedeEditar: boolean;
  /** Solo la conclusion editable (SIG sobre el bloque reputacional). */
  soloConclusion?: boolean;
  bloqueado?: { motivo: string } | null;
  guardando: boolean;
  onGuardar: (valor: { resultado: string | null; observaciones: string | null; conclusion: string | null }) => void;
  children?: ReactNode;
}

/** Bloque de conclusiones de un area con las reglas del proceso evaluadas en vivo. */
function BloqueArea({
  area, titulo, descripcion, bloque, conclusionLabels, puedeEditar, soloConclusion = false, bloqueado = null, guardando, onGuardar, children,
}: BloqueAreaProps) {
  const [resultado, setResultado] = useState<string | null>(bloque.resultado);
  const [observaciones, setObservaciones] = useState(bloque.observaciones ?? "");
  const [conclusion, setConclusion] = useState<string | null>(bloque.conclusion);

  const editable = puedeEditar || soloConclusion;
  const evaluacion = useMemo(
    () => evaluarBloqueArea(area, { resultado, observaciones, conclusion }),
    [area, resultado, observaciones, conclusion],
  );
  const esObservado = resultado === DD_MATRIZ_RESULTADOS.OBSERVADO;
  const esCompliance = area === DD_MATRIZ_AREAS.COMPLIANCE;
  const opcionesConclusion = esObservado && !esCompliance
    ? Object.fromEntries(Object.entries(conclusionLabels).filter(([codigo]) => codigo !== DD_MATRIZ_CONCLUSIONES.EN_REVISION))
    : conclusionLabels;
  const cambios =
    (resultado ?? "") !== (bloque.resultado ?? "") ||
    observaciones.trim() !== (bloque.observaciones ?? "") ||
    (conclusion ?? "") !== (bloque.conclusion ?? "");

  const cambiarResultado = (valor: string | null) => {
    setResultado(valor);
    if (valor === DD_MATRIZ_RESULTADOS.ACEPTADO) {
      setConclusion(esCompliance ? Object.keys(conclusionLabels)[0] ?? null : DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES);
    } else if (valor === DD_MATRIZ_RESULTADOS.OBSERVADO && conclusion === DD_MATRIZ_CONCLUSIONES.EN_REVISION) {
      setConclusion(null);
    }
  };

  return (
    <Seccion
      titulo={titulo}
      descripcion={descripcion}
      color={DD_MATRIZ_COLORES.COMUN}
      acciones={
        editable ? (
          <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" disabled={!cambios || evaluacion.errores.length > 0 || guardando} onClick={() => onGuardar({ resultado, observaciones: observaciones.trim() || null, conclusion })}>
            {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>Guardar</span>
          </Button>
        ) : null
      }
    >
      {bloqueado ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{bloqueado.motivo}</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo etiqueta="Resultado de la evaluación" id={`${area}-resultado`}>
          <SelectCatalogo
            id={`${area}-resultado`}
            valor={resultado}
            opciones={Object.fromEntries(Object.entries(DD_MATRIZ_RESULTADO_LABELS).filter(([codigo]) => esCompliance || codigo !== DD_MATRIZ_RESULTADOS.NO_APLICA))}
            deshabilitado={!puedeEditar}
            onCambio={cambiarResultado}
          />
        </Campo>
        <Campo etiqueta="Conclusión" id={`${area}-conclusion`}>
          <SelectCatalogo id={`${area}-conclusion`} valor={conclusion} opciones={opcionesConclusion} deshabilitado={!editable} onCambio={setConclusion} />
        </Campo>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
          <Dato etiqueta="Fecha de evaluación" valor={bloque.fecha ? dateUtils.format(bloque.fecha) : null} />
          <Dato etiqueta="Responsable" valor={bloque.responsable} />
        </div>
      </div>

      <Campo etiqueta={esObservado ? "Observaciones (obligatorio)" : "Observaciones"} id={`${area}-observaciones`}>
        <Textarea
          id={`${area}-observaciones`}
          value={observaciones}
          maxLength={DD_MATRIZ_OBSERVACION_MAX}
          disabled={!puedeEditar}
          rows={3}
          className="text-xs"
          placeholder="Texto libre"
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </Campo>

      {editable && evaluacion.errores.length > 0 && (resultado || conclusion) ? (
        <ul className="space-y-0.5 text-[11px] text-destructive">
          {evaluacion.errores.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      ) : null}

      {children}
    </Seccion>
  );
}

/** Detalle completo de un vinculo de la Matriz de evaluacion DD (vista a pantalla completa). */
export function DdMatrizEvaluacionDetalle({ id }: { id: string }) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [detalle, setDetalle] = useState<DdMatrizEvaluacionDetalleDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [generales, setGenerales] = useState<DdMatrizEvaluacionDetalleDTO["generales"] | null>(null);
  const [listas, setListas] = useState<Record<string, string | null>>({});
  const [final, setFinal] = useState<string | null>(null);
  const idRef = useRef(id);

  const aplicar = useCallback((d: DdMatrizEvaluacionDetalleDTO) => {
    setDetalle(d);
    setGenerales(d.generales);
    setListas(Object.fromEntries(d.listas.map((l) => [l.codigo, l.valor])));
    setFinal(d.resultadoFinal);
  }, []);

  const cargar = useCallback(async () => {
    try {
      aplicar(await ddMatrizEvaluacionService.detalle(idRef.current));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el vínculo");
    } finally {
      setLoading(false);
    }
  }, [aplicar]);

  useEffect(() => { idRef.current = id; void cargar(); }, [id, cargar]);

  /** Envia una seccion y refresca el detalle con la respuesta del servidor. */
  const guardar = async (clave: string, cuerpo: Omit<DdMatrizEvaluacionGuardarRequestDTO, "id">, mensaje: string) => {
    setGuardando(clave);
    try {
      aplicar(await ddMatrizEvaluacionService.guardar({ id, ...cuerpo }));
      toast.success(mensaje);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(null);
    }
  };

  const eliminar = async () => {
    if (!detalle) return;
    if (!(await confirm({ title: "Eliminar vínculo", description: `Se eliminará "${detalle.nombre}" de la matriz.`, destructive: true }))) return;
    try {
      await ddMatrizEvaluacionService.eliminarVinculo(id);
      toast.success("Vínculo eliminado");
      router.push(DD_RUTAS.MATRIZ);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el vínculo");
    }
  };

  if (loading || !detalle || !generales) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-96 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const { permisos } = detalle;
  const esEmpresa = detalle.tipo === DD_MATRIZ_TIPOS_VINCULO.EMPRESA;
  const generalesCambiaron = JSON.stringify(generales) !== JSON.stringify(detalle.generales);
  const listasCambiaron = detalle.listas.some((l) => (listas[l.codigo] ?? null) !== l.valor);
  const gruposListas: DdMatrizListaDTO[][] = [
    detalle.listas.filter((l) => l.color === DD_MATRIZ_COLORES.NACIONAL),
    detalle.listas.filter((l) => l.color === DD_MATRIZ_COLORES.EXTRANJERO),
    detalle.listas.filter((l) => l.color === DD_MATRIZ_COLORES.COMUN),
  ].filter((g) => g.length > 0);

  const guardarBloque = (clave: "sig" | "reputacional" | "compliance") =>
    (valor: { resultado: string | null; observaciones: string | null; conclusion: string | null }) =>
      guardar(clave, { [clave]: valor }, "Evaluación guardada");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 gap-1 text-xs text-muted-foreground">
            <Link href={DD_RUTAS.MATRIZ}><ArrowLeft className="h-3.5 w-3.5" /><span>Matriz de evaluación DD</span></Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{detalle.nombre}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.INDIGO}`}><span>{DD_MATRIZ_TIPO_VINCULO_LABELS[detalle.tipo as DdMatrizTipoVinculo] ?? detalle.tipo}</span></Badge>
            <DdMatrizAmbitoBadge valor={detalle.ambito} />
            {detalle.origen === DD_MATRIZ_ORIGENES.MANUAL ? <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.NEUTRAL}`}><span>Manual</span></Badge> : null}
            <span>{detalle.expediente.empresaRazonSocial} · {detalle.expediente.codigo}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DdMatrizResultadoFinalBadge valor={detalle.resultadoFinal} />
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setLoading(true); void cargar(); }}>
            <RefreshCw className="h-3.5 w-3.5" /><span>Recargar</span>
          </Button>
          {permisos.puedeEliminar ? (
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-destructive" onClick={() => { void eliminar(); }}>
              <Trash2 className="h-3.5 w-3.5" /><span>Eliminar vínculo</span>
            </Button>
          ) : null}
        </div>
      </div>

      <Seccion
        titulo="Datos generales de la empresa"
        descripcion={esEmpresa ? "Se completan una sola vez por empresa." : "Datos de la empresa del expediente (se editan en la fila de la empresa)."}
        color={DD_MATRIZ_COLORES.COMUN}
        acciones={
          permisos.editarGenerales ? (
            <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" disabled={!generalesCambiaron || guardando === "generales"} onClick={() => { void guardar("generales", { generales }, "Datos generales guardados"); }}>
              {guardando === "generales" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Guardar</span>
            </Button>
          ) : null
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Expediente" valor={detalle.expediente.codigo} />
          <Dato etiqueta="Fecha de ingreso de solicitud" valor={dateUtils.format(detalle.expediente.fechaIngreso)} />
          <Dato etiqueta="Fecha de revisión por SIG" valor={detalle.expediente.fechaRevision ? dateUtils.format(detalle.expediente.fechaRevision) : null} />
          <Dato etiqueta="Responsable de revisión" valor={detalle.expediente.revisadoPor} />
          <Dato etiqueta="Razón social" valor={detalle.expediente.empresaRazonSocial} />
          <Dato etiqueta="RUC / ID" valor={detalle.expediente.empresaRuc} />
          <Dato etiqueta="País de constitución" valor={detalle.expediente.paisConstitucion} />
          <Dato etiqueta="Actividad económica" valor={detalle.expediente.actividadEconomica} />
          <Dato etiqueta="Motivo de la evaluación" valor={detalle.expediente.motivo} />
          <Dato etiqueta="Evento o proyecto asociado" valor={detalle.expediente.eventoProyecto} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Fecha de inicio de actividades" id="gen-inicio">
            <Input id="gen-inicio" type="date" className="h-8 text-xs" disabled={!permisos.editarGenerales} value={generales.fechaInicioActividades ?? ""} onChange={(e) => setGenerales({ ...generales, fechaInicioActividades: e.target.value || null })} />
          </Campo>
          <Campo etiqueta="Estado de contribuyente" id="gen-contribuyente">
            <Input id="gen-contribuyente" className="h-8 text-xs" maxLength={80} disabled={!permisos.editarGenerales} placeholder="Ej. ACTIVO - HABIDO" value={generales.estadoContribuyente ?? ""} onChange={(e) => setGenerales({ ...generales, estadoContribuyente: e.target.value || null })} />
          </Campo>
          <Campo etiqueta="Dirección legal" id="gen-direccion">
            <Input id="gen-direccion" className="h-8 text-xs" maxLength={400} disabled={!permisos.editarGenerales} value={generales.direccionLegal ?? ""} onChange={(e) => setGenerales({ ...generales, direccionLegal: e.target.value || null })} />
          </Campo>
          <Campo etiqueta="Historial con IIMP" id="gen-historial">
            <SelectCatalogo id="gen-historial" valor={generales.historialIimp} opciones={DD_MATRIZ_SI_NO_NA_LABELS} deshabilitado={!permisos.editarGenerales} onCambio={(v) => setGenerales({ ...generales, historialIimp: v })} />
          </Campo>
          <Campo etiqueta="Beneficio mutuo" id="gen-beneficio">
            <SelectCatalogo id="gen-beneficio" valor={generales.beneficioMutuo} opciones={DD_MATRIZ_SI_NO_NA_LABELS} deshabilitado={!permisos.editarGenerales} onCambio={(v) => setGenerales({ ...generales, beneficioMutuo: v })} />
          </Campo>
        </div>
      </Seccion>

      {!esEmpresa ? (
        <Seccion titulo="Persona o entidad vinculada" descripcion="Datos del vínculo evaluado (representante, beneficiario u otra persona/empresa)." color={DD_MATRIZ_COLORES.COMUN}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Dato etiqueta="Nombre" valor={detalle.nombre} />
            <Dato etiqueta="Documento de identidad" valor={[detalle.tipoDocumento, detalle.documento].filter(Boolean).join(" - ")} />
            <Dato etiqueta="Nacionalidad" valor={detalle.nacionalidad} />
            <Dato etiqueta="Cargo" valor={detalle.cargo} />
          </div>
        </Seccion>
      ) : null}

      <Seccion
        titulo="Nacional o extranjera"
        descripcion="Define qué listas restrictivas aplican. Se deriva del país o la nacionalidad; SIG puede corregirlo."
        color={DD_MATRIZ_COLORES.COMUN}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Ámbito del vínculo" id="ambito">
            <SelectCatalogo
              id="ambito"
              valor={detalle.ambito}
              opciones={DD_MATRIZ_AMBITO_LABELS}
              deshabilitado={!permisos.editarIdentidad || guardando === "ambito"}
              onCambio={(v) => { if (v && v !== detalle.ambito) void guardar("ambito", { identidad: { ambito: v } }, "Ámbito actualizado"); }}
            />
          </Campo>
          <Dato etiqueta="Origen del dato" valor={detalle.ambitoEditado ? "Corregido manualmente" : "Derivado automáticamente"} />
        </div>
      </Seccion>

      <div className="space-y-3">
        {gruposListas.map((grupo, indice) => {
          const color = (grupo[0]?.color ?? DD_MATRIZ_COLORES.COMUN) as DdMatrizColor;
          return (
            <Seccion
              key={color}
              titulo={indice === 0 ? "Listas restrictivas" : "Listas restrictivas (continuación)"}
              descripcion="Responde SI / NO / N.A. según la revisión de cada lista."
              color={color}
              acciones={
                indice === 0 && permisos.editarListas ? (
                  <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" disabled={!listasCambiaron || guardando === "listas"} onClick={() => { void guardar("listas", { listas }, "Listas guardadas"); }}>
                    {guardando === "listas" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    <span>Guardar listas</span>
                  </Button>
                ) : null
              }
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.map((lista) => (
                  <Campo key={lista.codigo} etiqueta={lista.label} id={`lista-${lista.codigo}`}>
                    <SelectCatalogo id={`lista-${lista.codigo}`} valor={listas[lista.codigo]} opciones={DD_MATRIZ_SI_NO_NA_LABELS} deshabilitado={!permisos.editarListas} onCambio={(v) => setListas({ ...listas, [lista.codigo]: v })} />
                  </Campo>
                ))}
              </div>
            </Seccion>
          );
        })}
      </div>

      <BloqueArea
        key={`sig|${detalle.sig.resultado}|${detalle.sig.observaciones}|${detalle.sig.conclusion}`}
        area={DD_MATRIZ_AREAS.SIG}
        titulo="Conclusiones SIG (Logística)"
        descripcion="Resultado de la evaluación por SIG. Si queda OBSERVADO, indica la observación y si requiere debida diligencia reforzada."
        bloque={detalle.sig}
        conclusionLabels={DD_MATRIZ_CONCLUSION_LABELS}
        puedeEditar={permisos.editarSig}
        guardando={guardando === "sig"}
        onGuardar={guardarBloque("sig")}
      >
        <Adjuntos
          vinculoId={detalle.id}
          adjuntos={detalle.adjuntos}
          categorias={[DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_INFORME, DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_SUSTENTO]}
          puedeEditar={permisos.editarSig}
          onCambio={() => { void cargar(); }}
        />
      </BloqueArea>

      <BloqueArea
        key={`reputacional|${detalle.reputacional.resultado}|${detalle.reputacional.observaciones}|${detalle.reputacional.conclusion}`}
        area={DD_MATRIZ_AREAS.REPUTACIONAL}
        titulo="Conclusiones reputacional (Comunicaciones)"
        descripcion="Resultado de la evaluación reputacional. SIG puede actualizar la conclusión según las evidencias de sustento."
        bloque={detalle.reputacional}
        conclusionLabels={DD_MATRIZ_CONCLUSION_LABELS}
        puedeEditar={permisos.editarReputacional}
        soloConclusion={permisos.editarConclusionReputacional}
        guardando={guardando === "reputacional"}
        onGuardar={guardarBloque("reputacional")}
      >
        <Adjuntos
          vinculoId={detalle.id}
          adjuntos={detalle.adjuntos}
          categorias={[DD_MATRIZ_ADJUNTO_CATEGORIAS.REPUTACIONAL_SUSTENTO]}
          puedeEditar={permisos.editarReputacional || permisos.editarConclusionReputacional}
          onCambio={() => { void cargar(); }}
        />
      </BloqueArea>

      <BloqueArea
        key={`compliance|${detalle.compliance.resultado}|${detalle.compliance.observaciones}|${detalle.compliance.conclusion}`}
        area={DD_MATRIZ_AREAS.COMPLIANCE}
        titulo="Conclusiones Compliance (Legal)"
        descripcion="Evaluación reforzada, solo para vínculos que SIG marcó como REQUIERE DEBIDA DILIGENCIA REFORZADA."
        bloque={detalle.compliance}
        conclusionLabels={DD_MATRIZ_CONCLUSION_COMPLIANCE_LABELS}
        puedeEditar={permisos.editarCompliance}
        bloqueado={permisos.complianceDesbloqueado ? null : { motivo: "Se habilita cuando SIG concluye REQUIERE DEBIDA DILIGENCIA REFORZADA y adjunta el informe y su sustento." }}
        guardando={guardando === "compliance"}
        onGuardar={guardarBloque("compliance")}
      >
        <Adjuntos
          vinculoId={detalle.id}
          adjuntos={detalle.adjuntos}
          categorias={[DD_MATRIZ_ADJUNTO_CATEGORIAS.COMPLIANCE_SUSTENTO]}
          puedeEditar={permisos.editarCompliance}
          onCambio={() => { void cargar(); }}
        />
      </BloqueArea>

      <Seccion
        titulo="Conclusión final"
        descripcion="El resultado final lo registra SIG o Compliance. Es solo un registro: no modifica el estado del expediente."
        color={DD_MATRIZ_COLORES.EXTRANJERO}
        acciones={
          permisos.editarFinal ? (
            <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" disabled={(final ?? "") === (detalle.resultadoFinal ?? "") || guardando === "final"} onClick={() => { void guardar("final", { resultadoFinal: final ?? "" }, "Resultado final guardado"); }}>
              {guardando === "final" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Guardar</span>
            </Button>
          ) : null
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Resultado final" id="resultado-final">
            <SelectCatalogo id="resultado-final" valor={final} opciones={DD_MATRIZ_RESULTADO_FINAL_LABELS} deshabilitado={!permisos.editarFinal} onCambio={setFinal} />
          </Campo>
          <Dato etiqueta="Registrado por" valor={detalle.finalPor} />
          <Dato etiqueta="Fecha" valor={detalle.finalFecha ? dateUtils.format(detalle.finalFecha) : null} />
        </div>
      </Seccion>

      {confirmDialog}
    </div>
  );
}
