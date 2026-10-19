"use client";

import { useEffect, useRef } from "react";

export interface StandReservedEvent {
  standIds: string[];
  standCodes: string[];
}

export interface StandHeldEvent extends StandReservedEvent {
  holdId: string;
  expiresAt: string;
}

export interface StandReleasedEvent extends StandReservedEvent {
  holdId: string;
}

export interface StandEventHandlers {
  onReserved: (event: StandReservedEvent) => void;
  onHeld?: (event: StandHeldEvent) => void;
  onReleased?: (event: StandReleasedEvent) => void;
}

/**
 * Suscripcion a cambios de disponibilidad de un evento.
 * Si Pusher no esta configurado, el mapa sigue funcionando con su polling normal.
 */
export function useStandEvents(eventoId: string | null, handlers: StandEventHandlers): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!eventoId || !key || !cluster) return;

    let activo = true;
    let cliente: { disconnect: () => void } | null = null;

    void import("pusher-js").then(({ default: Pusher }) => {
      if (!activo) return;
      const pusher = new Pusher(key, {
        cluster,
        forceTLS: true,
        authEndpoint: "/api/pusher/auth",
      });
      cliente = pusher;
      const canal = pusher.subscribe(`private-evento-${eventoId}`);
      canal.bind("stand-reserved", (data: StandReservedEvent) => handlersRef.current.onReserved(data));
      canal.bind("stand-held", (data: StandHeldEvent) => handlersRef.current.onHeld?.(data));
      canal.bind("stand-released", (data: StandReleasedEvent) => handlersRef.current.onReleased?.(data));
    }).catch((error) => {
      console.warn("[pusher] no se pudo inicializar el canal de stands", error);
    });

    return () => {
      activo = false;
      cliente?.disconnect();
    };
  }, [eventoId]);
}
