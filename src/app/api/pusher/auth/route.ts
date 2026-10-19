import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { getPusher, canalStandEventos } from "@/lib/server/pusher";

interface AuthBody {
  socket_id?: string;
  channel_name?: string;
}

/**
 * Autoriza canales privados de Pusher. Solo el evento de la sesion puede
 * suscribirse; el cliente nunca recibe datos de otras empresas.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const pusher = getPusher();
  if (!pusher) return NextResponse.json({ error: "Pusher no configurado" }, { status: 503 });

  const contentType = request.headers.get("content-type") ?? "";
  let body: AuthBody = {};
  if (contentType.includes("application/json")) {
    body = (await request.json().catch(() => ({}))) as AuthBody;
  } else {
    const form = await request.formData().catch(() => null);
    body = {
      socket_id: String(form?.get("socket_id") ?? "") || undefined,
      channel_name: String(form?.get("channel_name") ?? "") || undefined,
    };
  }
  if (!body.socket_id || !body.channel_name) {
    return NextResponse.json({ error: "socket_id y channel_name requeridos" }, { status: 400 });
  }
  if (!session.eventoId || body.channel_name !== canalStandEventos(session.eventoId)) {
    return NextResponse.json({ error: "Canal no autorizado" }, { status: 403 });
  }

  return NextResponse.json(pusher.authorizeChannel(body.socket_id, body.channel_name));
}
