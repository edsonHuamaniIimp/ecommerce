"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  Textarea,
} from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, Eye, FileText, Loader2, Scale, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DdDocumentoBadge, DdReputacionBadge } from "./dd-estado-badge";
import { DdDocumentoPreviewDialog } from "./dd-documento-preview-dialog";
import { DdRadioIndicator } from "./dd-radio-indicator";
import { useConfirm } from "@/hooks/use-confirm";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import {
  BADGE_STYLES,
  DD_ACCIONES_LEGAL,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_REPUTACION_TIPOS,
  DD_REPUTACION_TIPO_LABELS,
  type DdAccionLegal,
} from "@/lib/shared/constants";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";
import { dateUtils } from "@/lib/shared/utils/date";
import type { DdBandejaRowDTO, DdExpedienteDTO, DdInformeLegalUploadResponseDTO } from "@/types/dto/debida-diligencia";

interface Props {
  fila: DdBandejaRowDTO;
  onClose: () => void;
  onDone: () => void;
}

export function DdLegalModal({ fila, onClose, onDone }: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const [detalle, setDetalle] = useState<DdExpedienteDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<DdAccionLegal>(DD_ACCIONES_LEGAL.APROBAR);
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

    const aprobar = decision === DD_ACCIONES_LEGAL.APROBAR;
    const ok = await confirm({
      title: aprobar ? "Aprobar debida diligencia" : "Rechazar debida diligencia",
      description: aprobar
        ? "Legal aprobará la revisión y el expediente volverá a Logística para la decisión final."
        : "Legal rechazará la debida diligencia y recién entonces se notificará al cliente.",
      confirmLabel: aprobar ? "Aprobar" : "Rechazar",
      destructive: !aprobar,
    });
    if (!ok) return;

    setGuardando(true);
    setError(null);
    try {
      await debidaDiligenciaService.resolverLegal({
        expedienteId: fila.id,
        decision,
        motivo: motivo.trim() || null,
        informeLegalNombre: informe?.nombre ?? null,
        informeLegalUrl: informe?.url ?? null,
      });
      toast.success(
        aprobar
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

  const reputacion = detalle?.reputacion ?? [];
  const documentos = detalle?.documentos ?? [];
  const requiereInforme = decision === DD_ACCIONES_LEGAL.RECHAZAR;
  const puedeGuardar =
    (!requiereInforme || Boolean(informe)) &&
    (!requiereInforme || motivo.trim().length > 0) &&
    !guardando &&
    !subiendo;

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border bg-card px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary" />
            <span>Revisión legal de debida diligencia</span>
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            {fila.empresa.razonSocial} · RUC {fila.empresa.ruc} · {fila.codigo}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : !detalle ? (
          <p className="p-8 text-center text-sm text-destructive">
            {error ?? "No se pudo cargar el expediente"}
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <section className="rounded-lg border border-warning/40 bg-warning/5 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                    Motivo de la derivación de Logística
                  </p>
                  <p className="mt-1 text-xs text-foreground">
                    {detalle.motivoRechazo || "Sin motivo registrado."}
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Derivado por {detalle.derivadoLegalPor ?? detalle.revisadoPor ?? "—"} el{" "}
                    {detalle.fechaDerivacionLegal
                      ? dateUtils.formatDateTime(detalle.fechaDerivacionLegal)
                      : "—"}
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Empresa y representante
                  </h3>
                  <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
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
                    Documentos
                  </h3>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {documentos.map((documento) => (
                      <div key={documento.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">
                            {DD_DOCUMENTOS_REQUERIDOS.find((d) => d.tipo === documento.tipo)?.titulo ?? documento.tipo}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">{documento.nombre}</p>
                          {documento.versiones.length > 0 ? (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[10px] font-semibold text-primary">
                                Versiones ({documento.versiones.length})
                              </summary>
                              <ul className="mt-1 space-y-1">
                                {documento.versiones.map((version) => (
                                  <li key={version.id} className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                    <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.NEUTRAL}`}>
                                      <span>v{version.version}</span>
                                    </Badge>
                                    <span className="max-w-[180px] truncate text-foreground" title={version.nombre}>
                                      {version.nombre}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {dateUtils.formatDateTime(version.createdAt)}
                                    </span>
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
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <DdDocumentoBadge estado={documento.estado} />
                          <a
                            href={documento.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-medium text-primary underline underline-offset-2"
                          >
                            Ver
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
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Revisión de Comunicaciones
                  </h3>
                  {reputacion.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                      Sin casos reputacionales derivados.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {reputacion.map((caso) => (
                        <div key={caso.id} className="rounded-lg border border-border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground">{caso.nombreARevisar}</p>
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
                            </div>
                            <DdReputacionBadge estado={caso.estado} />
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {caso.resultado ? `Resultado: ${caso.resultado}` : "Pendiente de resultado"}
                            {caso.comentario ? ` · ${caso.comentario}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Informe legal{" "}
                    {requiereInforme ? (
                      <span className="text-destructive">*</span>
                    ) : (
                      <span className="font-normal normal-case text-muted-foreground">(opcional)</span>
                    )}
                  </h3>
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Obligatorio para rechazar; opcional para aprobar. Formato PDF, máximo 10 MB.
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
                  {informe ? (
                    <p className="mt-2 break-all text-[10px] text-success">{informe.nombre}</p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                    {[
                      { value: DD_ACCIONES_LEGAL.APROBAR, label: "Aprobar", icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" /> },
                      { value: DD_ACCIONES_LEGAL.RECHAZAR, label: "Rechazar", icon: <XCircle className="h-3.5 w-3.5 text-destructive" /> },
                    ].map((opcion) => (
                      <label
                        key={opcion.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${decision === opcion.value ? "border-primary bg-secondary/30" : "border-border"}`}
                      >
                        <RadioGroupItem value={opcion.value} className="sr-only" />
                        <DdRadioIndicator selected={decision === opcion.value} />
                        {opcion.icon}
                        <span className="text-xs font-semibold text-foreground">{opcion.label}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  <div className="mt-3 space-y-1">
                    <Label className="text-xs">Comentario legal {decision === DD_ACCIONES_LEGAL.RECHAZAR ? <span className="text-destructive">*</span> : null}</Label>
                    <Textarea
                      value={motivo}
                      onChange={(e) => {
                        setMotivo(e.target.value);
                        setError(null);
                      }}
                      placeholder={
                        decision === DD_ACCIONES_LEGAL.RECHAZAR
                          ? "Motivo del rechazo legal (obligatorio)"
                          : "Comentario de la decisión legal"
                      }
                      className="min-h-24 text-sm"
                    />
                  </div>
                </div>

                {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

                <div className="space-y-2">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    disabled={!puedeGuardar}
                    onClick={() => void guardar()}
                  >
                    {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    <span>Guardar decisión legal</span>
                  </Button>
                  {requiereInforme && !informe ? (
                    <p className="text-[10px] text-warning">
                      Adjunta el informe legal para habilitar el rechazo.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={onClose}
                    disabled={guardando}
                  >
                    Cerrar
                  </Button>
                </div>
              </aside>
            </div>
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
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground">{children}</p>
    </div>
  );
}
