"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Skeleton,
  Textarea,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import type { DdMatrizEvaluacionDetalleDTO } from "@/types/dto/debida-diligencia";
import { DdEvidenciaPreviewButton } from "./dd-evidencia-preview-button";
import { DdPaisBandera } from "./dd-pais-bandera";
import { DdRevisionModal } from "./dd-revision-modal";
import { useConfirm } from "@/hooks/use-confirm";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import { fuenteAutomatizable, urlFuenteLista } from "@/lib/shared/utils/dd-matriz-evaluacion";
import {
  DD_MATRIZ_ADJUNTO_ACCEPT,
  DD_MATRIZ_AMBITO_LABELS,
  DD_MATRIZ_CONCLUSION_LABELS,
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_LISTA_DESCRIPCIONES,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADO_LABELS,
  DD_MATRIZ_SI_NO_NA_LABELS,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_REPUTACION_RESULTADO_LABELS,
  DD_RUTAS,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";

type DecisionCriterio = "si" | "no" | "na";
type ResultadoSig = "aceptado" | "observado";

interface Props {
  id: string;
  onVolverRevision?: () => void;
}

const OPCIONES: { valor: DecisionCriterio; label: string; clase: string }[] = [
  { valor: "si", label: DD_MATRIZ_SI_NO_NA_LABELS.si, clase: "border-red-200 bg-red-50 text-red-800" },
  { valor: "no", label: DD_MATRIZ_SI_NO_NA_LABELS.no, clase: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { valor: "na", label: DD_MATRIZ_SI_NO_NA_LABELS.na, clase: "border-slate-200 bg-slate-50 text-slate-600" },
];

const RESULTADOS_SIG: {
  valor: ResultadoSig;
  titulo: string;
  detalle: string;
  icono: React.ReactNode;
  clase: string;
}[] = [
  {
    valor: "aceptado",
    titulo: "ACEPTADO",
    detalle: "El vínculo no presenta observaciones para SIG.",
    icono: <CheckCircle2 className="h-4 w-4" />,
    clase: "border-emerald-200 bg-emerald-50",
  },
  {
    valor: "observado",
    titulo: "OBSERVADO",
    detalle: "El vínculo requiere observación y conclusión.",
    icono: <AlertTriangle className="h-4 w-4" />,
    clase: "border-amber-200 bg-amber-50",
  },
];

const AMBITO_LABELS: Record<string, string> = DD_MATRIZ_AMBITO_LABELS;

function decisionInicial(valor: string | null): DecisionCriterio | null {
  if (valor === "si" || valor === "no" || valor === "na") return valor;
  return null;
}

function valorMatriz(decision: DecisionCriterio | null): string | null {
  return decision;
}

/** Edición de decisiones del vínculo: criterios, resultado y conclusión SIG. */
export function DdMatrizDecisionVinculo({ id, onVolverRevision }: Props) {
  const [detalle, setDetalle] = useState<DdMatrizEvaluacionDetalleDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [decisiones, setDecisiones] = useState<Record<string, DecisionCriterio | null>>({});
  const [resultadoSig, setResultadoSig] = useState<ResultadoSig | null>(null);
  const [conclusionSig, setConclusionSig] = useState<string | null>(null);
  const [conclusionReputacional, setConclusionReputacional] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [subiendoCriterio, setSubiendoCriterio] = useState<string | null>(null);
  const [automatizandoCriterio, setAutomatizandoCriterio] = useState<string | null>(null);
  const [revisionAbierta, setRevisionAbierta] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const aplicar = useCallback((data: DdMatrizEvaluacionDetalleDTO) => {
    setDetalle(data);
    setDecisiones(Object.fromEntries(data.listas.map((lista) => [lista.codigo, decisionInicial(lista.valor)])));
    setObservaciones(data.sig.observaciones ?? "");
    const resultadoReputacional = ddUtils.normalizarResultadoReputacion(
      data.reputacional.resultado,
    );
    setConclusionReputacional(
      data.reputacional.conclusion ??
        (resultadoReputacional === DD_MATRIZ_RESULTADOS.ACEPTADO
          ? DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES
          : null),
    );
    const resultadoInicial: ResultadoSig | null =
      data.sig.resultado === DD_MATRIZ_RESULTADOS.OBSERVADO
        ? "observado"
        : data.sig.resultado === DD_MATRIZ_RESULTADOS.ACEPTADO
          ? "aceptado"
          : null;
    setResultadoSig(resultadoInicial);
    setConclusionSig(
      resultadoInicial === "aceptado"
        ? DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES
        : data.sig.conclusion ?? null,
    );
  }, []);

  const cargar = useCallback(async () => {
    try {
      aplicar(await ddMatrizEvaluacionService.detalle(id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el vínculo");
    } finally {
      setLoading(false);
    }
  }, [aplicar, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  const subirEvidencia = async (codigo: string, archivo: File | undefined) => {
    if (!archivo || !detalle) return;
    setSubiendoCriterio(codigo);
    try {
      const adjunto = await ddMatrizEvaluacionService.subirAdjunto(
        detalle.id,
        `${DD_MATRIZ_CRITERIO_PREFIJO}${codigo}`,
        archivo,
      );
      setDetalle((previo) => previo ? { ...previo, adjuntos: [...previo.adjuntos, adjunto] } : previo);
      toast.success("Evidencia cargada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la evidencia");
    } finally {
      setSubiendoCriterio(null);
    }
  };

  const automatizarEvidencia = async (codigo: string) => {
    if (!detalle || automatizandoCriterio) return;
    setAutomatizandoCriterio(codigo);
    try {
      const adjunto = await ddMatrizEvaluacionService.automatizarEvidencia(detalle.id, codigo);
      setDetalle((previo) => previo ? { ...previo, adjuntos: [...previo.adjuntos, adjunto] } : previo);
      toast.success("Evidencia automática adjuntada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo automatizar la evidencia");
    } finally {
      setAutomatizandoCriterio(null);
    }
  };
  const cambiarResultadoSig = async (nuevo: ResultadoSig) => {
    if (!detalle || nuevo === resultadoSig) return;
    if (resultadoSig) {
      const ok = await confirm({
        title: "Cambiar resultado SIG",
        description:
          "El resultado actual se reemplazará. Después deberás confirmar la conclusión SIG.",
        confirmLabel: "Cambiar resultado",
        cancelLabel: "Cancelar",
      });
      if (!ok) return;
    }
    setResultadoSig(nuevo);
    setConclusionSig(
      nuevo === "aceptado" ? DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES : null,
    );
  };
  const guardarDecision = async () => {
    if (!detalle) return;
    if (!resultadoSig) {
      toast.error("Selecciona el resultado SIG del vínculo antes de guardar.");
      return;
    }
    if (!conclusionSig) {
      toast.error("Selecciona la conclusión SIG del vínculo antes de guardar.");
      return;
    }
    const conclusionesValidas =
      resultadoSig === "observado"
        ? [DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES, DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA]
        : [DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES];
    if (!conclusionesValidas.includes(conclusionSig as (typeof conclusionesValidas)[number])) {
      toast.error("La conclusión SIG no corresponde al resultado seleccionado.");
      return;
    }
    if (resultadoSig === "observado" && !observaciones.trim()) {
      toast.error("Registra la observación del vínculo antes de guardar.");
      return;
    }

    const ok = await confirm({
      title: "Guardar evaluación del vínculo",
      description: "Se guardarán los criterios, la observación, el resultado y la conclusión SIG del vínculo.",
      confirmLabel: "Guardar evaluación",
    });
    if (!ok) return;
    setGuardando(true);
    try {
      const listas = Object.fromEntries(
        Object.entries(decisiones).map(([codigo, decision]) => [codigo, valorMatriz(decision)]),
      );
      const actualizado = await ddMatrizEvaluacionService.guardar({
        id,
        listas,
        sig: {
          resultado: resultadoSig === "aceptado" ? DD_MATRIZ_RESULTADOS.ACEPTADO : DD_MATRIZ_RESULTADOS.OBSERVADO,
          observaciones: observaciones.trim() || null,
          conclusion: conclusionSig,
        },
        ...(detalle.reputacional.resultado && conclusionReputacional
          ? {
              reputacional: {
                resultado: detalle.reputacional.resultado,
                conclusion: conclusionReputacional,
              },
            }
          : {}),
      });
      aplicar(actualizado);
      toast.success("Evaluación del vínculo guardada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la evaluación");
    } finally {
      setGuardando(false);
    }
  };
  const enviarComunicaciones = async () => {
    if (!detalle) return;
    setGuardando(true);
    try {
      const respuesta = await debidaDiligenciaService.derivarComunicaciones(
        detalle.expediente.expedienteId,
        [detalle.id],
      );
      if (respuesta.derivados === 0) {
        if (respuesta.existentes > 0) {
          await confirm({
            title: "Vínculo ya derivado",
            description: `El vínculo "${detalle.nombre}" ya tiene un caso enviado a Comunicaciones. No se creó un duplicado.`,
            confirmLabel: "Entendido",
            cancelLabel: "Cerrar",
          });
        } else {
          toast.info("No se pudo crear un caso nuevo para este vínculo");
        }
        return;
      }
      toast.success("Vínculo derivado a Comunicaciones");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo derivar a Comunicaciones");
    } finally {
      setGuardando(false);
    }
  };

  if (loading || !detalle) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const tipo = DD_MATRIZ_TIPO_VINCULO_LABELS[detalle.tipo as DdMatrizTipoVinculo] ?? detalle.tipo;
  const hayObservados = Object.values(decisiones).some((decision) => decision === "si");
  const puedeEditar = detalle.permisos.editarSig || detalle.permisos.editarListas || detalle.permisos.editarFinal;
  const resultadoComunicaciones = ddUtils.normalizarResultadoReputacion(
    detalle.reputacional.resultado,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Link href={DD_RUTAS.MATRIZ} className="hover:text-primary">Matriz de evaluación DD</Link>
        <span>/</span>
        <span>Evaluación de vínculo</span>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <DdPaisBandera pais={detalle.pais} />
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{detalle.nombre}</h1>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge className="pointer-events-none border-primary/20 bg-primary/10 text-[9px] text-primary"><span>{tipo}</span></Badge>
              <Badge className="pointer-events-none text-[9px]"><span>{AMBITO_LABELS[detalle.ambito] ?? detalle.ambito}</span></Badge>
              <Badge className="pointer-events-none text-[9px]"><span>{detalle.origen === DD_MATRIZ_ORIGENES.MANUAL ? "Manual" : "Automático"}</span></Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {detalle.expediente.empresaRazonSocial} · {detalle.expediente.codigo}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setRevisionAbierta(true)}>
              <FileText className="h-3.5 w-3.5" /><span>Revisar expediente</span>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Link href={DD_RUTAS.MATRIZ}><ArrowLeft className="h-3.5 w-3.5" /><span>Volver a Matriz</span></Link>
            </Button>
            {onVolverRevision ? (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onVolverRevision}>
                <FileText className="h-3.5 w-3.5" /><span>Volver a revisión</span>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Criterios de evaluación
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Registra el resultado de cada criterio y adjunta la evidencia correspondiente.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-secondary/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Criterio / Lista restrictiva</th>
                    <th className="w-48 px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Selección</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Evidencia / observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detalle.listas.map((lista, indice) => {
                    const decision = decisiones[lista.codigo] ?? null;
                    const evidencias = detalle.adjuntos.filter((adjunto) => adjunto.categoria === `${DD_MATRIZ_CRITERIO_PREFIJO}${lista.codigo}`);
                    const fuenteUrl = urlFuenteLista(lista.codigo, detalle.nombre, detalle.documento);
                    return (
                      <tr key={lista.codigo} className="align-top hover:bg-secondary/20">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">{indice + 1}</span>
                            <span className="min-w-0">
                              <span className="block text-[11px] font-medium text-foreground">{lista.label}</span>
                              {DD_MATRIZ_LISTA_DESCRIPCIONES[lista.codigo] ? (
                                <span className="mt-0.5 block text-[10px] font-normal leading-snug text-muted-foreground">
                                  {DD_MATRIZ_LISTA_DESCRIPCIONES[lista.codigo]}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {OPCIONES.map((opcion) => (
                              <button
                                key={opcion.valor}
                                type="button"
                                disabled={!puedeEditar}
                                onClick={() => setDecisiones((previas) => ({ ...previas, [lista.codigo]: opcion.valor }))}
                                className={`min-w-12 rounded-md border px-2 py-1.5 text-[10px] font-bold transition ${decision === opcion.valor ? opcion.clase : "border-border bg-card text-muted-foreground hover:bg-secondary/50"}`}
                              >
                                {opcion.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {evidencias.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground">Sin evidencia cargada.</p>
                            ) : (
                              evidencias.map((evidencia) => (
                                <div key={evidencia.id} className="flex items-center gap-1.5">
                                  <a href={evidencia.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1 text-[10px] text-primary hover:underline">
                                    <FileText className="h-3 w-3 shrink-0" />
                                    <span className="max-w-[220px] truncate">{evidencia.nombre}</span>
                                  </a>
                                  <DdEvidenciaPreviewButton
                                    url={evidencia.url}
                                    nombre={evidencia.nombre}
                                    mimeType={evidencia.mimeType}
                                  />
                                </div>
                              ))
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              {puedeEditar ? (
                                <label className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-medium text-primary hover:underline">
                                  {subiendoCriterio === lista.codigo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                  <span>{subiendoCriterio === lista.codigo ? "Subiendo..." : "Subir evidencia"}</span>
                                  <input
                                    type="file"
                                    accept={DD_MATRIZ_ADJUNTO_ACCEPT}
                                    className="sr-only"
                                    disabled={subiendoCriterio !== null}
                                    onChange={(evento) => {
                                      const archivo = evento.target.files?.[0];
                                      evento.target.value = "";
                                      void subirEvidencia(lista.codigo, archivo);
                                    }}
                                  />
                                </label>
                              ) : null}
                              {fuenteUrl ? (
                                <a
                                  href={fuenteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span>Consultar fuente</span>
                                </a>
                              ) : null}
                              {fuenteUrl && fuenteAutomatizable(lista.codigo) ? (
                                <button
                                  type="button"
                                  disabled={automatizandoCriterio !== null}
                                  onClick={() => { void automatizarEvidencia(lista.codigo); }}
                                  title="Buscar en el portal y adjuntar un PDF del resultado"
                                  className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {automatizandoCriterio === lista.codigo ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                  <span>{automatizandoCriterio === lista.codigo ? "Automatizando..." : "Automatizar"}</span>
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <UserRound className="h-4 w-4 text-primary" />
                Observación del vínculo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <Label htmlFor="decision-observacion" className="text-[10px] font-semibold uppercase text-muted-foreground">
                Sustento y observaciones
              </Label>
              <Textarea
                id="decision-observacion"
                value={observaciones}
                onChange={(evento) => setObservaciones(evento.target.value)}
                placeholder="Registra el hallazgo o la justificación de la decisión..."
                className="min-h-32 text-xs"
                disabled={!puedeEditar}
              />
              {hayObservados && !observaciones.trim() ? (
                <p className="text-[11px] font-medium text-amber-700">
                  Hay criterios observados: registra el sustento antes de guardar.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={guardando} onClick={() => { void enviarComunicaciones(); }}>
                  <Send className="h-3.5 w-3.5" />
                  <span>Enviar vínculo a Comunicaciones</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-bold">Evaluación reputacional (SIG)</CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Comunicaciones registra observaciones y fuentes. SIG define el resultado y la
                conclusión reputacional del vínculo.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Observaciones de Comunicaciones
                </p>
                <p className="mt-1 text-[11px] text-foreground">
                  {detalle.reputacional.observaciones?.trim() || "Sin observaciones registradas."}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-card p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Resultado de Comunicaciones
                </p>
                <p className="text-[11px] font-semibold text-foreground">
                  {resultadoComunicaciones
                    ? DD_REPUTACION_RESULTADO_LABELS[resultadoComunicaciones] ??
                      DD_MATRIZ_RESULTADO_LABELS[
                        resultadoComunicaciones as keyof typeof DD_MATRIZ_RESULTADO_LABELS
                      ] ??
                      resultadoComunicaciones
                    : "Pendiente"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Conclusión reputacional (SIG)
                </p>
                {!resultadoComunicaciones ? (
                  <p className="rounded-lg border border-dashed border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">
                    Comunicaciones aún no registró el resultado de este vínculo.
                  </p>
                ) : (
                  <div className="grid gap-1.5">
                    {(resultadoComunicaciones === DD_MATRIZ_RESULTADOS.OBSERVADO
                      ? [DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES, DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA]
                      : [DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES]
                    ).map((opcion) => (
                      <button
                        key={opcion}
                        type="button"
                        disabled={!detalle.permisos.editarReputacional}
                        onClick={() => setConclusionReputacional(opcion)}
                        className={`rounded-lg border px-2.5 py-2 text-left text-[10px] font-semibold transition ${
                          conclusionReputacional === opcion
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:bg-secondary/40"
                        }`}
                      >
                        <span>{DD_MATRIZ_CONCLUSION_LABELS[opcion] ?? opcion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-bold">Evaluación SIG del vínculo</CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Primero define el resultado. La conclusión SIG se habilita después.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  1. Resultado SIG
                </p>
                {RESULTADOS_SIG.map((opcion) => (
                  <button
                    key={opcion.valor}
                    type="button"
                    disabled={!puedeEditar}
                    onClick={() => { void cambiarResultadoSig(opcion.valor); }}
                    className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left transition ${resultadoSig === opcion.valor ? opcion.clase : "border-border bg-card hover:bg-secondary/40"}`}
                  >
                    <span className="mt-0.5 shrink-0">{opcion.icono}</span>
                    <span>
                      <span className="block text-xs font-bold text-foreground">{opcion.titulo}</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{opcion.detalle}</span>
                    </span>
                  </button>
                ))}
                <p className="text-[10px] text-muted-foreground">
                  Seleccionar no guarda el cambio; se confirma con Guardar evaluación.
                </p>
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  2. Conclusión SIG
                </p>
                {!resultadoSig ? (
                  <p className="rounded-lg border border-dashed border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">
                    Selecciona un resultado para habilitar la conclusión.
                  </p>
                ) : (
                  <div className="grid gap-1.5">
                    {(resultadoSig === "observado"
                      ? [DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES, DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA]
                      : [DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES]
                    ).map((opcion) => (
                      <button
                        key={opcion}
                        type="button"
                        disabled={!puedeEditar}
                        onClick={() => setConclusionSig(opcion)}
                        className={`rounded-lg border px-3 py-2 text-left text-[11px] font-semibold transition ${
                          conclusionSig === opcion
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:bg-secondary/40"
                        }`}
                      >
                        <span>{DD_MATRIZ_CONCLUSION_LABELS[opcion] ?? opcion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <p className="max-w-[220px] text-[10px] text-muted-foreground">
                  La conclusión final del expediente se registra en Revisar expediente.
                </p>
                <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" disabled={!puedeEditar || guardando || !resultadoSig || !conclusionSig} onClick={() => { void guardarDecision(); }}>
                  {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>Guardar evaluación</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {revisionAbierta ? (
        <DdRevisionModal
          fila={{
            id: detalle.expediente.expedienteId,
            codigo: detalle.expediente.codigo,
            estado: detalle.expediente.estado,
            empresa: {
              razonSocial: detalle.expediente.empresaRazonSocial,
              ruc: detalle.expediente.empresaRuc,
            },
          }}
          puedeMatriz
          onClose={() => setRevisionAbierta(false)}
          onDone={() => { void cargar(); }}
        />
      ) : null}

      {confirmDialog}
    </div>
  );
}










