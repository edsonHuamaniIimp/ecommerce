"use client";

import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { Headset, Mail, Phone } from "lucide-react";
import { usePortalConfig } from "@/hooks/use-portal-config";

/** Boton "Contacto": abre el modal con los correos y telefonos de Facturacion y Cobranzas. */
export function ContactoFacturacionButton() {
  const config = usePortalConfig();
  const [open, setOpen] = useState(false);
  const correos = config.facturacionEmails;
  const telefonos = config.facturacionTelefonos;
  const vacio = correos.length === 0 && telefonos.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Headset className="h-3.5 w-3.5" />
          <span>Contacto</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle><span>Contacto de facturación</span></DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Facturación y Cobranzas del IIMP. Escríbenos o llámanos para consultas sobre tus
          comprobantes y pagos.
        </p>

        {vacio ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            Aún no hay datos de contacto configurados.
          </p>
        ) : (
          <div className="space-y-4">
            {correos.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Correos</p>
                {correos.map((correo) => (
                  <a key={correo} href={`mailto:${correo}`} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted/40">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{correo}</span>
                  </a>
                ))}
              </div>
            )}
            {telefonos.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Teléfonos</p>
                {telefonos.map((telefono) => (
                  <a key={telefono} href={`tel:${telefono.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted/40">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{telefono}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            <span>Cerrar</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
