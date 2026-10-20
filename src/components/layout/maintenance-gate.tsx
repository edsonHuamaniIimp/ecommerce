"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nrivera-iimp/ui-kit-iimp";
import { CalendarClock, Clock3, ShieldCheck, Wrench } from "lucide-react";
import { useSesion } from "@/hooks/use-sesion";
import { configuracionService } from "@/lib/client/api/services/configuracion-service";
import { ROLES } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import type { PortalConfigDTO } from "@/types/dto/configuracion/portal-config.dto";

const REFRESCO_MS = 10_000;

/** Aviso global de mantenimiento para los usuarios (el admin puede continuar). */
export function MaintenanceGate() {
  const pathname = usePathname();
  const { session, cargando, refrescar } = useSesion();
  const [config, setConfig] = useState<PortalConfigDTO | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [descartado, setDescartado] = useState(false);

  useEffect(() => {
    void refrescar();
  }, [pathname, refrescar]);

  useEffect(() => {
    let activo = true;

    const cargar = () => {
      configuracionService
        .obtenerPortal()
        .then((valor) => {
          if (!activo) return;
          setConfig(valor);
          if (!valor.mantenimientoActivo) setDescartado(false);
        })
        .catch(() => { /* el aviso no debe romper la plataforma */ });
    };

    cargar();
    const intervalo = window.setInterval(() => {
      cargar();
      setAhora(Date.now());
    }, REFRESCO_MS);

    return () => {
      activo = false;
      window.clearInterval(intervalo);
    };
  }, []);

  const esAdmin = session?.roles?.includes(ROLES.ADMIN) ?? false;
  const inicio = dateUtils.toMs(config?.mantenimientoInicio);
  const fin = dateUtils.toMs(config?.mantenimientoFin);
  const enVentana =
    Boolean(config?.mantenimientoActivo) &&
    (inicio === null || fin === null || (ahora >= inicio && ahora <= fin));
  /* El login queda fuera para que el administrador pueda autenticarse. */
  const enLogin = pathname.startsWith("/auth");
  const permiteCerrar = config?.mantenimientoPermiteCerrar ?? false;
  const puedeCerrar = permiteCerrar || esAdmin;
  const visible = !cargando && !enLogin && enVentana && !descartado;
  const ventana = dateUtils.formatDateTimeRangeLima(
    config?.mantenimientoInicio ?? null,
    config?.mantenimientoFin ?? null,
  );

  return (
    <Dialog
      open={visible}
      onOpenChange={(open) => {
        if (!open && puedeCerrar) setDescartado(true);
      }}
    >
      <DialogContent className={`sm:max-w-md ${puedeCerrar ? "" : "[&>button]:hidden"}`}>
        <DialogHeader className="space-y-3 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Estamos mejorando nuestro servicio
            </DialogTitle>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Estamos realizando una actualización programada para seguir ofreciéndote una
              plataforma más segura y estable.
            </p>
          </div>
        </DialogHeader>

        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4" aria-live="assertive">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <CalendarClock className="h-4 w-4 text-warning" />
            <span>Horario de regreso</span>
          </div>
          <p className="mt-2 flex items-start gap-2 text-sm font-medium text-foreground">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>{ventana ?? "Volveremos lo antes posible."}</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Gracias por tu paciencia. Estamos trabajando para volver pronto.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>Tu información está segura durante la actualización.</span>
        </div>

        {puedeCerrar ? (
          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            {permiteCerrar ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDescartado(true)}
              >
                <span>Entendido</span>
              </Button>
            ) : null}
            {esAdmin ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setDescartado(true)}
              >
                <span>Continuar como administrador</span>
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
