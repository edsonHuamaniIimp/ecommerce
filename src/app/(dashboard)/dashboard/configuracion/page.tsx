"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Skeleton, Switch } from "@nrivera-iimp/ui-kit-iimp";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { configuracionService } from "@/lib/client/api/services/configuracion-service";
import { invalidarPortalConfig } from "@/hooks/use-portal-config";
import {
  MAX_STANDS_RESERVA_DEFAULT,
  MAX_STANDS_RESERVA_LIMITE,
  MAX_STANDS_RESERVA_MIN,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";

/** Configuracion publica del portal: enlaces y contactos del login/presala. */
export default function ConfiguracionPortalPage() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mesaAyudaEmail, setMesaAyudaEmail] = useState("");
  const [contactoEmail, setContactoEmail] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [reglamentoUrl, setReglamentoUrl] = useState("");
  const [holdReservaMinutos, setHoldReservaMinutos] = useState("25");
  const [maxStandsReserva, setMaxStandsReserva] = useState(String(MAX_STANDS_RESERVA_DEFAULT));
  const [mantenimientoActivo, setMantenimientoActivo] = useState(false);
  const [mantenimientoInicio, setMantenimientoInicio] = useState("");
  const [mantenimientoFin, setMantenimientoFin] = useState("");
  const [mantenimientoPermiteCerrar, setMantenimientoPermiteCerrar] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const config = await configuracionService.obtenerPortal();
        if (!activo) return;
        setMesaAyudaEmail(config.mesaAyudaEmail ?? "");
        setContactoEmail(config.contactoEmail ?? "");
        setManualUrl(config.manualUrl ?? "");
        setReglamentoUrl(config.reglamentoUrl ?? "");
        setHoldReservaMinutos(String(config.holdReservaMinutos ?? 25));
        setMaxStandsReserva(String(config.maxStandsReserva ?? MAX_STANDS_RESERVA_DEFAULT));
        setMantenimientoActivo(Boolean(config.mantenimientoActivo));
        setMantenimientoInicio(dateUtils.toLimaDateTimeInput(config.mantenimientoInicio));
        setMantenimientoFin(dateUtils.toLimaDateTimeInput(config.mantenimientoFin));
        setMantenimientoPermiteCerrar(Boolean(config.mantenimientoPermiteCerrar));
      } catch {
        if (activo) toast.error("No se pudo cargar la configuracion");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, []);

  const guardar = async () => {
    setGuardando(true);
    try {
      const minutos = Number.parseInt(holdReservaMinutos, 10);
      if (!Number.isInteger(minutos) || minutos < 1 || minutos > 120) {
        toast.error("Los minutos de bloqueo deben estar entre 1 y 120");
        setGuardando(false);
        return;
      }
      const maxStands = Number.parseInt(maxStandsReserva, 10);
      if (
        !Number.isInteger(maxStands) ||
        maxStands < MAX_STANDS_RESERVA_MIN ||
        maxStands > MAX_STANDS_RESERVA_LIMITE
      ) {
        toast.error(
          `El máximo de stands debe estar entre ${MAX_STANDS_RESERVA_MIN} y ${MAX_STANDS_RESERVA_LIMITE}`,
        );
        setGuardando(false);
        return;
      }
      if (mantenimientoActivo) {
        if (!mantenimientoInicio || !mantenimientoFin) {
          toast.error("Indica la fecha de inicio y fin del mantenimiento");
          setGuardando(false);
          return;
        }
        if (!dateUtils.isBefore(mantenimientoInicio, mantenimientoFin)) {
          toast.error("La fecha de fin debe ser posterior a la de inicio");
          setGuardando(false);
          return;
        }
      }
      await configuracionService.actualizarPortal({
        mesaAyudaEmail: mesaAyudaEmail.trim() || null,
        contactoEmail: contactoEmail.trim() || null,
        manualUrl: manualUrl.trim() || null,
        reglamentoUrl: reglamentoUrl.trim() || null,
        holdReservaMinutos: minutos,
        maxStandsReserva: maxStands,
        mantenimientoActivo,
        mantenimientoInicio: dateUtils.fromLimaDateTimeInput(mantenimientoInicio),
        mantenimientoFin: dateUtils.fromLimaDateTimeInput(mantenimientoFin),
        mantenimientoPermiteCerrar,
      });
      invalidarPortalConfig();
      toast.success("Configuracion del portal guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la configuracion");
    }
    setGuardando(false);
  };

  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Configuración del portal</h1>
          <p className="text-sm text-muted-foreground">
            Administra los datos de contacto, enlaces y parámetros de reserva visibles para los clientes.
          </p>
        </div>

        {cargando ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : (
          <>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle><span>Contactos y enlaces</span></CardTitle>
                <p className="text-xs text-muted-foreground">
                  Datos que se muestran en el login y la presala.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Contactos</span>
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="mesa-ayuda"><span>Mesa de Ayuda (correo)</span></Label>
                      <Input
                        id="mesa-ayuda"
                        type="email"
                        placeholder="soporte@iimp.org.pe"
                        value={mesaAyudaEmail}
                        onChange={(e) => setMesaAyudaEmail(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contacto"><span>Contacto (correo)</span></Label>
                      <Input
                        id="contacto"
                        type="email"
                        placeholder="contacto@iimp.org.pe"
                        value={contactoEmail}
                        onChange={(e) => setContactoEmail(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Enlaces</span>
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="manual"><span>Manual del Exhibidor (URL)</span></Label>
                      <Input
                        id="manual"
                        placeholder="https://..."
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reglamento"><span>Reglamento de Stands (URL)</span></Label>
                      <Input
                        id="reglamento"
                        placeholder="https://..."
                        value={reglamentoUrl}
                        onChange={(e) => setReglamentoUrl(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Los correos se abren como mailto; las URLs se abren en una pestaña nueva.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardTitle><span>Parámetros de reserva</span></CardTitle>
                <p className="text-xs text-muted-foreground">
                  Reglas aplicadas al flujo de reserva del cliente.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="hold-minutos"><span>Minutos de bloqueo del stand</span></Label>
                    <Input
                      id="hold-minutos"
                      type="number"
                      min={1}
                      max={120}
                      value={holdReservaMinutos}
                      onChange={(e) => setHoldReservaMinutos(e.target.value)}
                      className="text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Tiempo que el stand queda bloqueado mientras el cliente completa la reserva (1 a 120 minutos).
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="max-stands"><span>Máximo de stands por reserva</span></Label>
                    <Input
                      id="max-stands"
                      type="number"
                      min={MAX_STANDS_RESERVA_MIN}
                      max={MAX_STANDS_RESERVA_LIMITE}
                      value={maxStandsReserva}
                      onChange={(e) => setMaxStandsReserva(e.target.value)}
                      className="text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Cantidad máxima de stands que un cliente puede solicitar al continuar con la reserva
                      ({MAX_STANDS_RESERVA_MIN} a {MAX_STANDS_RESERVA_LIMITE}).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle><span>Mantenimiento</span></CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Aviso temporal para los usuarios del portal.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {mantenimientoActivo ? "Activo" : "Inactivo"}
                    </span>
                    <Switch
                      id="mantenimiento-activo"
                      checked={mantenimientoActivo}
                      onCheckedChange={setMantenimientoActivo}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-[11px] text-muted-foreground">
                  Muestra un aviso durante la ventana configurada. Los administradores pueden seguir usando el sistema.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="mantenimiento-inicio"><span>Inicio</span></Label>
                    <Input
                      id="mantenimiento-inicio"
                      type="datetime-local"
                      value={mantenimientoInicio}
                      onChange={(e) => setMantenimientoInicio(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mantenimiento-fin"><span>Fin</span></Label>
                    <Input
                      id="mantenimiento-fin"
                      type="datetime-local"
                      value={mantenimientoFin}
                      onChange={(e) => setMantenimientoFin(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <div>
                    <Label htmlFor="mantenimiento-permite-cerrar"><span>Permitir cerrar el aviso</span></Label>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Si está desactivado, los usuarios no podrán cerrar el aviso hasta que termine la ventana.
                    </p>
                  </div>
                  <Switch
                    id="mantenimiento-permite-cerrar"
                    checked={mantenimientoPermiteCerrar}
                    onCheckedChange={setMantenimientoPermiteCerrar}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Si el modo está activo, la ventana debe tener inicio y fin. El aviso aparece en la plataforma durante ese rango.
                </p>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[11px] text-muted-foreground">
                Los cambios se aplican al guardar la configuración.
              </p>
              <Button size="sm" className="gap-1.5 text-xs" disabled={guardando} onClick={() => { void guardar(); }}>
                {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{guardando ? "Guardando..." : "Guardar"}</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
