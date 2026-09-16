import { NextResponse } from "next/server";
import { createRouter } from "@/lib/server/router";
import { services } from "@/lib/server/services";

export const { POST } = createRouter({
  POST: {
    fetch: async (req) => {
      const body = await req.json() as { tipoEvento?: number; codigoEvento?: number };
      if (!body.tipoEvento || !body.codigoEvento) {
        return NextResponse.json({ error: "tipoEvento y codigoEvento requeridos" }, { status: 400 });
      }
      const stands = await services.planogess.fetchStands(body.tipoEvento, body.codigoEvento);
      return NextResponse.json(stands);
    },
  },
});
