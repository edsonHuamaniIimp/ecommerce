import { configuracionController } from "@/controllers/configuracion.controller";

/** GET: publico (login/presala). POST: portal:manage. */
export async function GET() {
  return configuracionController.obtenerPortal();
}

export async function POST(request: Request) {
  return configuracionController.actualizarPortal(request);
}
