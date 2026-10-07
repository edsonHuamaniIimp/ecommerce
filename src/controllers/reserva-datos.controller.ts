import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success } from "@/lib/server/api-response";
import { getSession } from "@/lib/server/auth";

export const reservaDatosController = {
  /**
   * GET /api/reserva-datos/prellenar?tipoDocumento=&numeroDocumento=
   * Prellena el paso "Tus datos" del wizard con los datos internos del propio
   * usuario logueado (nunca de terceros); {} si no hay coincidencia o sesion.
   */
  async prellenar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return success({});

    const params = new URL(request.url).searchParams;
    const tipoDocumento = (params.get("tipoDocumento") ?? "").trim();
    const numeroDocumento = (params.get("numeroDocumento") ?? "").trim();
    if (!tipoDocumento || !numeroDocumento) return success({});

    return success(await services.prellenadoReserva.prellenar(session.email, tipoDocumento, numeroDocumento));
  },
};
