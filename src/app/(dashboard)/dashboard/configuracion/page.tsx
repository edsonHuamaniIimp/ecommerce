"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Skeleton, Switch } from "@nrivera-iimp/ui-kit-iimp";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { configuracionService } from "@/lib/client/api/services/configuracion-service";
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
        mantenimientoActivo,
        mantenimientoInicio: dateUtils.fromLimaDateTimeInput(mantenimientoInicio),
        mantenimientoFin: dateUtils.fromLimaDateTimeInput(mantenimientoFin),
        mantenimientoPermiteCerrar,
      });
      toast.success("Configuracion del portal guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la configuracion");
    }
    setGuardando(false);
  };

  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configuracion del portal</h1>
          <p className="text-sm text-muted-foreground">
            Enlaces y contactos que se muestran en el login y la presala. Si un campo queda vacio,
            el enlace no se muestra (nada de links muertos).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle><span>Contactos y enlaces</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cargando ? (
              <Skeleton className="h-44 w-full rounded-xl" />
            ) : (
              <>
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
                <div className="max-w-xs space-y-1.5">
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
                <div className="space-y-4 rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Label htmlFor="mantenimiento-activo" className="flex items-center gap-2">
                        <span>Modo mantenimiento</span>
                      </Label>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Muestra un aviso a los usuarios durante la ventana configurada. Los administradores pueden seguir usando el sistema.
                      </p>
                    </div>
                    <Switch
                      id="mantenimiento-activo"
                      checked={mantenimientoActivo}
                      onCheckedChange={setMantenimientoActivo}
                    />
                  </div>
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
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Los correos se abren como mailto; las URLs se abren en una pestaña nueva.
                </p>
                <div className="flex justify-end">
                  <Button size="sm" className="gap-1.5 text-xs" disabled={guardando} onClick={() => { void guardar(); }}>
                    {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    <span>{guardando ? "Guardando..." : "Guardar"}</span>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
