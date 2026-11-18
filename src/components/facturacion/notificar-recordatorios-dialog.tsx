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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { Bell, FileWarning, Info, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { facturacionService } from "@/lib/client/api/services/facturacion-service";
import { RECORDATORIOS_FACTURACION, type RecordatorioFacturacion } from "@/lib/shared/constants";
import { TIPOS_ARCHIVO_IIMP_LABELS } from "@/lib/shared/utils/requisitos-facturacion";
import { numberUtils } from "@/lib/shared/utils/number";
import type { EnviarRecordatoriosResultDTO } from "@/types/dto/facturacion/enviar-recordatorios-result.dto";
import type { RecordatorioCandidatoDTO } from "@/types/dto/facturacion/recordatorio-candidato.dto";
import type { RecordatoriosResponseDTO } from "@/types/dto/facturacion/recordatorios-response.dto";

/** Resultado del envio con los nombres de empresa resueltos para el resumen del modal. */
type ResultadoEnvio = EnviarRecordatoriosResultDTO & { nombres: Record<string, string> };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se invoca tras enviar correos, para refrescar la bandeja. */
  onEnviado?: () => void;
}

/**
 * Modal "Notificar" de la bandeja de Facturacion: lista las empresas con pagos
 * pendientes que aun no solicitaron su factura y las que declararon requisitos
 * sin subir sus documentos. El correo incluye el enlace al manual del cliente.
 */
export function NotificarRecordatoriosDialog({ open, onOpenChange, onEnviado }: Props) {
  const [data, setData] = useState<RecordatoriosResponseDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<RecordatorioFacturacion>(RECORDATORIOS_FACTURACION.SIN_SOLICITUD);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  /** Resumen del ultimo envio: se muestra dentro del modal al finalizar. */
  const [resultado, setResultado] = useState<ResultadoEnvio | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setData(await facturacionService.listarRecordatorios());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar las empresas");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    /* Se difiere al siguiente tick: el modal se monta antes de lanzar la carga. */
    const t = setTimeout(() => {
      setSelected(new Set());
      setTab(RECORDATORIOS_FACTURACION.SIN_SOLICITUD);
      setResultado(null);
      void cargar();
    }, 0);
    return () => clearTimeout(t);
  }, [open, cargar]);

  const lista: RecordatorioCandidatoDTO[] =
    tab === RECORDATORIOS_FACTURACION.SIN_SOLICITUD ? (data?.sinSolicitud ?? []) : (data?.documentosPendientes ?? []);

  const toggle = (candidato: RecordatorioCandidatoDTO) => {
    if (!candidato.email) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(candidato.facturacionId)) next.delete(candidato.facturacionId);
      else next.add(candidato.facturacionId);
      return next;
    });
  };

  const todosSeleccionados = lista.length > 0 && lista.every((c) => !c.email || selected.has(c.facturacionId));
  const toggleTodos = () => {
    const enviables = lista.filter((c) => Boolean(c.email)).map((c) => c.facturacionId);
    setSelected(todosSeleccionados ? new Set() : new Set(enviables));
  };

  const cambiarTab = (valor: string) => {
    setTab(valor as RecordatorioFacturacion);
    setSelected(new Set());
    setResultado(null);
  };

  const enviar = async () => {
    if (selected.size === 0 || sending) return;
    const nombres = Object.fromEntries(
      [...(data?.sinSolicitud ?? []), ...(data?.documentosPendientes ?? [])].map((c) => [
        c.facturacionId,
        c.empresa ?? c.standCode,
      ]),
    );
    setSending(true);
    try {
      const resultadoEnvio = await facturacionService.enviarRecordatorios({
        tipo: tab,
        facturacionIds: [...selected],
      });
      setResultado({ ...resultadoEnvio, nombres });
      setSelected(new Set());
      setData(await facturacionService.listarRecordatorios());
      onEnviado?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron enviar los recordatorios");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col !px-0 !py-0 sm:max-w-3xl">
        <div className="shrink-0 border-b border-border px-5 pb-3 pt-4 !pr-12">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-primary" />
              <span>Notificar a las empresas</span>
            </DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-xs text-muted-foreground">
            Envía un correo con los pasos y el enlace al{" "}
            <a href="/manual/facturacion" target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
              manual de facturación
            </a>
            .
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {resultado && (
            <div className={`mb-3 rounded-md border px-3 py-2 text-[11px] ${resultado.fallidos > 0 ? "border-warning/40 bg-warning/10" : "border-primary/30 bg-primary/5"}`}>
              <p className="font-semibold text-foreground">
                {resultado.enviados > 0
                  ? `${resultado.enviados} correo(s) enviado(s) correctamente.`
                  : "No se envió ningún correo."}
                {resultado.fallidos > 0 ? ` ${resultado.fallidos} no se pudo(ieron) enviar:` : ""}
              </p>
              {resultado.fallidos > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {resultado.detalle
                    .filter((detalle) => !detalle.ok)
                    .map((detalle) => (
                      <li key={detalle.facturacionId}>
                        {resultado.nombres[detalle.facturacionId] ?? detalle.facturacionId}: {detalle.error ?? "Error al enviar"}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
          <div className="mb-3 flex items-start gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
            <span>La lista se verifica contra el IIMP al abrir el modal y al enviar. No se notifica a empresas sin correo ni a las que ya regularizaron su situación.</span>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : (
            <Tabs value={tab} onValueChange={cambiarTab}>
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value={RECORDATORIOS_FACTURACION.SIN_SOLICITUD} className="text-[11px]">
                  <span>Sin solicitud de factura ({data?.sinSolicitud.length ?? 0})</span>
                </TabsTrigger>
                <TabsTrigger value={RECORDATORIOS_FACTURACION.DOCUMENTOS_PENDIENTES} className="text-[11px]">
                  <span>Documentos pendientes ({data?.documentosPendientes.length ?? 0})</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value={RECORDATORIOS_FACTURACION.SIN_SOLICITUD} className="pt-2">
                <ListaCandidatos
                  candidatos={lista}
                  tipo={RECORDATORIOS_FACTURACION.SIN_SOLICITUD}
                  selected={selected}
                  onToggle={toggle}
                  todosSeleccionados={todosSeleccionados}
                  onToggleTodos={toggleTodos}
                  vacio="No hay empresas pendientes de solicitar su factura."
                />
              </TabsContent>

              <TabsContent value={RECORDATORIOS_FACTURACION.DOCUMENTOS_PENDIENTES} className="pt-2">
                {(data?.noVerificados ?? 0) > 0 && (
                  <div className="mb-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-muted-foreground">
                    <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <span>{data?.noVerificados} empresa(s) no se pudieron verificar en el IIMP y no se muestran para evitar avisos incorrectos.</span>
                  </div>
                )}
                <ListaCandidatos
                  candidatos={lista}
                  tipo={RECORDATORIOS_FACTURACION.DOCUMENTOS_PENDIENTES}
                  selected={selected}
                  onToggle={toggle}
                  todosSeleccionados={todosSeleccionados}
                  onToggleTodos={toggleTodos}
                  vacio="No hay empresas con documentos declarados pendientes."
                />
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {selected.size} empresa(s) seleccionada(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={sending}>
              <span>Cancelar</span>
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { void enviar(); }} disabled={selected.size === 0 || sending}>
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>{sending ? "Enviando..." : `Notificar (${selected.size})`}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListaCandidatos({
  candidatos,
  tipo,
  selected,
  onToggle,
  todosSeleccionados,
  onToggleTodos,
  vacio,
}: {
  candidatos: RecordatorioCandidatoDTO[];
  tipo: RecordatorioFacturacion;
  selected: Set<string>;
  onToggle: (candidato: RecordatorioCandidatoDTO) => void;
  todosSeleccionados: boolean;
  onToggleTodos: () => void;
  vacio: string;
}) {
  if (candidatos.length === 0) {
    return <p className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">{vacio}</p>;
  }
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 px-1 text-[11px] font-medium text-muted-foreground">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={todosSeleccionados} onChange={onToggleTodos} />
        <span>Seleccionar todas las que tengan correo</span>
      </label>
      {candidatos.map((candidato) => {
        const marcado = selected.has(candidato.facturacionId);
        const sinCorreo = !candidato.email;
        return (
          <label
            key={candidato.facturacionId}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              marcado ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/30"
            } ${sinCorreo ? "cursor-not-allowed opacity-70" : ""}`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              checked={marcado}
              disabled={sinCorreo}
              onChange={() => onToggle(candidato)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="truncate text-xs font-semibold text-foreground">{candidato.empresa ?? "Sin razón social"}</span>
                <Badge variant="secondary" className="pointer-events-none text-[9px]">{candidato.standCode}</Badge>
              </div>
              <p className={`truncate text-[11px] ${sinCorreo ? "text-destructive" : "text-muted-foreground"}`}>
                {sinCorreo ? "Sin correo de facturación: no se puede notificar" : candidato.email}
              </p>
              {tipo === RECORDATORIOS_FACTURACION.DOCUMENTOS_PENDIENTES && candidato.faltantes.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="text-[10px] text-muted-foreground">Faltan:</span>
                  {candidato.faltantes.map((tipoDocumento) => (
                    <Badge key={tipoDocumento} className="pointer-events-none bg-warning/15 text-[9px] text-warning">
                      {TIPOS_ARCHIVO_IIMP_LABELS[tipoDocumento] ?? tipoDocumento}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-medium text-foreground">
                {numberUtils.monto(candidato.montoPendiente, candidato.moneda, { decimales: 2 })}
              </p>
              <p className="text-[10px] text-muted-foreground">{candidato.cuotasPendientes} cuota(s) pendiente(s)</p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
