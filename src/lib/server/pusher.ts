import "server-only";

import Pusher from "pusher";

let client: Pusher | null | undefined;

/** Cliente Pusher perezoso: sin credenciales el sistema sigue funcionando sin realtime. */
export function getPusher(): Pusher | null {
  if (client !== undefined) return client;
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!appId || !key || !secret || !cluster) {
    client = null;
    return client;
  }
  client = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return client;
}

/** Canal privado por evento: solo usuarios autenticados del evento pueden escucharlo. */
export function canalStandEventos(eventoId: string): string {
  return `private-evento-${eventoId}`;
}
