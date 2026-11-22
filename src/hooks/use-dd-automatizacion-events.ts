"use client";

import { useEffect, useRef } from "react";
import { DD_AUTOMATIZACION_EVENTO } from "@/lib/shared/constants";
import type { DdMatrizAutomatizacionDTO } from "@/types/dto/debida-diligencia";

/**
 * Escucha por Pusher (canal privado del usuario) el aviso de fin de una automatizacion
 * general de evidencias. Sin Pusher configurado no hace nada: el llamador sigue con polling.
 */
export function useDdAutomatizacionEvents(
  canal: string | null,
  onFinalizada: (job: DdMatrizAutomatizacionDTO) => void,
): void {
  const handlerRef = useRef(onFinalizada);

  useEffect(() => {
    handlerRef.current = onFinalizada;
  }, [onFinalizada]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!canal || !key || !cluster) return;

    let activo = true;
    let cliente: { disconnect: () => void } | null = null;

    void import("pusher-js")
      .then(({ default: Pusher }) => {
        if (!activo) return;
        const pusher = new Pusher(key, { cluster, forceTLS: true, authEndpoint: "/api/pusher/auth" });
        cliente = pusher;
        pusher
          .subscribe(canal)
          .bind(DD_AUTOMATIZACION_EVENTO, (data: DdMatrizAutomatizacionDTO) => handlerRef.current(data));
      })
      .catch((error) => {
        console.warn("[pusher] no se pudo inicializar el canal de automatizacion", error);
      });

    return () => {
      activo = false;
      cliente?.disconnect();
    };
  }, [canal]);
}
