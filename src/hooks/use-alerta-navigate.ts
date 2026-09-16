"use client";

import { useEffect } from "react";
import { solicitudesService } from "@/lib/client/api/services/solicitudes-service";

type ModalOpener = (row: Record<string, unknown>) => void;

export function useAlertaNavigate(path: string, onOpen: ModalOpener) {
  useEffect(() => {
    const handler = (e: Event) => {
      const { path: eventPath, id } = (e as CustomEvent).detail as { path: string; id: string | null };
      if (eventPath === path && id) {
        solicitudesService.detalle(id).then((row) => {
          if (row) onOpen(row as unknown as Record<string, unknown>);
        }).catch(() => {});
      }
    };
    window.addEventListener("alerta:navigate", handler);
    return () => window.removeEventListener("alerta:navigate", handler);
  }, [path, onOpen]);
}
