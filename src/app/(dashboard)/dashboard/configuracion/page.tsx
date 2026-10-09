"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { configuracionService } from "@/lib/client/api/services/configuracion-service";

/** Configuracion publica del portal: enlaces y contactos del login/presala. */
export default function ConfiguracionPortalPage() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mesaAyudaEmail, setMesaAyudaEmail] = useState("");
  const [contactoEmail, setContactoEmail] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [reglamentoUrl, setReglamentoUrl] = useState("");

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
      await configuracionService.actualizarPortal({
        mesaAyudaEmail: mesaAyudaEmail.trim() || null,
        contactoEmail: contactoEmail.trim() || null,
        manualUrl: manualUrl.trim() || null,
        reglamentoUrl: reglamentoUrl.trim() || null,
      });
      toast.success("Configuracion del portal guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la configuracion");
    }
    setGuardando(false);
  };

  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
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
