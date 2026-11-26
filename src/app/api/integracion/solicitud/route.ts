import { integracionSolicitudController } from "@/controllers/integracion-solicitud.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = integracionSolicitudController.consultar;
