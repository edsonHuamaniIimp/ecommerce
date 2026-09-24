"use client";

import { useEffect, useState } from "react";
import { GessMantenedor } from "@/components/gess/gess-mantenedor";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { useSesion } from "@/hooks/use-sesion";
import { planosService } from "@/lib/client/api/services/planos-service";

const PLANO_POR_DEFECTO = "gess";

export default function VinculacionPage() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";
  const tipoEvento = session?.tipoEvento ?? 0;
  const codigoEvento = session?.codigoEvento ?? 0;
  const [plano, setPlano] = useState(PLANO_POR_DEFECTO);

  useEffect(() => {
    if (!eventoId || !tipoEvento || !codigoEvento) return;
    planosService
      .publico({ tipoEvento, codigoEvento, eventoId })
      .then((data) => { if (data?.codigo) setPlano(data.codigo); })
      .catch(() => { /* se mantiene el plano por defecto */ });
  }, [eventoId, tipoEvento, codigoEvento]);

  return (
    <PaginaDashboard
      titulo="Vinculacion de Stands"
      descripcion="Vincular datos del API externo con bloques del plano isometrico."
      cargando={cargando}
      tieneEvento={Boolean(eventoId)}
    >
      <GessMantenedor eventoId={eventoId} tipoEvento={tipoEvento} codigoEvento={codigoEvento} plano={plano} />
    </PaginaDashboard>
  );
}
