"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@nrivera-iimp/ui-kit-iimp";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
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
      <DialogContent className="rounded-xl border-border sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span>Documentos de la cuenta corriente{standCode ? ` · ${standCode}` : ""}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            <span>
              Adjunta los links de la orden de compra (OC), la hoja de entrada de servicio (HES) y las
              constancias de pago de detracción y de la diferencia. Se registran en tu cuenta corriente
              del IIMP (puedes agregar varios de cada tipo). Si la cuota supera S/ 700 (convertir si la
              cuota está en USD) aplica la detracción SPOT: registra la diferencia y la detracción en
              cualquier orden; la detracción puede pagarse hasta 1 mes después.
            </span>
          </p>

          <FormArchivoIImp
            cuotas={cuotas}
            cuotaInicial={cuotaNumero}
            archivosRegistrados={archivos}
            onAgregar={(a) => { void agregar(a); }}
            botonLabel={agregando ? "Agregando..." : "Agregar"}
          />

          {cargando ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Cargando documentos...</span>
            </p>
          ) : archivos.length === 0 ? (
            <p className="text-xs text-muted-foreground"><span>Sin documentos registrados en la cuenta corriente.</span></p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><span>Tipo</span></TableHead>
                    <TableHead><span>Cuota</span></TableHead>
                    <TableHead><span>Nombre</span></TableHead>
                    <TableHead><span>Registrado</span></TableHead>
                    <TableHead className="text-right"><span>Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivos.map((a) => (
                    <TableRow key={a.item}>
                      <TableCell className="text-xs"><Badge className="pointer-events-none">{TIPOS_ARCHIVO_LABELS[a.tipo] ?? a.tipo}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.cuota ?? "—"}</TableCell>
                      <TableCell className="text-xs">{a.nombre ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{dateUtils.format(a.fecha)}</TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild title="Abrir documento">
                            <a href={a.link} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Quitar documento" onClick={() => { void eliminar(a.item); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}
