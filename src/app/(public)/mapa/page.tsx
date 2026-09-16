"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanoDinamico } from "@/components/plano/plano-dinamico";
import { MacroMapaView } from "@/components/plano/macro-mapa-view";
import { Card, CardContent, Button } from "@nrivera-iimp/ui-kit-iimp";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { LS_KEYS, TIPOS_PLANO } from "@/lib/shared/constants";
import { authService } from "@/lib/client/api/services/auth-service";
import { planosService } from "@/lib/client/api/services/planos-service";
import type { PlanoPublicoPayloadDTO } from "@/types/dto/planos/planos-response.dto";

function MapaDinamicoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [payload, setPayload] = useState<PlanoPublicoPayloadDTO | null>(null);
  const [eventoParams, setEventoParams] = useState<{ tipoEvento: number; codigoEvento: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const openReserva = searchParams.get("openReserva") === "1";
  const codigoParam = searchParams.get("codigo");
  const parentParam = searchParams.get("parent");

  useEffect(() => {
    (async () => {
      const raw = localStorage.getItem(LS_KEYS.EVENTO_PUBLICO);
      let eid: string | null = null;
      let te: number | undefined;
      let ce: number | undefined;

      if (raw) {
        try {
          const pub = JSON.parse(raw) as { eventoId: string; tipoEvento?: number; codigoEvento?: number };
          eid = pub.eventoId; te = pub.tipoEvento; ce = pub.codigoEvento;
        } catch { /* ignore */ }
      }

      const s = await authService.getSession();
      if (!eid) {
        eid = s.eventoId ?? null;
      }
      if (te === undefined) te = s.tipoEvento;
      if (ce === undefined) ce = s.codigoEvento;

      if (!eid) {
        const returnTo = openReserva ? "/mapa?openReserva=1" : "/mapa";
        router.replace(`/presala?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      setEventoId(eid);
      setEventoParams({ tipoEvento: te ?? 0, codigoEvento: ce ?? 1 });

      try {
        const data = await planosService.publico({
          ...(codigoParam ? { codigo: codigoParam } : { tipoEvento: te, codigoEvento: ce }),
          eventoId: eid,
        });
        setPayload(data);
        setPlanoId(data?.codigo ?? null);
      } catch {
        setPayload(null);
        setPlanoId(null);
      }
      setLoading(false);
    })();
  }, [router, openReserva, codigoParam]);

  if (loading || !eventoId) return null;

  if (!planoId || !payload) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <span className="text-4xl">🏗️</span>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-700">Plano en construccion</p>
              <p className="text-xs text-muted-foreground">Este evento aun no tiene un plano 3D asignado.</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/presala?change=1&returnTo=/mapa"><span>Cambiar de evento</span></Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const esMacro = payload.tipo === TIPOS_PLANO.MACRO;

  return (
    <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
        {parentParam && (
          <div>
            <Button variant="ghost" size="sm" className="h-7 text-xs -ml-2" asChild>
              <Link href={`/mapa?codigo=${encodeURIComponent(parentParam)}`}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                <span>Volver al mapa general</span>
              </Link>
            </Button>
          </div>
        )}
        {esMacro ? (
          <MacroMapaView
            imagenFondo={payload.imagenFondo}
            secciones={payload.secciones}
            ocupacion={payload.ocupacion}
            nombrePlano={payload.nombre}
          />
        ) : (
          <PlanoDinamico eventoId={eventoId} tipoEvento={eventoParams?.tipoEvento ?? 0} codigoEvento={eventoParams?.codigoEvento ?? 0} planoId={planoId} openReserva={openReserva} />
        )}
      </div>
    </main>
  );
}

export default function MapaDinamicoPage() {
  return (
    <Suspense fallback={null}>
      <MapaDinamicoPageContent />
    </Suspense>
  );
}
