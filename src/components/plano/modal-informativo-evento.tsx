"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { ExternalLink, LifeBuoy } from "lucide-react";
import { eventosServiceClient } from "@/lib/client/api/services/eventos-service";
import { LS_KEYS } from "@/lib/shared/constants";
import type { ModalInfoConfig } from "@/domain/models/entities";

interface Props {
  tipoEvento: number;
  codigoEvento: number;
}

/**
 * Modal informativo configurable por version de evento (ver /dashboard/eventos).
 * Se muestra una sola vez por sesion (sessionStorage) para no interrumpir al usuario.
 */
export function ModalInformativoEvento({ tipoEvento, codigoEvento }: Props) {
  const [config, setConfig] = useState<ModalInfoConfig | null>(null);
  const [abierto, setAbierto] = useState(false);

  const storageKey = useMemo(
    () => `${LS_KEYS.MODAL_INFO_VISTO}:${tipoEvento}-${codigoEvento}`,
    [tipoEvento, codigoEvento],
  );

  useEffect(() => {
    if (sessionStorage.getItem(storageKey)) return;
    let activo = true;
    eventosServiceClient
      .modalInfo(tipoEvento, codigoEvento)
      .then((cfg) => {
        if (!activo || !cfg?.activo) return;
        setConfig(cfg);
        setAbierto(true);
      })
      .catch(() => { /* silencioso: es informativo */ });
    return () => { activo = false; };
  }, [tipoEvento, codigoEvento, storageKey]);

  const cerrar = () => {
    sessionStorage.setItem(storageKey, "1");
    setAbierto(false);
  };

  if (!config) return null;

  return (
    <Dialog open={abierto} onOpenChange={(v) => { if (!v) cerrar(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-xl border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg text-primary"><span>{config.titulo}</span></DialogTitle>
          {config.subtitulo && (
            <p className="text-sm text-muted-foreground"><span>{config.subtitulo}</span></p>
          )}
        </DialogHeader>

        {config.items.length > 0 && (
          <ul className="space-y-3">
            {config.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  {item.titulo && (
                    <p className="text-sm font-semibold text-foreground"><span>{item.titulo}</span></p>
                  )}
                  {item.descripcion && (
                    <p className="text-xs leading-relaxed text-muted-foreground"><span>{item.descripcion}</span></p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {config.ayuda && (config.ayuda.titulo || config.ayuda.descripcion || config.ayuda.url) && (
          <div className="rounded-xl border border-border bg-secondary/50 p-4">
            <div className="mb-1.5 flex items-center gap-2 text-primary">
              <LifeBuoy className="h-4 w-4" />
              {config.ayuda.titulo && (
                <p className="text-sm font-semibold"><span>{config.ayuda.titulo}</span></p>
              )}
            </div>
            {config.ayuda.descripcion && (
              <p className="text-xs leading-relaxed text-muted-foreground"><span>{config.ayuda.descripcion}</span></p>
            )}
            {config.ayuda.url && config.ayuda.texto_boton && (
              <Button asChild variant="outline" size="sm" className="mt-3 gap-2">
                <a href={config.ayuda.url} target="_blank" rel="noreferrer">
                  <span>{config.ayuda.texto_boton}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={cerrar} className="w-full"><span>Entendido</span></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
