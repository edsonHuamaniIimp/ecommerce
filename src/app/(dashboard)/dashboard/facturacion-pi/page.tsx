"use client";

import { FacturacionView } from "@/components/facturacion/facturacion-view";

/** Facturacion de las solicitudes de pabellones internacionales (/dashboard/reservar-empresa). */
export default function FacturacionPiPage() {
  return <FacturacionView soloInternas />;
}
