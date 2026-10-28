"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge, Button, Dialog, DialogContent, Skeleton,
} from "@nrivera-iimp/ui-kit-iimp";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { pagosService, type ArchivoCuentaDTO, type ArchivoIImpInputDTO } from "@/lib/client/api/services/pagos-service";
import { useConfirm } from "@/hooks/use-confirm";
import { dateUtils } from "@/lib/shared/utils/date";
import { FormArchivoIImp, TIPOS_ARCHIVO_LABELS } from "./form-archivo-iimp";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cuota propia del cliente: el backend resuelve con ella la cuenta corriente del IIMP. */
  cuotaId: string;
  /** Numero de cuotas de la cuenta: valida el rango localmente. */
  cuotas: number;
  standCode?: string;
  /** Cuota desde la que se abrio el panel: preselecciona el input de cuota del formulario. */
  cuotaNumero?: number;
}

/** Documentos (links) de la cuenta corriente del IIMP: OC, HES, detracción y diferencia. */
export function ArchivosCuentaCorriente({ open, onOpenChange, cuotaId, cuotas, standCode, cuotaNumero }: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const [archivos, setArchivos] = useState<ArchivoCuentaDTO[]>([]);
  const [cargando, setCargando] = useState(false);
  const [agregando, setAgregando] = useState(false);

  const cargar = useCallback(async () => {
    if (!cuotaId) return;
    setCargando(true);
    try {
      setArchivos((await pagosService.listarArchivos(cuotaId)) ?? []);
    } catch (err) {
      setArchivos([]);
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los documentos");
    }
    setCargando(false);
  }, [cuotaId]);

  useEffect(() => {
    if (!open) return;
    void (async () => { await cargar(); })();
  }, [open, cargar]);

  const agregar = async (archivo: ArchivoIImpInputDTO) => {
    if (!cuotaId) return;
    setAgregando(true);
    try {
      setArchivos(await pagosService.agregarArchivo({ cuotaId, ...archivo }));
      toast.success("Documento agregado a la cuenta corriente del IIMP");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar el documento");
    } finally {
      setAgregando(false);
    }
  };

  const eliminar = async (item: number) => {
    const ok = await confirm({
      title: "Quitar documento",
      description: "Se quitara de la cuenta corriente del IIMP. Esta accion no se puede deshacer.",
      confirmLabel: "Quitar",
      destructive: true,
    });
    if (!ok) return;
    try {
      setArchivos(await pagosService.eliminarArchivo({ cuotaId, item }));
      toast.success("Documento quitado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo quitar el documento");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden rounded-xl border-border !px-0 !py-0 sm:max-w-5xl">
        {/* Header fijo */}
        <div className="shrink-0 border-b border-border !pr-12 px-5 pb-3 pt-4">
          <h3 className="text-sm font-semibold text-foreground">
            Documentos para tu factura{standCode ? ` · ${standCode}` : ""}
          </h3>
        </div>

        {/* Body: formulario (70%) + bandeja (30%); en desktop cada columna scrollea sola */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 lg:overflow-hidden">
          <div className="grid grid-cols-1 gap-5 lg:h-full lg:min-h-0 lg:grid-cols-[65fr_35fr]">
            {/* Formulario */}
            <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              <p className="text-xs text-muted-foreground">
                <span>
                  Sube los documentos que respaldan tu compra y tus pagos: orden de compra (OC), hoja de
                  entrada de servicio (HES) y constancias de pago (detracción o del saldo de la cuota).
                  Se registran en tu cuenta del IIMP y el área de facturación los revisa para emitir tu
                  factura. Puedes subir varios documentos de cada tipo. Si tu cuota supera S/ 700 aplica la
                  detracción SPOT: puedes subir la constancia de detracción y la del saldo en cualquier
                  orden (la detracción, hasta 1 mes después).
                </span>
              </p>

              <FormArchivoIImp
                cuotas={cuotas}
                cuotaInicial={cuotaNumero}
                archivosRegistrados={archivos}
                onAgregar={(a) => { void agregar(a); }}
                botonLabel={agregando ? "Agregando..." : "Agregar a la bandeja"}
              />
            </div>

            {/* Bandeja de documentos (scroll propio con muchos documentos) */}
            <div className="space-y-2 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Documentos subidos ({archivos.length})
              </p>
              {cargando ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              ) : archivos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center">
                  <p className="text-xs text-muted-foreground"><span>Sin documentos registrados.</span></p>
                  <p className="text-[10px] text-muted-foreground"><span>Los documentos que agregues aparecerán aquí.</span></p>
                </div>
              ) : (
                <div className="space-y-2">
                  {archivos.map((a) => (
                    <div key={a.item} className="rounded-lg border border-border p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className="pointer-events-none max-w-full truncate text-[9px]">{TIPOS_ARCHIVO_LABELS[a.tipo] ?? a.tipo}</Badge>
                        {a.cuota ? <span className="shrink-0 text-[10px] text-muted-foreground">Cuota {a.cuota}</span> : null}
                      </div>
                      <p className="mt-1 truncate text-xs font-medium text-foreground" title={a.nombre ?? a.link}>{a.nombre ?? a.link}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="text-[10px] text-muted-foreground">{dateUtils.format(a.fecha)}</span>
                        <span className="flex items-center gap-0.5">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild title="Abrir documento">
                            <a href={a.link} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Quitar documento" onClick={() => { void eliminar(a.item); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}
