"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@nrivera-iimp/ui-kit-iimp";
import { CheckCircle2, Clock, Eye, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DdDocumentoDTO, DdExpedienteDTO } from "@/types/dto/debida-diligencia";
import { DdDocumentoBadge } from "./dd-estado-badge";
import { DdDocumentoPreviewDialog } from "./dd-documento-preview-dialog";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import {
  DD_DOCUMENTOS,
  DD_DOCUMENTOS_REQUERIDOS,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";

interface Props {
  expedienteId: string | null;
  onClose: () => void;
}

function DocumentoFila({
  documento,
  titulo,
  obligatorio,
  onPreview,
}: {
  documento: DdDocumentoDTO | undefined;
  titulo: string;
  obligatorio: boolean;
  onPreview: (documento: { url: string; nombre: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs font-semibold text-foreground">{titulo}</p>
          {documento ? <DdDocumentoBadge estado={documento.estado} /> : (
            <Badge className="pointer-events-none text-[10px] border-amber-200 bg-amber-50 text-amber-800">
              <span>Pendiente</span>
            </Badge>
          )}
          {!obligatorio ? <Badge className="pointer-events-none text-[9px]"><span>Opcional</span></Badge> : null}
        </div>
        {documento ? (
          <>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{documento.nombre}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Actualizado {dateUtils.format(documento.updatedAt)}
              {documento.versiones.length > 0 ? ` · ${documento.versiones.length} versión(es)` : ""}
            </p>
            {documento.observacion ? (
              <p className="mt-1 text-[11px] font-medium text-amber-700">{documento.observacion}</p>
            ) : null}
            {documento.versiones.length > 0 ? (
              <details className="mt-2 rounded-md border border-border/70 bg-secondary/20 px-2 py-1.5">
                <summary className="cursor-pointer text-[10px] font-semibold text-primary">
                  Versiones ({documento.versiones.length})
                </summary>
                <ul className="mt-1 space-y-1">
                  {documento.versiones.map((version) => (
                    <li key={version.id} className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="font-semibold text-foreground">v{version.version}</span>
                      <span className="truncate text-muted-foreground">{version.nombre}</span>
                      <span className="text-muted-foreground">{dateUtils.format(version.createdAt)}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-[10px]" onClick={() => onPreview({ url: version.url, nombre: version.nombre })}>
                        Ver
                      </Button>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {obligatorio ? "Documento obligatorio aún no cargado." : "Documento opcional no cargado."}
          </p>
        )}
      </div>
      {documento ? (
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs" onClick={() => onPreview({ url: documento.url, nombre: documento.nombre })}>
          <Eye className="h-3.5 w-3.5" /><span>Ver documento</span>
        </Button>
      ) : null}
    </div>
  );
}

/** Documentos base del expediente, compartidos por todas las relaciones comerciales. */
export function DdDocumentosBaseDialog({ expedienteId, onClose }: Props) {
  const [expediente, setExpediente] = useState<DdExpedienteDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; nombre: string } | null>(null);

  const cargar = useCallback(async () => {
    if (!expedienteId) return;
    setLoading(true);
    try {
      setExpediente(await debidaDiligenciaService.detalle(expedienteId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los documentos base");
    } finally {
      setLoading(false);
    }
  }, [expedienteId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (expedienteId) void cargar();
  }, [cargar, expedienteId]);

  const documentos = expediente?.documentos ?? [];
  const buscar = (tipo: string): DdDocumentoDTO | undefined => documentos.find((documento) => documento.tipo === tipo);
  const cargados = DD_DOCUMENTOS_REQUERIDOS.filter((requisito) => Boolean(buscar(requisito.tipo))).length;

  return (
    <>
      <Dialog open={Boolean(expedienteId)} onOpenChange={(abierto) => { if (!abierto) onClose(); }}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              <span>Documentos base del expediente</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Documentación de la empresa compartida por todas sus relaciones comerciales.
            </p>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
            ) : !expediente ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No se encontró el expediente.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {cargados === DD_DOCUMENTOS_REQUERIDOS.length ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
                    <span className="text-xs font-semibold text-foreground">
                      {cargados}/{DD_DOCUMENTOS_REQUERIDOS.length} documentos obligatorios cargados
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{expediente.codigo}</span>
                </div>

                <div className="space-y-2">
                  {DD_DOCUMENTOS_REQUERIDOS.map((requisito) => (
                    <DocumentoFila
                      key={requisito.tipo}
                      documento={buscar(requisito.tipo)}
                      titulo={requisito.titulo}
                      obligatorio
                      onPreview={setPreview}
                    />
                  ))}
                  <DocumentoFila documento={buscar(DD_DOCUMENTOS.DECLARACION_VIGENCIA)} titulo="Declaración jurada de vigencia" obligatorio={false} onPreview={setPreview} />
                  <DocumentoFila documento={buscar(DD_DOCUMENTOS.ADICIONAL)} titulo="Documento adicional" obligatorio={false} onPreview={setPreview} />
                </div>

                <div className="rounded-lg border border-border bg-secondary/20 p-3">
                  <p className="text-[11px] text-muted-foreground">
                    Los documentos base se gestionan una sola vez por empresa. Las evidencias de matriz se cargan
                    por relación comercial y criterio desde la evaluación del vínculo.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex shrink-0 justify-end border-t border-border px-5 py-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              <span>Cerrar</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DdDocumentoPreviewDialog documento={preview} onClose={() => setPreview(null)} />
    </>
  );
}
