"use client";

import { useEffect, useState } from "react";
import { GessMantenedor } from "@/components/gess/gess-mantenedor";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { useSesion } from "@/hooks/use-sesion";
import { planosService } from "@/lib/client/api/services/planos-service";
import { eventosServiceClient } from "@/lib/client/api/services/eventos-service";

const PLANO_POR_DEFECTO = "gess";

/** Version de evento seleccionada (fuente de TipEvCod/EvenCod para el API de stands). */
interface VersionEvento {
  tipoEvento: number;
  codigoEvento: number;
  nombre: string;
}

export default function VinculacionPage() {
  const { session, cargando } = useSesion();
  const eventoId = session?.eventoId ?? "";
  const [version, setVersion] = useState<VersionEvento | null>(null);
  const [plano, setPlano] = useState(PLANO_POR_DEFECTO);

  /*
   * Resuelve la version del evento desde la API de eventos: de ahi salen los parametros
   * TipEvCod/EvenCod que se envian al API de stands (liststand).
   */
  useEffect(() => {
    if (!eventoId) return;
    let activo = true;
    eventosServiceClient
      .obtener(eventoId)
      .then((ev) => {
        if (!activo) return;
        const padre = ev.eventoPadre as { nombre?: string } | undefined;
        setVersion({
          tipoEvento: Number(ev.tipoEvento ?? session?.tipoEvento ?? 0),
          codigoEvento: Number(ev.codigoEvento ?? session?.codigoEvento ?? 0),
          nombre: `${padre?.nombre ?? ev.eventoPadreId ?? ""} ${ev.anio ?? ""}`.trim(),
        });
      })
      .catch(() => {
        if (!activo) return;
        setVersion({
          tipoEvento: session?.tipoEvento ?? 0,
          codigoEvento: session?.codigoEvento ?? 0,
          nombre: session?.eventoNombre ?? "",
        });
      });
    return () => { activo = false; };
  }, [eventoId, session?.tipoEvento, session?.codigoEvento, session?.eventoNombre]);

  const tipoEvento = version?.tipoEvento ?? 0;
  const codigoEvento = version?.codigoEvento ?? 0;
  const versionLista = Boolean(eventoId && tipoEvento > 0 && codigoEvento > 0);

  useEffect(() => {
    if (!versionLista) return;
    planosService
      .publico({ tipoEvento, codigoEvento, eventoId })
      .then((data) => { if (data?.codigo) setPlano(data.codigo); })
      .catch(() => { /* se mantiene el plano por defecto */ });
  }, [eventoId, tipoEvento, codigoEvento, versionLista]);

  return (
    <PaginaDashboard
      titulo="Vinculacion de Stands"
      descripcion={
        version?.nombre
          ? `Evento version: ${version.nombre} (TipEvCod ${tipoEvento} / EvenCod ${codigoEvento}) — vincular stands del API con bloques del plano.`
          : "Vincular datos del API externo con bloques del plano isometrico."
      }
      cargando={cargando}
      tieneEvento={versionLista}
    >
      {versionLista && (
        <GessMantenedor eventoId={eventoId} tipoEvento={tipoEvento} codigoEvento={codigoEvento} plano={plano} />
      )}
    </PaginaDashboard>
  );
}
