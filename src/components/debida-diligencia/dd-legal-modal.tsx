"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { AlertCircle, CheckCircle2, ClipboardList, Eye, FileText, Loader2, Scale, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DdDocumentoBadge, DdReputacionBadge } from "./dd-estado-badge";
import { DdDocumentoPreviewDialog } from "./dd-documento-preview-dialog";
import { DdRadioIndicator } from "./dd-radio-indicator";
import { DdVinculosEvidencias } from "./dd-vinculos-evidencias";
import { useConfirm } from "@/hooks/use-confirm";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  BADGE_STYLES,
  DD_RUTAS,
  DD_ACCIONES_LEGAL,
  DD_DOCUMENTO_ADICIONAL,
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTO_VIGENCIA,
  DD_ESTADOS,
  DD_OBSERVACION_AREAS,
  DD_OBSERVACION_ESTADOS,
  DD_DOCUMENTOS,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_REPUTACION_TIPOS,
  DD_REPUTACION_TIPO_LABELS,
  type DdAccionLegal,
  type DdDocumentoTipo,
} from "@/lib/shared/constants";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";
import { dateUtils } from "@/lib/shared/utils/date";
import type {
  DdBandejaRowDTO,
  DdExpedienteDTO,
  DdInformeLegalUploadResponseDTO,
  DdObservacionDTO,
} from "@/types/dto/debida-diligencia";

interface Props {
  fila: DdBandejaRowDTO;
  onClose: () => void;
  onDone: () => void;
}

export function DdLegalModal({ fila, onClose, onDone }: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const [detalle, setDetalle] = useState<DdExpedienteDTO | null>(null);
  const [matrizId, setMatrizId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<DdAccionLegal>(DD_ACCIONES_LEGAL.APROBAR);
  const [documentosObservados, setDocumentosObservados] = useState<DdDocumentoTipo[]>([]);
  const [motivo, setMotivo] = useState("");
  const [informe, setInforme] = useState<DdInformeLegalUploadResponseDTO | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewDocumento, setPreviewDocumento] = useState<{ url: string; nombre: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let activo = true;
    debidaDiligenciaService
      .detalle(fila.id)
      .then((r) => {
        if (!activo) return;
        setDetalle(r);
        setMotivo("");
      })
      .catch((e) => {
        if (activo) setError(e instanceof Error ? e.message : "No se pudo cargar el expediente");
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [fila.id]);

  useEffect(() => {
    let activo = true;
    ddMatrizEvaluacionService
      .abrir(fila.id)
      .then(({ id }) => {
        if (activo) setMatrizId(id);
      })
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [fila.id]);

  const subirInforme = async (file: File) => {
    setSubiendo(true);
    setError(null);
    try {
      const subido = await debidaDiligenciaService.subirInformeLegal(file);
      setInforme(subido);
      toast.success("Informe legal cargado");
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo cargar el informe legal";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    if (decision === DD_ACCIONES_LEGAL.RECHAZAR && !informe) {
      setError("Adjunta el informe legal en PDF antes de rechazar.");
      return;
    }
    if (decision === DD_ACCIONES_LEGAL.RECHAZAR && !motivo.trim()) {
      setError("El motivo del rechazo legal es obligatorio.");
      return;
    }
    if (requiereExplicarAdicional) {
      setError("Describe qué documento adicional debe subir la empresa.");
      return;
    }
    if (decision === DD_ACCIONES_LEGAL.OBSERVAR && !motivo.trim()) {
      setError("El motivo de la observación legal es obligatorio.");
      return;
    }

    const aprobar = decision === DD_ACCIONES_LEGAL.APROBAR;
    const observar = decision === DD_ACCIONES_LEGAL.OBSERVAR;
    const ok = await confirm({
      title: observar
        ? "Observar debida diligencia"
        : aprobar
          ? "Aprobar debida diligencia"
          : "Rechazar debida diligencia",
      description: observar
        ? "El expediente pasará a Observada con la observación de Legal. El cliente deberá subsanar y reenviarlo."
        : aprobar
          ? "Legal aprobará la revisión y el expediente volverá a Logística para la decisión final."
          : "Legal rechazará la debida diligencia y recién entonces se notificará al cliente.",
      confirmLabel: observar ? "Observar" : aprobar ? "Aprobar" : "Rechazar",
      destructive: !aprobar && !observar,
    });
    if (!ok) return;

    setGuardando(true);
    setError(null);
    try {
      await debidaDiligenciaService.resolverLegal({
        expedienteId: fila.id,
        decision,
        motivo: motivo.trim() || null,
        documentosObservados,
        informeLegalNombre: informe?.nombre ?? null,
        informeLegalUrl: informe?.url ?? null,
      });
      toast.success(
        observar
          ? "Expediente observado por Legal; el cliente deberá subsanar"
          : aprobar
            ? "Revisión legal aprobada; el expediente retornó a Logística"
            : "Debida diligencia rechazada por Legal",
      );
      onDone();
      onClose();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo guardar la decisión legal";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const alternarDocumento = (tipo: DdDocumentoTipo) => {
    if (decision !== DD_ACCIONES_LEGAL.OBSERVAR) return;
    setDocumentosObservados((prev) =>
      prev.includes(tipo) ? prev.filter((item) => item !== tipo) : [...prev, tipo],
    );
    setError(null);
  };

  const reputacion = detalle?.reputacion ?? [];
  const documentos = detalle?.documentos ?? [];
  const tituloDocumento = (tipo: string) =>
    DD_DOCUMENTOS_REQUERIDOS.find((documento) => documento.tipo === tipo)?.titulo ??
    (tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA
      ? DD_DOCUMENTO_VIGENCIA.titulo
      : tipo === DD_DOCUMENTOS.ADICIONAL
        ? DD_DOCUMENTO_ADICIONAL.titulo
        : tipo);
  const observacionesAbiertas = (detalle?.observaciones ?? []).filter(
    (observacion) => observacion.estado === DD_OBSERVACION_ESTADOS.ABIERTA,
  );
  const observacionesResueltas = (detalle?.observaciones ?? []).filter(
    (observacion) => observacion.estado !== DD_OBSERVACION_ESTADOS.ABIERTA,
  );
  const subsanado = detalle !== null && ddUtils.subsanoObservacionLegal(detalle.estado, detalle.decisionLegal);
  const documentosCorregidos: string[] =
    subsanado && detalle
      ? [
          ...new Set(
            detalle.observaciones
              .filter(
                (observacion) =>
                  observacion.area === DD_OBSERVACION_AREAS.LEGAL &&
                  observacion.documentoTipo !== null &&
                  (!detalle.fechaLegal || new Date(observacion.createdAt) >= new Date(detalle.fechaLegal)),
              )
              .map((observacion) => observacion.documentoTipo as string),
          ),
        ]
      : [];
  const soloLectura = detalle !== null && detalle.estado !== DD_ESTADOS.EN_LEGAL;
  const requiereInforme = decision === DD_ACCIONES_LEGAL.RECHAZAR;
  const requiereMotivo = decision === DD_ACCIONES_LEGAL.RECHAZAR || decision === DD_ACCIONES_LEGAL.OBSERVAR;
  const requiereExplicarAdicional =
    decision === DD_ACCIONES_LEGAL.OBSERVAR &&
    documentosObservados.includes(DD_DOCUMENTOS.ADICIONAL) &&
    !motivo.trim();
  const puedeGuardar =
    (!requiereInforme || Boolean(informe)) &&
    (!requiereMotivo || motivo.trim().length > 0) &&
    !guardando &&
    !subiendo;

  const opcionesDecision = [
    {
      value: DD_ACCIONES_LEGAL.APROBAR,
      label: "Aprobar",
      ayuda: "Devuelve el expediente a Logística para la decisión final.",
      icon: <CheckCircle2 className="h-4 w-4 text-success" />,
    },
    {
      value: DD_ACCIONES_LEGAL.OBSERVAR,
      label: "Observar",
      ayuda: "El cliente debe subsanar y reenviar el expediente.",
      icon: <AlertCircle className="h-4 w-4 text-warning" />,
    },
    {
      value: DD_ACCIONES_LEGAL.RECHAZAR,
      label: "Rechazar",
      ayuda: "Cierra la DD como NO APTO. Exige informe legal en PDF.",
      icon: <XCircle className="h-4 w-4 text-destructive" />,
    },
  ];

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onClose(); }}>
      <DialogContent className="flex h-[92vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border bg-card px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5 text-primary" />
            <span>Revisión legal de debida diligencia</span>
          </DialogTitle>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{fila.empresa.razonSocial}</span>
              <span>· RUC {fila.empresa.ruc}</span>
              <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
                <span>{fila.codigo}</span>
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Link
                  href={matrizId ? `${DD_RUTAS.MATRIZ}/${matrizId}` : DD_RUTAS.MATRIZ}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Ver expediente en matriz</span>
                </Link>
              </Button>
              <Button asChild type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Link href={DD_RUTAS.REPOSITORIO} target="_blank" rel="noreferrer">
                  <Eye className="h-3.5 w-3.5" />
                  <span>Centro documental</span>
                </Link>
              </Button>
              <Button asChild type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Link href={`${DD_RUTAS.INFORMES}/${fila.id}`} target="_blank" rel="noreferrer">
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span>Informe DD</span>
                </Link>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : !detalle ? (
          <p className="p-8 text-center text-sm text-destructive">
            {error ?? "No se pudo cargar el expediente"}
          </p>
        ) : (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-h-0 space-y-5 overflow-y-auto p-6">
              {subsanado ? (
                <section className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>El cliente subsanó tu observación</span>
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Tu observación{detalle.fechaLegal ? ` del ${dateUtils.formatDateTime(detalle.fechaLegal)}` : ""}
                      {detalle.legalRevisor ? ` (${detalle.legalRevisor})` : ""}:
                    </p>
                    <p className="rounded-md border border-border bg-card p-3 text-sm text-foreground">
                      {detalle.motivoLegal ?? "Sin comentario registrado."}
                    </p>
                  </div>
                  {documentosCorregidos.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Documentos que el cliente corrigió:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {documentosCorregidos.map((tipo) => (
                          <Badge key={tipo} className={`pointer-events-none text-[10px] ${BADGE_STYLES.INFO}`}>
                            <span>{tituloDocumento(tipo)}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Reenviado el {detalle.fechaEnvio ? dateUtils.formatDateTime(detalle.fechaEnvio) : "—"}. Revisa
                    los documentos y registra tu decisión.
                  </p>
                  {detalle.motivoRechazo ? (
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                        Derivación original de Logística
                      </summary>
                      <p className="mt-1.5 text-sm text-foreground">{detalle.motivoRechazo}</p>
                      {detalle.informeLogisticaUrl ? (
                        <a
                          href={detalle.informeLogisticaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs font-medium text-primary underline underline-offset-2"
                        >
                          Ver informe de Logística (Drive)
                        </a>
                      ) : null}
                    </details>
                  ) : null}
                </section>
              ) : (
              <section className="rounded-lg border border-warning/40 bg-warning/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-warning">
                  Motivo de la derivación de Logística
                </p>
                <p className="mt-1.5 text-sm text-foreground">
                  {detalle.motivoRechazo || "Sin motivo registrado."}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Derivado por {detalle.derivadoLegalPor ?? detalle.revisadoPor ?? "—"} el{" "}
                    {detalle.fechaDerivacionLegal
                      ? dateUtils.formatDateTime(detalle.fechaDerivacionLegal)
                      : "—"}
                  </p>
                  {detalle.informeLogisticaUrl ? (
                    <a
                      href={detalle.informeLogisticaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-primary underline underline-offset-2"
                    >
                      Ver informe de Logística (Drive)
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin link de informe de Logística.</p>
                  )}
                </div>
              </section>
              )}

              <Tabs defaultValue="resumen" className="flex flex-col gap-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="resumen"><span>Resumen</span></TabsTrigger>
                  <TabsTrigger value="documentos" className="gap-1.5">
                    <span>Documentos</span>
                    <Badge className={`pointer-events-none px-1.5 text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
                      <span>{documentos.length}</span>
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="observaciones" className="gap-1.5">
                    <span>Observaciones</span>
                    <Badge className={`pointer-events-none px-1.5 text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
                      <span>{observacionesAbiertas.length}</span>
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="comunicaciones" className="gap-1.5">
                    <span>Comunicaciones</span>
                    <Badge className={`pointer-events-none px-1.5 text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
                      <span>{reputacion.length}</span>
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="resumen" className="mt-0 space-y-5">
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Empresa y representante
                    </h3>
                    <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
                      <Dato label="Razón social">{detalle.empresa.razonSocial}</Dato>
                      <Dato label="RUC">{detalle.empresa.ruc}</Dato>
                      <Dato label="Representante">{detalle.representanteNombre ?? "—"}</Dato>
                      <Dato label="Documento">{detalle.representanteDocumento ?? "—"}</Dato>
                      <Dato label="Correo">{detalle.emailRepresentante ?? "—"}</Dato>
                      <Dato label="Sitio web">{detalle.sitioWeb ?? "—"}</Dato>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Vínculos del expediente
                    </h3>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      <Vinculo
                        nombre={detalle.empresa.razonSocial}
                        detalle={`Empresa · RUC ${detalle.empresa.ruc}`}
                        etiqueta="Empresa"
                        estilo={BADGE_STYLES.INFO}
                      />
                      <Vinculo
                        nombre={detalle.representanteNombre ?? "Representante no registrado"}
                        detalle={`Representante legal${
                          detalle.representanteDocumento
                            ? ` · ${detalle.representanteTipoDocumento ?? "Documento"} ${detalle.representanteDocumento}`
                            : ""
                        }`}
                        etiqueta="Representante"
                        estilo={BADGE_STYLES.INDIGO}
                      />
                      {detalle.beneficiarios.map((beneficiario) => (
                        <Vinculo
                          key={beneficiario.id}
                          nombre={beneficiario.nombre}
                          detalle={`${beneficiario.tipoVinculoPersona ?? "Beneficiario"} · ${beneficiario.porcentaje.toFixed(2)}%${
                            beneficiario.documento
                              ? ` · ${[beneficiario.tipoDocumento, beneficiario.documento].filter(Boolean).join(" ")}`
                              : ""
                          }`}
                          etiqueta="Beneficiario / socio"
                          estilo={BADGE_STYLES.NEUTRAL}
                        />
                      ))}
                    </div>
                  </section>
                </TabsContent>

                <TabsContent value="documentos" className="mt-0 space-y-5">
                  {decision === DD_ACCIONES_LEGAL.OBSERVAR ? (
                    <div className="space-y-1 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                      <p>
                        Marca los documentos que la empresa debe subsanar. Si la observación es general,
                        déjala sin marcar y explica el motivo en el comentario legal.
                      </p>
                      <p>
                        Si marcas <strong className="text-foreground">{DD_DOCUMENTO_ADICIONAL.titulo}</strong>, detalla
                        en el comentario qué documento adicional debe subir la empresa.
                      </p>
                    </div>
                  ) : null}
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {documentos.map((documento) => (
                      <div key={documento.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {tituloDocumento(documento.tipo)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{documento.nombre}</p>
                          {documento.versiones.length > 0 ? (
                            <details className="mt-1.5">
                              <summary className="cursor-pointer text-xs font-semibold text-primary">
                                Versiones ({documento.versiones.length})
                              </summary>
                              <ul className="mt-1.5 space-y-1.5">
                                {documento.versiones.map((version) => (
                                  <li key={version.id} className="flex flex-wrap items-center gap-2 text-xs">
                                    <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
                                      <span>v{version.version}</span>
                                    </Badge>
                                    <span className="max-w-[220px] truncate text-foreground" title={version.nombre}>
                                      {version.nombre}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {dateUtils.formatDateTime(version.createdAt)}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="link"
                                      size="sm"
                                      className="h-auto p-0 text-xs"
                                      onClick={() => setPreviewDocumento({ url: version.url, nombre: version.nombre })}
                                    >
                                      Ver
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {decision === DD_ACCIONES_LEGAL.OBSERVAR ? (
                            <label className={`flex cursor-pointer items-center gap-1.5 text-xs font-medium ${documentosObservados.includes(documento.tipo as DdDocumentoTipo) ? "text-warning" : "text-muted-foreground"}`}>
                              <Checkbox
                                checked={documentosObservados.includes(documento.tipo as DdDocumentoTipo)}
                                onCheckedChange={() => alternarDocumento(documento.tipo as DdDocumentoTipo)}
                              />
                              <span>Observar</span>
                            </label>
                          ) : null}
                          {documento.estado !== DD_DOCUMENTO_ESTADOS.CARGADO ? (
                            <DdDocumentoBadge estado={documento.estado} />
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => setPreviewDocumento({ url: documento.url, nombre: documento.nombre })}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Vista previa</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                    {!documentos.some((documento) => documento.tipo === DD_DOCUMENTOS.ADICIONAL) ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{DD_DOCUMENTO_ADICIONAL.titulo}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{DD_DOCUMENTO_ADICIONAL.ayuda}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {decision === DD_ACCIONES_LEGAL.OBSERVAR ? (
                            <label className={`flex cursor-pointer items-center gap-1.5 text-xs font-medium ${documentosObservados.includes(DD_DOCUMENTOS.ADICIONAL) ? "text-warning" : "text-muted-foreground"}`}>
                              <Checkbox
                                checked={documentosObservados.includes(DD_DOCUMENTOS.ADICIONAL)}
                                onCheckedChange={() => alternarDocumento(DD_DOCUMENTOS.ADICIONAL)}
                              />
                              <span>Observar</span>
                            </label>
                          ) : null}
                          <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
                            <span>No cargado</span>
                          </Badge>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <DdVinculosEvidencias expedienteId={fila.id} />
                </TabsContent>

                <TabsContent value="observaciones" className="mt-0 space-y-2">
                  {observacionesAbiertas.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                      Sin observaciones abiertas.
                    </p>
                  ) : (
                    observacionesAbiertas.map((observacion) => (
                      <ObservacionItem key={observacion.id} observacion={observacion} />
                    ))
                  )}
                  {observacionesResueltas.length > 0 ? (
                    <details className="pt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                        Historial de observaciones resueltas ({observacionesResueltas.length})
                      </summary>
                      <div className="mt-2 space-y-2">
                        {observacionesResueltas.map((observacion) => (
                          <ObservacionItem key={observacion.id} observacion={observacion} />
                        ))}
                      </div>
                    </details>
                  ) : null}
                </TabsContent>

                <TabsContent value="comunicaciones" className="mt-0 space-y-2">
                  {reputacion.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                      Sin casos reputacionales derivados.
                    </p>
                  ) : (
                    reputacion.map((caso) => (
                      <div key={caso.id} className="rounded-lg border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{caso.nombreARevisar}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {ddUtils.rolesNombreARevisar(detalle, caso.nombreARevisar).map((rol) => (
                                <Badge
                                  key={rol}
                                  className={`pointer-events-none text-[10px] ${
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
                          </div>
                          <DdReputacionBadge estado={caso.estado} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {caso.resultado ? `Resultado: ${caso.resultado}` : "Pendiente de resultado"}
                          {caso.comentario ? ` · ${caso.comentario}` : ""}
                        </p>
                        {caso.linkHallazgos ? (
                          <a
                            href={caso.linkHallazgos}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs font-medium text-primary underline underline-offset-2"
                          >
                            Ver sustento de hallazgos
                          </a>
                        ) : null}
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {soloLectura ? (
              <aside className="flex min-h-0 flex-col border-t border-border bg-muted/30 lg:border-l lg:border-t-0">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Seguimiento
                  </h3>
                  <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-4">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
                      <AlertCircle className="h-4 w-4" />
                      <span>Esperando subsanación del cliente</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Legal observó este expediente
                      {detalle.fechaLegal ? ` el ${dateUtils.formatDateTime(detalle.fechaLegal)}` : ""}
                      {detalle.legalRevisor ? ` (${detalle.legalRevisor})` : ""}. Cuando la empresa corrija y
                      reenvíe, el expediente volverá a esta bandeja como En revisión legal.
                    </p>
                    {detalle.motivoLegal ? (
                      <p className="rounded-md border border-border bg-card p-3 text-sm text-foreground">
                        {detalle.motivoLegal}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 border-t border-border bg-card p-4">
                  <Button type="button" variant="outline" className="w-full text-sm" onClick={onClose}>
                    Cerrar
                  </Button>
                </div>
              </aside>
            ) : (
            <aside className="flex min-h-0 flex-col border-t border-border bg-muted/30 lg:border-l lg:border-t-0">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Decisión legal
                  </h3>
                  <RadioGroup
                    value={decision}
                    onValueChange={(valor) => {
                      setDecision(valor as DdAccionLegal);
                      setError(null);
                    }}
                    className="space-y-2"
                  >
                    {opcionesDecision.map((opcion) => (
                      <label
                        key={opcion.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-secondary/40 ${decision === opcion.value ? "border-primary ring-1 ring-primary" : "border-border"}`}
                      >
                        <RadioGroupItem value={opcion.value} className="sr-only" />
                        <span className="mt-0.5"><DdRadioIndicator selected={decision === opcion.value} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            {opcion.icon}
                            <span>{opcion.label}</span>
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{opcion.ayuda}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                {decision === DD_ACCIONES_LEGAL.OBSERVAR ? (
                  <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    Se enviará una solicitud de subsanación a la empresa solicitante. Marca los documentos a
                    corregir en la pestaña Documentos.
                    {documentosObservados.length > 0
                      ? ` (${documentosObservados.length} marcado${documentosObservados.length === 1 ? "" : "s"})`
                      : ""}
                  </p>
                ) : null}

                <div className="space-y-1.5">
                  <Label className="text-sm">
                    Comentario legal {requiereMotivo ? <span className="text-destructive">*</span> : null}
                  </Label>
                  <Textarea
                    value={motivo}
                    onChange={(e) => {
                      setMotivo(e.target.value);
                      setError(null);
                    }}
                    placeholder={
                      decision === DD_ACCIONES_LEGAL.RECHAZAR
                        ? "Motivo del rechazo legal (obligatorio)"
                        : decision === DD_ACCIONES_LEGAL.OBSERVAR
                          ? requiereExplicarAdicional
                            ? "Describe qué documento adicional debe subir la empresa (obligatorio)"
                            : "Observación de Legal para que el cliente subsane (obligatoria)"
                          : "Comentario de la decisión legal"
                    }
                    className="min-h-32 text-sm"
                  />
                  {requiereExplicarAdicional ? (
                    <p className="text-xs font-medium text-warning">
                      Indica el nombre o detalle del documento adicional que debe adjuntar la empresa.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Informe legal{" "}
                    {requiereInforme ? (
                      <span className="text-destructive">*</span>
                    ) : (
                      <span className="font-normal normal-case">(opcional)</span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Obligatorio para rechazar. Formato PDF, máximo 10 MB.
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void subirInforme(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    disabled={subiendo}
                    onClick={() => inputRef.current?.click()}
                  >
                    {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    <span>{informe ? "Reemplazar informe" : "Adjuntar informe PDF"}</span>
                  </Button>
                  {informe ? <p className="break-all text-xs text-success">{informe.nombre}</p> : null}
                </div>
              </div>

              <div className="shrink-0 space-y-2 border-t border-border bg-card p-4">
                {error ? <p className="text-xs text-destructive">{error}</p> : null}
                {requiereInforme && !informe ? (
                  <p className="text-xs text-warning">Adjunta el informe legal para habilitar el rechazo.</p>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 text-sm"
                    onClick={onClose}
                    disabled={guardando}
                  >
                    Cerrar
                  </Button>
                  <Button
                    type="button"
                    className="flex-[2] gap-1.5 text-sm"
                    disabled={!puedeGuardar}
                    onClick={() => void guardar()}
                  >
                    {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    <span>Guardar decisión</span>
                  </Button>
                </div>
              </div>
            </aside>
            )}
          </div>
        )}
        <DdDocumentoPreviewDialog
          documento={previewDocumento}
          onClose={() => setPreviewDocumento(null)}
        />
        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium text-foreground">{children}</p>
    </div>
  );
}

function ObservacionItem({ observacion }: { observacion: DdObservacionDTO }) {
  const abierta = observacion.estado === DD_OBSERVACION_ESTADOS.ABIERTA;
  return (
    <div className={`rounded-lg border border-border p-4 ${abierta ? "" : "bg-muted/30"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>
            {observacion.area}
            {observacion.documentoTipo ? ` · ${observacion.documentoTipo}` : ""}
          </span>
          <Badge className={`pointer-events-none text-[10px] ${abierta ? BADGE_STYLES.WARNING : BADGE_STYLES.NEUTRAL}`}>
            <span>{abierta ? "Abierta" : "Resuelta"}</span>
          </Badge>
        </span>
        <span className="text-xs text-muted-foreground">{dateUtils.formatDateTime(observacion.createdAt)}</span>
      </div>
      <p className="mt-1.5 text-sm text-foreground">{observacion.texto}</p>
    </div>
  );
}

function Vinculo({
  nombre,
  detalle,
  etiqueta,
  estilo,
}: {
  nombre: string;
  detalle: string;
  etiqueta: string;
  estilo: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{nombre}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </div>
      <Badge className={`pointer-events-none text-[10px] ${estilo}`}>
        <span>{etiqueta}</span>
      </Badge>
    </div>
  );
}
