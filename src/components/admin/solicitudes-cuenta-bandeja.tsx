"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Check, Clock, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { solicitudCuentaService } from "@/lib/client/api/services/solicitud-cuenta-service";
import { BADGE_STYLES, ESTADOS_SOLICITUD_CUENTA, FILTRO_TODOS } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import type { SolicitudCuentaDTO } from "@/types/dto/solicitud-cuenta/solicitud-cuenta.dto";

const ESTADO_OPCIONES = [
  { valor: ESTADOS_SOLICITUD_CUENTA.PENDIENTE, etiqueta: "Pendientes" },
  { valor: ESTADOS_SOLICITUD_CUENTA.APROBADA, etiqueta: "Aprobadas" },
  { valor: ESTADOS_SOLICITUD_CUENTA.RECHAZADA, etiqueta: "Rechazadas" },
  { valor: FILTRO_TODOS, etiqueta: "Todas" },
] as const;

function BadgeEstado({ estado }: { estado: string }) {
  if (estado === ESTADOS_SOLICITUD_CUENTA.APROBADA) {
    return <Badge className={`pointer-events-none ${BADGE_STYLES.SUCCESS}`}><span>Aprobada</span></Badge>;
  }
  if (estado === ESTADOS_SOLICITUD_CUENTA.RECHAZADA) {
    return <Badge className={`pointer-events-none ${BADGE_STYLES.DESTRUCTIVE}`}><span>Rechazada</span></Badge>;
  }
  return <Badge className={`pointer-events-none ${BADGE_STYLES.WARNING}`}><span>Pendiente</span></Badge>;
}

export function SolicitudesCuentaBandeja({ initialSolicitudes }: { initialSolicitudes: SolicitudCuentaDTO[] }) {
  const [solicitudes, setSolicitudes] = useState(initialSolicitudes);
  const [filtro, setFiltro] = useState<string>(ESTADOS_SOLICITUD_CUENTA.PENDIENTE);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [rechazo, setRechazo] = useState<SolicitudCuentaDTO | null>(null);
  const [motivo, setMotivo] = useState("");

  const pendientes = solicitudes.filter((s) => s.estado === ESTADOS_SOLICITUD_CUENTA.PENDIENTE).length;
  const visibles = useMemo(
    () => (filtro === FILTRO_TODOS ? solicitudes : solicitudes.filter((s) => s.estado === filtro)),
    [solicitudes, filtro],
  );

  const refrescar = async () => {
    const { solicitudes: nuevas } = await solicitudCuentaService.listar();
    setSolicitudes(nuevas);
  };

  const aprobar = async (solicitud: SolicitudCuentaDTO) => {
    setProcesando(solicitud.id);
    try {
      const result = await solicitudCuentaService.revisar({
        id: solicitud.id,
        estado: ESTADOS_SOLICITUD_CUENTA.APROBADA,
      });
      toast.success(result.message);
      await refrescar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo aprobar la solicitud");
    } finally {
      setProcesando(null);
    }
  };

  const confirmarRechazo = async () => {
    if (!rechazo) return;
    if (!motivo.trim()) {
      toast.error("Indica el motivo del rechazo");
      return;
    }
    setProcesando(rechazo.id);
    try {
      const result = await solicitudCuentaService.revisar({
        id: rechazo.id,
        estado: ESTADOS_SOLICITUD_CUENTA.RECHAZADA,
        motivoRechazo: motivo.trim(),
      });
      toast.success(result.message);
      setRechazo(null);
      setMotivo("");
      await refrescar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo rechazar la solicitud");
    } finally {
      setProcesando(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span>Solicitudes de cuenta</span>
            {pendientes > 0 && (
              <Badge className="pointer-events-none border-transparent bg-warning/10 text-warning"><span>{pendientes} pendientes</span></Badge>
            )}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Exhibidores que solicitaron acceso desde el portal. Al aprobar se habilita la cuenta y se envia la invitacion.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADO_OPCIONES.map((o) => (
                <SelectItem key={o.valor} value={o.valor}><span>{o.etiqueta}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={refrescar}>
            <RotateCw className="h-3.5 w-3.5" /><span>Actualizar</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {visibles.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No hay solicitudes en este estado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase">Solicitante</TableHead>
                  <TableHead className="hidden text-[10px] uppercase md:table-cell">Empresa</TableHead>
                  <TableHead className="hidden text-[10px] uppercase lg:table-cell">Contacto</TableHead>
                  <TableHead className="hidden text-[10px] uppercase sm:table-cell">Fecha</TableHead>
                  <TableHead className="text-[10px] uppercase">Estado</TableHead>
                  <TableHead className="text-right text-[10px] uppercase">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-[220px]">
                      <div className="flex flex-col">
                        <span className="truncate text-sm font-medium">{s.nombre} {s.apellidos}</span>
                        <span className="truncate text-xs text-muted-foreground">{s.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-[200px] md:table-cell">
                      <div className="flex flex-col">
                        <span className="truncate text-sm">{s.razonSocial}</span>
                        {s.ruc && <span className="text-xs text-muted-foreground">RUC {s.ruc}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground lg:table-cell">
                      {s.telefono ?? "—"}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">
                      {dateUtils.format(s.createdAt)}
                    </TableCell>
                    <TableCell>
                      <BadgeEstado estado={s.estado} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        {s.estado === ESTADOS_SOLICITUD_CUENTA.PENDIENTE ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 p-0 text-success hover:bg-success/10"
                              title="Aprobar"
                              disabled={procesando === s.id}
                              onClick={() => aprobar(s)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                              title="Rechazar"
                              disabled={procesando === s.id}
                              onClick={() => { setRechazo(s); setMotivo(""); }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {s.revisadoEn ? dateUtils.format(s.revisadoEn) : "—"}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={rechazo !== null} onOpenChange={(open) => { if (!open) setRechazo(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle><span>Rechazar solicitud</span></DialogTitle>
            <DialogDescription>
              <span>
                {rechazo ? `${rechazo.nombre} ${rechazo.apellidos} — ${rechazo.razonSocial}` : ""}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label htmlFor="motivo-rechazo" className="text-xs font-semibold tracking-wide text-primary">
              <span>Motivo del rechazo</span>
            </label>
            <Textarea
              id="motivo-rechazo"
              rows={3}
              maxLength={2000}
              placeholder="Explica brevemente el motivo. Se enviara por correo al solicitante."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazo(null)} disabled={procesando !== null}>
              <span>Cancelar</span>
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmarRechazo}
              disabled={procesando !== null}
            >
              <span>{procesando ? "Rechazando..." : "Rechazar solicitud"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
