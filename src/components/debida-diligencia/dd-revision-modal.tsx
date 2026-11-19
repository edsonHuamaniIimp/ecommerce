"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@nrivera-iimp/ui-kit-iimp";
import { AlertCircle, CheckCircle2, Eye, FileText, History, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { DdEstadoBadge, DdDocumentoBadge } from "./dd-estado-badge";
import { DdDocumentoPreviewDialog } from "./dd-documento-preview-dialog";
import { DdHistorialDialog } from "./dd-historial-dialog";
import { DdPaisBandera } from "./dd-pais-bandera";
import { DdRadioIndicator } from "./dd-radio-indicator";
import { DdRevisionMatrizTab } from "./dd-revision-matriz-tab";
import { useConfirm } from "@/hooks/use-confirm";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  BADGE_STYLES,
  DD_ACCIONES_LEGAL,
  DD_ACCIONES_REVISION,
  DD_ALCANCES_REVISION,
  DD_DOCUMENTO_ADICIONAL,
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTO_VIGENCIA,
  DD_DOCUMENTOS,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_ESTADOS,
  DD_OBSERVACION_AREA_LABELS,
  DD_ORIGEN_LABELS,
  DD_ORIGENES,
  DD_MATRIZ_FINAL_COMENTARIO_MAX,
  DD_MATRIZ_RESULTADO_FINAL_LABELS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_OBSERVACION_ESTADOS,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_ESTADO_LABELS,
  DD_REPUTACION_RESULTADOS,
  DD_REPUTACION_TIPO_LABELS,
  DD_REPUTACION_TIPOS,
  DD_REPUTACION_RESULTADO_LABELS,
  DD_VIGENCIA_MESES,
  type DdAccionRevision,
  type DdDocumentoTipo,
  type DdMatrizResultadoFinal,
} from "@/lib/shared/constants";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";
import { dateUtils } from "@/lib/shared/utils/date";
import {
  resultadoFinalEditable,
  resultadoFinalEfectivo,
} from "@/lib/shared/utils/dd-matriz-evaluacion";
import { paisDeTexto } from "@/lib/shared/utils/pais";
import type {
  DdBandejaRowDTO,
  DdExpedienteDTO,
  DdMatrizEvaluacionDetalleDTO,
  DdMatrizEvaluacionFilaDTO,
} from "@/types/dto/debida-diligencia";

function DatoResumen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-xs font-medium text-foreground">{children}</div>
    </div>
  );
}

type FilaRevision = Pick<DdBandejaRowDTO, "id" | "codigo" | "estado"> & {
  empresa: Pick<DdBandejaRowDTO["empresa"], "razonSocial" | "ruc">;
};

interface Props {
  fila: FilaRevision;
  puedeMatriz: boolean;
  onClose: () => void;
  onDone: () => void;
  onResultadoFinal?: (
    resultado: DdMatrizResultadoFinal,
    comentario?: string,
    cierre?: {
      clienteComentario?: string | null;
      documentosObservados?: DdDocumentoTipo[];
    },
  ) => Promise<void> | void;
}

const ACCIONES = [
  { value: DD_ACCIONES_REVISION.APROBAR, label: "APTO", detalle: `La empresa quedará APTO por ${DD_VIGENCIA_MESES} meses.` },
  { value: DD_ACCIONES_REVISION.OBSERVAR, label: "DOCUMENTACIÓN OBSERVADA", detalle: "El cliente podrá corregir y solicitar una nueva evaluación." },
  { value: DD_ACCIONES_REVISION.RECHAZAR, label: "DERIVAR A LEGAL", detalle: "Legal revisará la solicitud y emitirá un informe antes de notificar al cliente." },
] as const;

const FINALES = [
  { value: DD_MATRIZ_RESULTADOS_FINALES.APTO, detalle: "Cierra la evaluación como apta." },
  { value: DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES, detalle: "Aprobación con observaciones o seguimiento." },
  { value: DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA, detalle: "El cliente debe subsanar documentación." },
  { value: DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION, detalle: "Normalmente automático mientras hay pendientes." },
  { value: DD_MATRIZ_RESULTADOS_FINALES.NO_APTO, detalle: "Rechazo definitivo; debe quedar sustentado." },
  { value: DD_MATRIZ_RESULTADOS_FINALES.SIN_RESPUESTA, detalle: "Cierre por vencimiento del plazo de respuesta." },
] as const;

const REVALIDACION_ESTADO_LABELS: Record<string, string> = {
  [DD_DOCUMENTO_ESTADOS.CARGADO]: "Pendiente de validación",
  [DD_DOCUMENTO_ESTADOS.OBSERVADO]: "Observada",
};

/** Revision de Logistica: resumen, documentos y decision en un modal con tabs. */
export function DdRevisionModal({ fila, puedeMatriz, onClose, onDone, onResultadoFinal }: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const [detalle, setDetalle] = useState<DdExpedienteDTO | null>(null);
  const [matriz, setMatriz] = useState<DdMatrizEvaluacionDetalleDTO | null>(null);
  const [matrizVinculos, setMatrizVinculos] = useState<DdMatrizEvaluacionFilaDTO[]>([]);
  const [matrizId, setMatrizId] = useState<string | null>(null);
  const [matrizLoading, setMatrizLoading] = useState(true);
  const [matrizError, setMatrizError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accion, setAccion] = useState<DdAccionRevision>(DD_ACCIONES_REVISION.APROBAR);
  const [documentosObservados, setDocumentosObservados] = useState<DdDocumentoTipo[]>([]);
  const [texto, setTexto] = useState("");
  const [informeLogisticaUrl, setInformeLogisticaUrl] = useState("");
  const [derivando, setDerivando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardandoFinal, setGuardandoFinal] = useState<DdMatrizResultadoFinal | null>(null);
  const [resultadoFinalSeleccionado, setResultadoFinalSeleccionado] =
    useState<DdMatrizResultadoFinal | null>(null);
  const [finalLegacy, setFinalLegacy] = useState(false);
  const [finalBloqueado, setFinalBloqueado] = useState(false);
  const [comentarioFinal, setComentarioFinal] = useState("");
  const [comentarioClienteFinal, setComentarioClienteFinal] = useState("");
  const [revalidacionGuardando, setRevalidacionGuardando] = useState(false);
  const [textoRevalidacion, setTextoRevalidacion] = useState("");
  const [revalidacionError, setRevalidacionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vinculosCompletos, setVinculosCompletos] = useState(false);
  const [guardandoDeclaracion, setGuardandoDeclaracion] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [previewDocumento, setPreviewDocumento] = useState<{ url: string; nombre: string } | null>(null);

  useEffect(() => {
    let activo = true;
    debidaDiligenciaService
      .detalle(fila.id)
      .then((r) => {
        if (!activo) return;
        setDetalle(r);
        setVinculosCompletos(Boolean(r.vinculosCompletos));
        const derivable =
          r.estado === DD_ESTADOS.APROBADA ||
          (r.estado === DD_ESTADOS.RECHAZADA && !r.decisionLegal);
        if (derivable) {
          setAccion(DD_ACCIONES_REVISION.RECHAZAR);
        }
        if (
          r.estado !== DD_ESTADOS.APROBADA &&
          r.reputacion.some(
            (caso) =>
              caso.estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS ||
              caso.estado === DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION ||
              caso.resultado === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS ||
              caso.resultado === DD_REPUTACION_RESULTADOS.OBSERVADO ||
              caso.resultado === DD_REPUTACION_RESULTADOS.REQUIERE_DEBIDA_DILIGENCIA,
          )
        ) {
          setAccion(DD_ACCIONES_REVISION.OBSERVAR);
        }
        if (r.estado === DD_ESTADOS.RECHAZADA) setTexto(r.motivoRechazo ?? "");
        setInformeLogisticaUrl(r.informeLogisticaUrl ?? "");
      })
      .catch((e) => { if (activo) setError(e instanceof Error ? e.message : "No se pudo cargar el expediente"); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [fila.id]);

  useEffect(() => {
    if (!puedeMatriz) return;
    let activo = true;
    ddMatrizEvaluacionService
      .abrir(fila.id)
      .then(({ id }) => {
        if (!activo) return null;
        setMatrizId(id);
        return ddMatrizEvaluacionService.detalle(id);
      })
      .then((respuesta) => {
        if (!activo || !respuesta) return null;
        const finalEfectivo = resultadoFinalEfectivo(
          respuesta.resultadoFinal,
          respuesta.expediente.estado,
        );
        const legacy =
          !respuesta.resultadoFinal &&
          finalEfectivo !== null &&
          finalEfectivo !== DD_MATRIZ_RESULTADOS_FINALES.EN_REVISION;
        setMatriz(respuesta);
        setFinalLegacy(legacy);
        setFinalBloqueado(
          !resultadoFinalEditable(respuesta.resultadoFinal, respuesta.expediente.estado),
        );
        setResultadoFinalSeleccionado(finalEfectivo);
        setComentarioFinal(respuesta.finalComentario ?? "");
        return ddMatrizEvaluacionService.listar({
          expedienteId: fila.id,
          eventoId: respuesta.expediente.eventoId,
          porEmpresa: true,
          perPage: 100,
        });
      })
      .then((vinculos) => {
        if (activo && vinculos) setMatrizVinculos(vinculos.data);
      })
      .catch((e) => {
        if (activo) setMatrizError(e instanceof Error ? e.message : "No se pudo cargar la matriz");
      })
      .finally(() => {
        if (activo) setMatrizLoading(false);
      });
    return () => { activo = false; };
  }, [fila.id, puedeMatriz]);

  const observacionesAbiertas = (detalle?.observaciones ?? []).filter((observacion) => {
    if (observacion.estado !== DD_OBSERVACION_ESTADOS.ABIERTA) return false;
    if (!observacion.documentoTipo) return true;
    const documento = detalle?.documentos.find((item) => item.tipo === observacion.documentoTipo);
    return documento?.estado !== DD_DOCUMENTO_ESTADOS.APROBADO;
  });
  const requiereComentarioGeneral =
    accion === DD_ACCIONES_REVISION.OBSERVAR &&
    documentosObservados.length === 0 &&
    !texto.trim();
  const requiereComentarioAdicional =
    accion === DD_ACCIONES_REVISION.OBSERVAR &&
    documentosObservados.includes(DD_DOCUMENTOS.ADICIONAL) &&
    !texto.trim();
  const documentosAdicionales = [
    ...DD_DOCUMENTOS_REQUERIDOS,
    DD_DOCUMENTO_VIGENCIA,
    DD_DOCUMENTO_ADICIONAL,
  ];
  const documentosCargados = (detalle?.documentos ?? []).filter((documento) =>
    DD_DOCUMENTOS_REQUERIDOS.some((requisito) => requisito.tipo === documento.tipo),
  ).length;
  const observadosCount = (detalle?.documentos ?? []).filter(
    (documento) =>
      DD_DOCUMENTOS_REQUERIDOS.some((requisito) => requisito.tipo === documento.tipo) &&
      documento.estado === DD_DOCUMENTO_ESTADOS.OBSERVADO,
  ).length;
  const reenviado = dateUtils.isAfter(detalle?.fechaEnvio, detalle?.fechaRevision);
  const reputacion = detalle?.reputacion ?? [];
  const reputacionConHallazgos = reputacion.some(
    (caso) =>
      caso.estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS ||
      caso.estado === DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION ||
      caso.resultado === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS ||
      caso.resultado === DD_REPUTACION_RESULTADOS.OBSERVADO ||
      caso.resultado === DD_REPUTACION_RESULTADOS.REQUIERE_DEBIDA_DILIGENCIA,
  );
  const esAprobada = detalle?.estado === DD_ESTADOS.APROBADA;
  const enLegal = detalle?.estado === DD_ESTADOS.EN_LEGAL;
  const rechazada = detalle?.estado === DD_ESTADOS.RECHAZADA;
  const retornoLegal = detalle?.decisionLegal === DD_ACCIONES_LEGAL.APROBAR;
  const rechazadaPorLegal =
    rechazada && detalle?.decisionLegal === DD_ACCIONES_LEGAL.RECHAZAR;
  const rechazadaCerrada = rechazada && Boolean(detalle?.decisionLegal);
  const puedeDerivar = esAprobada || (rechazada && !detalle?.decisionLegal);
  const declaracionVigencia =
    detalle?.documentos.find(
      (documento) => documento.tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA,
    ) ?? null;
  const requiereRevalidacion = Boolean(detalle?.requiereRevalidacion);
  const declaracionVigenciaEstado = detalle?.declaracionVigenciaEstado ?? null;
  const mostrarRevalidacion =
    requiereRevalidacion && declaracionVigenciaEstado !== DD_DOCUMENTO_ESTADOS.APROBADO;
  const puedeAprobarDeclaracion =
    declaracionVigencia?.estado === DD_DOCUMENTO_ESTADOS.CARGADO;
  const etiquetaRevalidacion =
    REVALIDACION_ESTADO_LABELS[declaracionVigenciaEstado ?? ""] ?? "No cargada";
  /* La derivación a Legal se realiza únicamente desde la matriz. */
  const acciones = ACCIONES.filter(
    (opcion) => opcion.value !== DD_ACCIONES_REVISION.RECHAZAR,
  );
  const sinDecision = enLegal || rechazadaCerrada;
  const documentoObservadoFinal =
    resultadoFinalSeleccionado === DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA;
  const marcandoDocumentos = onResultadoFinal
    ? documentoObservadoFinal && !finalBloqueado
    : accion === DD_ACCIONES_REVISION.OBSERVAR && !sinDecision;
  const accionPermitida =
    !sinDecision &&
    (!puedeDerivar || accion === DD_ACCIONES_REVISION.RECHAZAR) &&
    !(reputacionConHallazgos && accion === DD_ACCIONES_REVISION.APROBAR);

  const cambiarDeclaracionVinculos = async (valor: boolean) => {
    if (guardandoDeclaracion) return;
    if (valor) {
      const ok = await confirm({
        title: "Declarar vínculos completos",
        description:
          "Confirmas que revisaste la solicitud y que todos sus vínculos están registrados y completos. La declaración quedará auditada con tu usuario y la fecha.",
        confirmLabel: "Declarar",
      });
      if (!ok) return;
    }
    setGuardandoDeclaracion(true);
    setError(null);
    try {
      const actualizado = await debidaDiligenciaService.declararVinculosCompletos({
        expedienteId: fila.id,
        completos: valor,
      });
      setDetalle(actualizado);
      setVinculosCompletos(Boolean(actualizado.vinculosCompletos));
      toast.success(
        valor
          ? "Declaración registrada: vínculos revisados y completos"
          : "Declaración de vínculos completos retirada",
      );
      onDone();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo guardar la declaración";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardandoDeclaracion(false);
    }
  };

  /** Deriva explicitamente los nombres a Comunicaciones (accion independiente de la decision). */
  const derivarNombresAComunicaciones = async () => {
    if (derivando) return;
    const ok = await confirm({
      title: reputacion.length > 0 ? "Enviar nombres nuevos a Comunicaciones" : "Derivar a Comunicaciones",
      description:
        "Se enviarán a revisión reputacional la empresa, el representante, los beneficiarios y los vínculos de la matriz que aún no tengan un caso. No cambia el estado del expediente.",
      confirmLabel: "Derivar",
    });
    if (!ok) return;
    setDerivando(true);
    setError(null);
    try {
      const resultado = await debidaDiligenciaService.derivarComunicaciones(fila.id);
      if (resultado.derivados === 0) {
        toast.info("No hay nombres nuevos para Comunicaciones");
      } else {
        toast.success(`${resultado.derivados} nombre(s) nuevo(s) derivado(s) a Comunicaciones`);
      }
      const actualizado = await debidaDiligenciaService.detalle(fila.id);
      setDetalle(actualizado);
      onDone();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo derivar a Comunicaciones";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setDerivando(false);
    }
  };

  const cambiarAccion = (valor: string) => {
    if (sinDecision) {
      setError("Este expediente ya no admite una decisión de Logística.");
      return;
    }
    if (puedeDerivar && valor !== DD_ACCIONES_REVISION.RECHAZAR) {
      setError(
        esAprobada
          ? "La debida diligencia ya está aprobada. Solo se puede derivar a revisión legal."
          : "El expediente ya está rechazado. Solo se puede derivar a revisión legal.",
      );
      return;
    }
    if (reputacionConHallazgos && valor === DD_ACCIONES_REVISION.APROBAR) {
      setError("No se puede aprobar: Comunicaciones registró hallazgos reputacionales.");
      return;
    }
    setAccion(valor as DdAccionRevision);
    setError(null);
  };

  const alternarDocumento = (tipo: DdDocumentoTipo) => {
    if (!marcandoDocumentos || guardandoFinal !== null) return;
    setDocumentosObservados((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo],
    );
    setError(null);
  };

  const guardarRevalidacion = async (accionDeclaracion: "aprobar" | "observar") => {
    if (revalidacionGuardando) return;
    const comentario = textoRevalidacion.trim();
    if (accionDeclaracion === "observar" && !comentario) {
      setRevalidacionError("Describe qué debe corregir el cliente en la declaración.");
      return;
    }
    setRevalidacionGuardando(true);
    setRevalidacionError(null);
    setError(null);
    try {
      const actualizado = await debidaDiligenciaService.revisar({
        expedienteId: fila.id,
        alcance: DD_ALCANCES_REVISION.DECLARACION_VIGENCIA,
        accion:
          accionDeclaracion === "aprobar"
            ? DD_ACCIONES_REVISION.APROBAR
            : DD_ACCIONES_REVISION.OBSERVAR,
        motivo: comentario || null,
        documentosObservados:
          accionDeclaracion === "observar"
            ? [DD_DOCUMENTOS.DECLARACION_VIGENCIA]
            : [],
        observaciones: [],
      });
      setDetalle(actualizado);
      setTextoRevalidacion("");
      toast.success(
        accionDeclaracion === "aprobar"
          ? "Declaración de vigencia aprobada"
          : "Declaración de vigencia observada",
      );
      onDone();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo registrar la revalidación";
      setRevalidacionError(mensaje);
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setRevalidacionGuardando(false);
    }
  };

  const registrarResultadoFinal = async (resultado: DdMatrizResultadoFinal) => {
    if (!onResultadoFinal || guardandoFinal) return;
    const esDocumentacionObservada =
      resultado === DD_MATRIZ_RESULTADOS_FINALES.DOCUMENTACION_OBSERVADA;
    if (!esDocumentacionObservada && !comentarioFinal.trim()) {
      setError("Escribe el comentario interno antes de registrar la conclusión final");
      return;
    }
    if (esDocumentacionObservada && !comentarioClienteFinal.trim()) {
      setError("Escribe el comentario para el cliente antes de registrar la conclusión final");
      return;
    }
    const ok = await confirm({
      title: `Registrar ${DD_MATRIZ_RESULTADO_FINAL_LABELS[resultado]}`,
      description: esDocumentacionObservada
        ? "Se registrará la documentación observada, se notificará al cliente y podrá corregir la información."
        : "Se actualizará el resultado final del vínculo de empresa en la matriz.",
      confirmLabel: "Registrar resultado",
    });
    if (!ok) return;
    setGuardandoFinal(resultado);
    setError(null);
    try {
      await onResultadoFinal(resultado, comentarioFinal.trim() || undefined, {
        clienteComentario: esDocumentacionObservada ? comentarioClienteFinal.trim() || null : null,
        documentosObservados: esDocumentacionObservada ? documentosObservados : [],
      });
      toast.success(`Resultado final: ${DD_MATRIZ_RESULTADO_FINAL_LABELS[resultado]}`);
      onDone();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo registrar el resultado final";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardandoFinal(null);
    }
  };

  const guardar = async () => {
    if (!accionPermitida) {
      setError(
        enLegal
          ? "El expediente está en revisión legal."
          : rechazada
            ? "El expediente ya fue rechazado."
            : "La debida diligencia ya está aprobada. Solo se puede derivar a revisión legal.",
      );
      return;
    }
    if (requiereComentarioGeneral) {
      setError("Describe la observación general antes de solicitar correcciones.");
      return;
    }
    if (requiereComentarioAdicional) {
      setError("Describe qué documento adicional debe subir el cliente.");
      return;
    }
    if (reputacionConHallazgos && accion === DD_ACCIONES_REVISION.APROBAR) {
      setError("No se puede aprobar: Comunicaciones registró hallazgos reputacionales.");
      return;
    }
    if (accion === DD_ACCIONES_REVISION.RECHAZAR && !texto.trim()) {
      setError("El motivo de la derivación a Legal es obligatorio.");
      return;
    }
    if (accion === DD_ACCIONES_REVISION.RECHAZAR && !informeLogisticaUrl.trim()) {
      setError("El link del informe de Logística es obligatorio.");
      return;
    }

    const esAprobar = accion === DD_ACCIONES_REVISION.APROBAR;
    const ok = await confirm({
      title: esAprobar ? "Registrar APTO" : accion === DD_ACCIONES_REVISION.OBSERVAR ? "Registrar DOCUMENTACIÓN OBSERVADA" : "Derivar a Legal",
      description: esAprobar
        ? `La empresa quedará APTO por ${DD_VIGENCIA_MESES} meses, con vencimiento calculado desde hoy.`
        : accion === DD_ACCIONES_REVISION.OBSERVAR
          ? "Se notificará al contacto declarado con las observaciones y podrá corregir y solicitar una nueva evaluación."
          : "El expediente se enviará a revisión de Legal. El cliente no será notificado hasta que Legal emita su informe y decisión.",
      confirmLabel: esAprobar ? "Registrar APTO" : accion === DD_ACCIONES_REVISION.OBSERVAR ? "Registrar DOCUMENTACIÓN OBSERVADA" : "Derivar a Legal",
      destructive: false,
    });
    if (!ok) return;

    setGuardando(true);
    setError(null);
    try {
      const observaciones = documentosObservados.map((tipo) => ({
        documentoTipo: tipo,
        texto:
          texto.trim() ||
          (tipo === DD_DOCUMENTOS.ADICIONAL
            ? "El revisor solicita un documento adicional en PDF."
            : `El documento "${DD_DOCUMENTOS_REQUERIDOS.find((d) => d.tipo === tipo)?.titulo ?? tipo}" requiere corrección.`),
      }));
      await debidaDiligenciaService.revisar({
        expedienteId: fila.id,
        accion,
        motivo: texto.trim() || null,
        informeLogisticaUrl: informeLogisticaUrl.trim() || null,
        documentosObservados,
        observaciones,
      });
      toast.success(
        accion === DD_ACCIONES_REVISION.APROBAR
          ? "Resultado APTO registrado"
          : accion === DD_ACCIONES_REVISION.OBSERVAR
            ? "Documentación observada registrada"
            : "Debida diligencia derivada a Legal",
      );
      onDone();
      onClose();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo guardar la decisión";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(valor) => { if (!valor) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-base font-semibold">Revisar debida diligencia</DialogTitle>
              <DdEstadoBadge estado={detalle?.estado ?? fila.estado} />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setHistorialOpen(true)}
            >
              <History className="h-3.5 w-3.5" />
              <span>Historial</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {fila.empresa.razonSocial} · RUC {fila.empresa.ruc} · {fila.codigo}
          </p>
          {detalle ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span><strong className="text-foreground">Vínculos:</strong> {ddUtils.etiquetaVinculos(detalle.tipoRelacionComercial) || "Sin clasificar"}</span>
              <span><strong className="text-foreground">Procedencia:</strong> {DD_ORIGEN_LABELS[detalle.origen] ?? detalle.origen}</span>
              <span><strong className="text-foreground">Enviado:</strong> {dateUtils.format(detalle.fechaEnvio)}</span>
              <span><strong className="text-foreground">Documentos:</strong> {documentosCargados}/{DD_DOCUMENTOS_REQUERIDOS.length}{observadosCount > 0 ? ` · ${observadosCount} observado(s)` : ""}</span>
              <span><strong className="text-foreground">Representante:</strong> {detalle.representanteNombre ?? "—"}</span>
            </div>
          ) : null}
          {reenviado ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-xs text-foreground">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p>
                <span className="font-semibold text-success">El cliente subsanó la documentación.</span>{" "}
                Reenviado el {dateUtils.formatDateTime(detalle?.fechaEnvio)}. Revisa las nuevas versiones antes de emitir una decisión.
              </p>
            </div>
          ) : null}
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : !detalle ? (
          <p className="py-8 text-center text-sm text-destructive">{error ?? "No se pudo cargar el expediente"}</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_350px] lg:overflow-hidden">
            <div className="p-5 lg:min-h-0 lg:overflow-y-auto">
              <Tabs defaultValue="documentos" className="flex flex-col gap-4">
                <TabsList className={`grid w-full ${puedeMatriz ? "grid-cols-4" : "grid-cols-3"}`}>
                  <TabsTrigger value="resumen"><span>Resumen</span></TabsTrigger>
                  <TabsTrigger value="documentos" className="gap-1.5">
                    <span>Documentos</span>
                    <Badge className={`pointer-events-none text-[9px] ${observadosCount > 0 ? BADGE_STYLES.WARNING : BADGE_STYLES.NEUTRAL}`}>
                      <span>{observadosCount > 0 ? `${observadosCount} obs.` : `${documentosCargados}/${DD_DOCUMENTOS_REQUERIDOS.length}`}</span>
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="reputacion" className="gap-1.5">
                    <span>Reputación</span>
                    <Badge className={`pointer-events-none text-[9px] ${reputacion.some((r) => r.estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS) ? BADGE_STYLES.DESTRUCTIVE : BADGE_STYLES.NEUTRAL}`}>
                      <span>{reputacion.length}</span>
                    </Badge>
                  </TabsTrigger>
                  {puedeMatriz ? (
                    <TabsTrigger value="matriz"><span>Matriz</span></TabsTrigger>
                  ) : null}
                </TabsList>

                <TabsContent value="resumen" className="mt-0 space-y-4">
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empresa</h3>
                    <div className="grid gap-3 rounded-lg border border-border bg-secondary/30 p-4 sm:grid-cols-2">
                      <DatoResumen label="Razón social">{detalle.empresa.razonSocial}</DatoResumen>
                      <DatoResumen label="RUC"><span className="font-mono">{detalle.empresa.ruc}</span></DatoResumen>
                      <DatoResumen label="País de constitución">
                        {detalle.paisConstitucion ? (
                          <span className="inline-flex items-center gap-1.5">
                            <DdPaisBandera pais={paisDeTexto(detalle.paisConstitucion)} />
                            <span>{detalle.paisConstitucion}</span>
                          </span>
                        ) : "—"}
                      </DatoResumen>
                      <DatoResumen label="Actividad económica">
                        {detalle.actividadEconomica ?? "—"}
                        {detalle.actividadEconomicaOtro ? ` (${detalle.actividadEconomicaOtro})` : ""}
                      </DatoResumen>
                      <DatoResumen label="Sitio web">
                        {detalle.sitioWeb ? (
                          <a href={detalle.sitioWeb} target="_blank" rel="noreferrer" className="break-all text-primary underline underline-offset-2">
                            {detalle.sitioWeb}
                          </a>
                        ) : "—"}
                      </DatoResumen>
                      <DatoResumen label="Correo del representante">
                        {detalle.emailRepresentante ? (
                          <a href={`mailto:${detalle.emailRepresentante}`} className="break-all text-primary underline underline-offset-2">
                            {detalle.emailRepresentante}
                          </a>
                        ) : "—"}
                      </DatoResumen>
                    </div>
                  </section>

                  {detalle.origen === DD_ORIGENES.IMPORTADO ? (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Procedencia</h3>
                      <div className="grid gap-3 rounded-lg border border-border bg-secondary/30 p-4 sm:grid-cols-2">
                        <DatoResumen label="Origen">
                          {DD_ORIGEN_LABELS[detalle.origen] ?? detalle.origen}
                        </DatoResumen>
                        <DatoResumen label="Estado de origen">{detalle.estadoOrigen ?? "—"}</DatoResumen>
                        <DatoResumen label="Evento o proyecto">{detalle.eventoProyecto ?? "—"}</DatoResumen>
                        <DatoResumen label="Motivo de importación">{detalle.motivoImportacion ?? "—"}</DatoResumen>
                      </div>
                    </section>
                  ) : null}

                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Representante legal</h3>
                    <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
                      <DatoResumen label="Nombre">{detalle.representanteNombre ?? "—"}</DatoResumen>
                      <DatoResumen label="Tipo de documento">{detalle.representanteTipoDocumento ?? "—"}</DatoResumen>
                      <DatoResumen label="Número de documento">{detalle.representanteDocumento ?? "—"}</DatoResumen>
                      <DatoResumen label="Nacionalidad">
                        {detalle.representanteNacionalidad ? (
                          <span className="inline-flex items-center gap-1.5">
                            <DdPaisBandera pais={paisDeTexto(detalle.representanteNacionalidad)} />
                            <span>{detalle.representanteNacionalidad}</span>
                          </span>
                        ) : "—"}
                      </DatoResumen>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Beneficiarios finales (10% o más)
                    </h3>
                    {detalle.beneficiarios.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                        Sin beneficiarios finales declarados.
                      </p>
                    ) : (
                      <div className="divide-y divide-border rounded-lg border border-border">
                        {detalle.beneficiarios.map((beneficiario) => (
                          <div key={beneficiario.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground">{beneficiario.nombre}</p>
                              <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                                <span>
                                  Documento:{" "}
                                  {[beneficiario.tipoDocumento, beneficiario.documento].filter(Boolean).join(" ")}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <DdPaisBandera pais={paisDeTexto(beneficiario.nacionalidad)} />
                                  <span>Nacionalidad: {beneficiario.nacionalidad}</span>
                                </span>
                              </p>
                            </div>
                            <span className="shrink-0 text-xs font-semibold text-primary">{beneficiario.porcentaje}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {detalle.fechaLegal ? (
                    <section className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resolución legal</h3>
                      <div className="rounded-lg border border-border bg-secondary/30 p-4">
                        <p className="text-xs font-semibold text-foreground">
                          {detalle.decisionLegal === DD_ACCIONES_LEGAL.APROBAR ? "Aprobada por Legal" : "Rechazada por Legal"}
                        </p>
                        {detalle.motivoLegal ? <p className="mt-1 text-[11px] text-muted-foreground">{detalle.motivoLegal}</p> : null}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {detalle.legalRevisor ? `Revisado por ${detalle.legalRevisor}` : ""}
                          {detalle.fechaLegal ? ` el ${dateUtils.formatDateTime(detalle.fechaLegal)}` : ""}
                        </p>
                        {detalle.informeLegalUrl ? (
                          <a href={detalle.informeLegalUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] font-medium text-primary underline underline-offset-2">
                            Ver informe legal{detalle.informeLegalNombre ? `: ${detalle.informeLegalNombre}` : ""}
                          </a>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consentimientos y declaración</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={`pointer-events-none text-[10px] ${detalle.aceptaDatos ? BADGE_STYLES.SUCCESS : BADGE_STYLES.DESTRUCTIVE}`}>
                        <span>ARCO {detalle.aceptaDatos ? "aceptado" : "no aceptado"}</span>
                      </Badge>
                      <Badge className={`pointer-events-none text-[10px] ${detalle.aceptaVerificacion ? BADGE_STYLES.SUCCESS : BADGE_STYLES.DESTRUCTIVE}`}>
                        <span>DD reforzada {detalle.aceptaVerificacion ? "aceptada" : "no aceptada"}</span>
                      </Badge>
                      <Badge className={`pointer-events-none text-[10px] ${detalle.declaraVerdad ? BADGE_STYLES.SUCCESS : BADGE_STYLES.WARNING}`}>
                        <span>Declaración jurada {detalle.declaraVerdad ? "aceptada" : "pendiente"}</span>
                      </Badge>
                    </div>
                  </section>
                </TabsContent>

                <TabsContent value="documentos" className="mt-0 space-y-4">
                  {mostrarRevalidacion ? (
                    <section className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-warning">
                            Revalidación de declaración de vigencia
                          </h3>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            La DD sigue aprobada y conserva su vigencia original. Solo se valida el documento.
                          </p>
                        </div>
                        <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.WARNING}`}>
                          <span>{etiquetaRevalidacion}</span>
                        </Badge>
                      </div>

                      {declaracionVigencia ? (
                        <div className="rounded-md border border-border bg-card px-3 py-2">
                          <p className="truncate text-xs font-medium text-foreground">
                            {declaracionVigencia.nombre}
                          </p>
                          {declaracionVigencia.observacion ? (
                            <p className="mt-1 text-[11px] text-warning">
                              {declaracionVigencia.observacion}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          La empresa aún no ha cargado la declaración jurada de vigencia de información.
                        </p>
                      )}

                      {declaracionVigenciaEstado !== DD_DOCUMENTO_ESTADOS.OBSERVADO ? (
                        <div className="space-y-1">
                          <Label htmlFor="revalidacion-comentario" className="text-[11px]">
                            <span>Comentario para el cliente</span>
                          </Label>
                          <Textarea
                            id="revalidacion-comentario"
                            value={textoRevalidacion}
                            onChange={(event) => {
                              setTextoRevalidacion(event.target.value);
                              setRevalidacionError(null);
                            }}
                            placeholder="Indica qué debe corregir el cliente en la declaración"
                            className="min-h-20 text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Obligatorio al observar la declaración.
                          </p>
                          {revalidacionError ? (
                            <p className="text-[11px] font-medium text-destructive">
                              {revalidacionError}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {!declaracionVigencia ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 text-xs"
                            disabled={revalidacionGuardando || !textoRevalidacion.trim()}
                            onClick={() => void guardarRevalidacion("observar")}
                          >
                            Solicitar carga de declaración
                          </Button>
                        ) : null}
                        {puedeAprobarDeclaracion ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 text-xs"
                            disabled={revalidacionGuardando}
                            onClick={() => void guardarRevalidacion("aprobar")}
                          >
                            Aprobar declaración
                          </Button>
                        ) : null}
                        {declaracionVigencia &&
                        declaracionVigenciaEstado !== DD_DOCUMENTO_ESTADOS.APROBADO &&
                        declaracionVigenciaEstado !== DD_DOCUMENTO_ESTADOS.OBSERVADO ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            disabled={revalidacionGuardando || !textoRevalidacion.trim()}
                            onClick={() => void guardarRevalidacion("observar")}
                          >
                            Observar declaración
                          </Button>
                        ) : null}
                      </div>

                      {declaracionVigenciaEstado === DD_DOCUMENTO_ESTADOS.OBSERVADO ? (
                        <p className="text-[11px] font-medium text-warning">
                          El cliente debe subir una nueva versión antes de que se pueda aprobar.
                        </p>
                      ) : null}
                    </section>
                  ) : null}

                  {observacionesAbiertas.length > 0 ? (
                    <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
                      <p className="text-[11px] font-semibold text-warning">Observaciones abiertas ({observacionesAbiertas.length})</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-foreground">
                        {observacionesAbiertas.map((observacion) => (
                          <li key={observacion.id}><span className="font-semibold text-warning">{DD_OBSERVACION_AREA_LABELS[observacion.area] ?? observacion.area}:</span> {observacion.texto}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Documentos {marcandoDocumentos ? <span className="text-destructive">*</span> : null}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {sinDecision
                        ? "El expediente está cerrado para Logística; no se pueden modificar documentos ni observaciones."
                        : marcandoDocumentos
                          ? "Marca los documentos que el cliente debe subsanar. El comentario para el cliente se completa en la conclusión final."
                          : "Revisa el contenido antes de tomar una decisión. Al elegir DOCUMENTACIÓN OBSERVADA podrás marcar los documentos a subsanar."}
                    </p>
                    <div className="space-y-2">
                      {documentosAdicionales.map((requisito) => {
                        const documento = detalle.documentos.find((d) => d.tipo === requisito.tipo);
                        const marcado = documentosObservados.includes(requisito.tipo);
                        return (
                          <div key={requisito.tipo} className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${marcado ? "border-warning/60 bg-warning/5" : "border-border"}`}>
                            <div className="flex min-w-0 items-start gap-2.5">
                              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground">{requisito.titulo}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  {documento ? (
                                    <>
                                      <DdDocumentoBadge estado={documento.estado} />
                                      <span className="truncate text-[11px] text-muted-foreground">{documento.nombre}</span>
                                      <a href={documento.url} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-primary underline underline-offset-2">
                                        Ver archivo
                                      </a>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 gap-1 px-1.5 text-[10px]"
                                        onClick={() => setPreviewDocumento({ url: documento.url, nombre: documento.nombre })}
                                      >
                                        <Eye className="h-3 w-3" />
                                        <span>Vista previa</span>
                                      </Button>
                                    </>
                                  ) : (
                                    <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
                                      <span>No cargado</span>
                                    </Badge>
                                  )}
                                </div>
                                {documento?.observacion ? (
                                  <p className="mt-1 text-[11px] text-warning">{documento.observacion}</p>
                                ) : null}
                                {documento && documento.versiones.length > 0 ? (
                                  <details className="mt-2 rounded-md border border-border/70 bg-secondary/20 px-2 py-1.5">
                                    <summary className="cursor-pointer text-[10px] font-semibold text-primary">
                                      Versiones ({documento.versiones.length})
                                    </summary>
                                    <ul className="mt-1 space-y-1">
                                      {documento.versiones.map((version, indice) => {
                                        const esActual = indice === documento.versiones.length - 1;
                                        return (
                                          <li key={version.id} className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                            <Badge className={`pointer-events-none text-[9px] ${esActual ? BADGE_STYLES.SUCCESS : BADGE_STYLES.NEUTRAL}`}>
                                              <span>v{version.version}</span>
                                            </Badge>
                                            <span className="max-w-[180px] truncate text-foreground" title={version.nombre}>
                                              {version.nombre}
                                            </span>
                                            <span className="text-muted-foreground">
                                              {dateUtils.formatDateTime(version.createdAt)}
                                            </span>
                                            {esActual ? <span className="font-semibold text-success">Actual</span> : null}
                                            <Button
                                              type="button"
                                              variant="link"
                                              size="sm"
                                              className="h-auto p-0 text-[10px]"
                                              onClick={() => setPreviewDocumento({ url: version.url, nombre: version.nombre })}
                                            >
                                              Ver
                                            </Button>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </details>
                                ) : null}
                              </div>
                            </div>
                            {marcandoDocumentos ? (
                              <label className={`flex shrink-0 items-center gap-2 text-[11px] font-medium ${marcado ? "text-warning" : "text-muted-foreground"}`}>
                                <Checkbox
                                  checked={marcado}
                                  aria-required
                                  disabled={guardandoFinal !== null}
                                  onCheckedChange={() => alternarDocumento(requisito.tipo)}
                                />
                                <span>Observar *</span>
                              </label>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {requiereComentarioGeneral ? (
                      <p className="text-[11px] font-medium text-warning">
                        Describe la observación general para poder solicitar correcciones.
                      </p>
                    ) : null}
                    {requiereComentarioAdicional ? (
                      <p className="text-[11px] font-medium text-warning">
                        Describe qué documento adicional debe subir el cliente.
                      </p>
                    ) : null}
                  </section>
                </TabsContent>

                <TabsContent value="reputacion" className="mt-0 space-y-4">
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Revisión de Comunicaciones
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Resultados remitidos por Comunicaciones para los nombres derivados por Logística.
                    </p>
                    {reputacion.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                        No se derivaron nombres a Comunicaciones.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {reputacion.map((caso) => {
                          const badge =
                            caso.estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS
                              ? BADGE_STYLES.DESTRUCTIVE
                              : caso.estado === DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION
                                ? BADGE_STYLES.WARNING
                                : caso.estado === DD_REPUTACION_ESTADOS.SIN_HALLAZGOS
                                  ? BADGE_STYLES.SUCCESS
                                  : BADGE_STYLES.NEUTRAL;
                          return (
                            <div key={caso.id} className="rounded-lg border border-border p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-foreground">
                                    {caso.nombreARevisar}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {ddUtils.rolesNombreARevisar(detalle, caso.nombreARevisar).map((rol) => (
                                      <Badge
                                        key={rol}
                                        className={`pointer-events-none text-[9px] ${
                                          rol === DD_REPUTACION_TIPOS.EMPRESA
                                            ? BADGE_STYLES.INFO
                                            : rol === DD_REPUTACION_TIPOS.REPRESENTANTE
                                              ? BADGE_STYLES.INDIGO
                                              : BADGE_STYLES.NEUTRAL
                                        }`}
                                      >
                                        <span>{DD_REPUTACION_TIPO_LABELS[rol]}</span>
                                      </Badge>
                                    ))}
                                  </div>
                                  {caso.nacionalidad ? (
                                    <p className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                      <DdPaisBandera pais={paisDeTexto(caso.nacionalidad)} />
                                      <span>{caso.nacionalidad}</span>
                                    </p>
                                  ) : null}
                                  {caso.sitioWeb ? (
                                    <a
                                      href={caso.sitioWeb}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="break-all text-[10px] text-primary underline underline-offset-2"
                                    >
                                      {caso.sitioWeb}
                                    </a>
                                  ) : null}
                                </div>
                                <Badge className={`pointer-events-none text-[9px] ${badge}`}>
                                  <span>{DD_REPUTACION_ESTADO_LABELS[caso.estado] ?? caso.estado}</span>
                                </Badge>
                              </div>
                              <p className="mt-2 text-[11px] font-medium text-foreground">
                                Resultado:{" "}
                                {caso.resultado
                                  ? DD_REPUTACION_RESULTADO_LABELS[caso.resultado] ?? caso.resultado
                                  : "Pendiente de resultado"}
                              </p>
                              {caso.comentario ? (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {caso.comentario}
                                </p>
                              ) : null}
                              {caso.linkHallazgos ? (
                                <a
                                  href={caso.linkHallazgos}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-block text-[10px] font-medium text-primary underline underline-offset-2"
                                >
                                  Ver sustento de hallazgos
                                </a>
                              ) : null}
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                Derivado por {caso.derivadoPor} el{" "}
                                {dateUtils.formatDateTime(caso.fechaDerivacion)}
                                {caso.revisor ? ` · Revisado por ${caso.revisor}` : ""}
                                {caso.fechaCierre
                                  ? ` · Cerrado el ${dateUtils.formatDateTime(caso.fechaCierre)}`
                                  : ""}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </TabsContent>

                <TabsContent value="matriz" className="mt-0">
                  <DdRevisionMatrizTab
                    detalle={matriz}
                    vinculos={matrizVinculos}
                    loading={matrizLoading}
                    error={matrizError}
                    matrizId={matrizId}
                  />
                </TabsContent>
              </Tabs>
            </div>

            <aside className="flex min-h-0 flex-col border-t border-border bg-secondary/20 lg:border-l lg:border-t-0">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {!onResultadoFinal ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decisión</h3>
                  {retornoLegal && !sinDecision ? (
                    <p className="mb-2 rounded-md border border-success/40 bg-success/5 p-2 text-[10px] text-success">
                      Legal aprobó la revisión. Registra la decisión final de Logística.
                    </p>
                  ) : null}
                  {sinDecision || esAprobada ? (
                    <p className="mb-2 rounded-md border border-warning/40 bg-warning/5 p-2 text-[10px] text-warning">
                      {enLegal
                        ? "El expediente está en revisión legal. La decisión final la registra el área de Legal."
                        : rechazadaCerrada
                          ? rechazadaPorLegal
                            ? "El expediente fue rechazado por Legal. No admite nuevas decisiones de Logística."
                            : "El expediente fue rechazado por Logística después de la revisión legal. No admite nuevas decisiones."
                          : mostrarRevalidacion
                            ? "Esta DD está aprobada y vigente, pero depende de la validación de la Declaración jurada de vigencia de información. Usa el bloque de revalidación o deriva a Legal."
                            : "Esta debida diligencia ya está aprobada. Solo se puede derivar a revisión legal."}
                    </p>
                  ) : rechazada ? (
                    <p className="mb-2 rounded-md border border-warning/40 bg-warning/5 p-2 text-[10px] text-warning">
                      Este expediente está rechazado. Puedes derivarlo a Legal para su revisión.
                    </p>
                  ) : null}
                  {reputacionConHallazgos && !sinDecision ? (
                    <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[10px] font-medium text-destructive">
                      No se puede aprobar: Comunicaciones registró hallazgos reputacionales. Solicita correcciones o deriva a Legal desde la matriz.
                    </p>
                  ) : null}
                  <RadioGroup value={accion} onValueChange={cambiarAccion} className="space-y-2">
                    {acciones.map((opcion) => {
                      const permitida =
                        !sinDecision &&
                        !(reputacionConHallazgos && opcion.value === DD_ACCIONES_REVISION.APROBAR);
                      return (
                      <label
                        key={opcion.value}
                        className={`${permitida ? "cursor-pointer" : "cursor-not-allowed opacity-50"} rounded-lg border p-3 transition-colors ${accion === opcion.value ? "border-primary bg-card" : "border-border bg-card hover:bg-secondary/50"}`}
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={opcion.value} disabled={!permitida} className="peer sr-only" />
                          <DdRadioIndicator selected={accion === opcion.value} className="peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                          <span className="text-xs font-semibold text-foreground">
                            {opcion.value === DD_ACCIONES_REVISION.APROBAR ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-success" /> : <AlertCircle className="mr-1 inline h-3.5 w-3.5 text-warning" />}
                            {opcion.label}
                          </span>
                        </div>
                        <p className="mt-1 pl-6 text-[10px] leading-snug text-muted-foreground">{opcion.detalle}</p>
                      </label>
                      );
                    })}
                  </RadioGroup>
                </div>
                ) : null}

                {onResultadoFinal ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conclusión final</h3>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Registra la conclusión final del vínculo. Los estados automáticos también se pueden registrar manualmente.
                    </p>
                    {finalLegacy ? (
                      <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[10px] leading-snug text-amber-900">
                        Caso legacy: el resultado final se hereda del estado del expediente. No es
                        necesario volver a registrarlo.
                      </p>
                    ) : null}
                    {finalBloqueado && !finalLegacy ? (
                      <p className="rounded-md border border-border bg-secondary/40 p-2 text-[10px] leading-snug text-foreground">
                        El resultado final ya está cerrado. Solo se puede modificar cuando el
                        expediente está en revisión o con documentación observada.
                      </p>
                    ) : null}
                    <div className="grid gap-1.5">
                      {FINALES.map((opcion) => (
                        <button
                          key={opcion.value}
                          type="button"
                          className={`w-full rounded-lg border p-3 text-left transition hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50 ${
                            resultadoFinalSeleccionado === opcion.value
                              ? opcion.value === DD_MATRIZ_RESULTADOS_FINALES.APTO
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-primary bg-primary/10"
                              : "border-border bg-card"
                          }`}
                          disabled={guardandoFinal !== null || finalBloqueado}
                          onClick={() => {
                            setResultadoFinalSeleccionado(opcion.value);
                            setFinalLegacy(false);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {DD_MATRIZ_RESULTADO_FINAL_LABELS[opcion.value]}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{opcion.detalle}</p>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1 rounded-lg border border-primary/25 bg-secondary/30 p-3">
                      <Label htmlFor="final-comentario" className="text-[10px] font-medium uppercase text-muted-foreground">
                        <span>
                          Comentario interno{" "}
                          {documentoObservadoFinal ? (
                            <span className="normal-case text-muted-foreground">(opcional)</span>
                          ) : (
                            <span className="text-destructive">*</span>
                          )}
                        </span>
                      </Label>
                      <Textarea
                        id="final-comentario"
                        className="min-h-20 bg-card text-xs"
                        maxLength={DD_MATRIZ_FINAL_COMENTARIO_MAX}
                        disabled={!resultadoFinalSeleccionado || finalBloqueado}
                        value={comentarioFinal}
                        aria-required={!documentoObservadoFinal}
                        onChange={(event) => { setComentarioFinal(event.target.value); setError(null); }}
                        placeholder={
                          resultadoFinalSeleccionado
                            ? "Sustento interno de la conclusión final. No se muestra al cliente."
                            : "Selecciona un estado final para habilitar el comentario."
                        }
                      />
                      <p className={`text-[10px] ${documentoObservadoFinal || comentarioFinal.trim() ? "text-muted-foreground" : "font-medium text-warning"}`}>
                        {documentoObservadoFinal
                          ? "Opcional para DOCUMENTACIÓN OBSERVADA. Solo visible para el equipo interno."
                          : comentarioFinal.trim()
                            ? "Solo visible para el equipo interno."
                            : "Falta este comentario para habilitar el botón."}
                      </p>
                    </div>

                    {documentoObservadoFinal ? (
                      <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50/50 p-3">
                        <Label
                          htmlFor="final-comentario-cliente"
                          className="text-[10px] font-medium uppercase text-muted-foreground"
                        >
                          <span>Comentario para el cliente</span>
                        </Label>
                        <Textarea
                          id="final-comentario-cliente"
                          className="min-h-20 bg-card text-xs"
                          maxLength={1000}
                          disabled={guardandoFinal !== null}
                          value={comentarioClienteFinal}
                          onChange={(event) => {
                            setComentarioClienteFinal(event.target.value);
                            setError(null);
                          }}
                          placeholder="Indica qué documentación debe subsanar el cliente."
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Obligatorio. Este texto sí se envía al cliente. Marca los documentos a subsanar en la pestaña{" "}
                          <span className="font-semibold text-foreground">Documentos</span>.
                        </p>
                        {documentosObservados.length > 0 ? (
                          <p className="text-[10px] font-medium text-warning">
                            {documentosObservados.length} documento(s) marcado(s) para subsanación.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      disabled={
                        finalBloqueado ||
                        !resultadoFinalSeleccionado ||
                        (!documentoObservadoFinal && !comentarioFinal.trim()) ||
                        (documentoObservadoFinal && !comentarioClienteFinal.trim()) ||
                        guardandoFinal !== null
                      }
                      onClick={() => {
                        if (resultadoFinalSeleccionado) {
                          void registrarResultadoFinal(resultadoFinalSeleccionado);
                        }
                      }}
                    >
                      {guardandoFinal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span>Registrar conclusión final</span>
                    </Button>
                  </div>
                ) : null}

                {!onResultadoFinal ? (
                <>
                <div className="space-y-2">
                  <Label className="text-xs"><span>Comentario para el cliente</span></Label>
                  <Textarea
                    value={texto}
                    onChange={(e) => { setTexto(e.target.value); setError(null); }}
                    placeholder={accion === DD_ACCIONES_REVISION.RECHAZAR ? "Motivo de la derivación a Legal (obligatorio)" : "Detalle las correcciones solicitadas o el motivo de la decisión"}
                    className="min-h-24 text-sm"
                  />
                  {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
                </div>

                {accion === DD_ACCIONES_REVISION.RECHAZAR && !sinDecision ? (
                  <div className="space-y-2">
                    <Label className="text-xs">
                      <span>Link del informe para Legal <span className="text-destructive">*</span></span>
                    </Label>
                    <Input
                      type="url"
                      value={informeLogisticaUrl}
                      onChange={(e) => { setInformeLogisticaUrl(e.target.value); setError(null); }}
                      placeholder="https://drive.google.com/..."
                      className="h-9 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Pega aquí el enlace de Drive del informe que Logística entrega a Legal.
                    </p>
                  </div>
                ) : null}
                </>
                ) : null}

                <div className="space-y-3 rounded-lg border border-border bg-card p-3">
                  <div className="min-w-0 w-full">
                    <p className="text-xs font-semibold text-foreground">Revisión reputacional</p>
                    <p className="mt-0.5 whitespace-normal break-words text-[11px] leading-relaxed text-muted-foreground">
                      Deriva los nombres de empresa, representante y beneficiarios a Comunicaciones.
                      Es independiente de la decisión.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs sm:w-auto"
                    disabled={derivando || sinDecision || !vinculosCompletos || guardandoDeclaracion}
                    onClick={() => { void derivarNombresAComunicaciones(); }}
                  >
                    {derivando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    <span>{reputacion.length > 0 ? "Enviar nuevos a Comunicaciones" : "Derivar a Comunicaciones"}</span>
                  </Button>
                  <label className="flex items-start gap-2 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                    <Checkbox
                      checked={vinculosCompletos}
                      onCheckedChange={(valor) => { void cambiarDeclaracionVinculos(valor === true); }}
                      disabled={guardandoDeclaracion || sinDecision}
                      className="mt-0.5"
                    />
                    <span>
                      He revisado que <strong className="text-foreground">todos los vínculos de la solicitud están registrados y completos</strong>.
                      Esta declaración es obligatoria para enviar nombres a Comunicaciones.
                    </span>
                  </label>
                  <p className="pl-6 text-[10px] text-muted-foreground">
                    {vinculosCompletos ? (
                      <>
                        Declarado por{" "}
                        <span className="font-medium text-foreground">
                          {detalle?.vinculosCompletosPor ?? "usuario no registrado"}
                        </span>
                        {detalle?.vinculosCompletosEn
                          ? ` el ${dateUtils.formatDateTime(detalle.vinculosCompletosEn)}`
                          : ""}
                      </>
                    ) : (
                      "Sin declaración de vínculos completos."
                    )}
                  </p>
                </div>
              </div>

              <div className="shrink-0 space-y-2 border-t border-border bg-card p-4">
                {!onResultadoFinal && requiereComentarioGeneral ? (
                  <p className="text-[11px] font-medium text-warning">
                    Describe la observación general antes de solicitar correcciones.
                  </p>
                ) : null}
                {!onResultadoFinal ? (
                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  disabled={loading || !detalle || guardando || requiereComentarioGeneral || requiereComentarioAdicional || !accionPermitida}
                  onClick={() => void guardar()}
                >
                  {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>Guardar decisión</span>
                </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={onClose} disabled={guardando}>
                  <span>Cerrar</span>
                </Button>
              </div>
            </aside>
          </div>
        )}
        <DdHistorialDialog
          expedienteId={fila.id}
          open={historialOpen}
          onOpenChange={setHistorialOpen}
        />
        <DdDocumentoPreviewDialog
          documento={previewDocumento}
          onClose={() => setPreviewDocumento(null)}
        />
        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}

