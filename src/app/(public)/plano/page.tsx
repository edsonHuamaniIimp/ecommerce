"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanoIsometrico } from "@/components/plano/plano-isometrico";
import { Card, CardContent, Button } from "@nrivera-iimp/ui-kit-iimp";
import Link from "next/link";
import { getPlano } from "@/lib/planos/registry";
import { LS_KEYS } from "@/lib/constants";
import { authService } from "@/lib/api/services/auth-service";

export default function PlanoIsometricoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [eventoParams, setEventoParams] = useState<{ tipoEvento: number; codigoEvento: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const openReserva = searchParams.get("openReserva") === "1";

  useEffect(() => {
    (async () => {
      const raw = localStorage.getItem(LS_KEYS.EVENTO_PUBLICO);
      let eid: string | null = null;

      if (raw) {
        try {
          const pub = JSON.parse(raw) as { eventoId: string };
          eid = pub.eventoId;
        } catch { /* ignore */ }
      }

      if (!eid) {
        const session = await authService.getSession();
        eid = session.eventoId ?? null;
      }

      if (!eid) {
        const returnTo = openReserva ? "/plano?openReserva=1" : "/plano";
        router.replace(`/presala?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }

      setEventoId(eid);

      const res = await fetch(`/api/eventos/publico?id=${encodeURIComponent(eid)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPlanoId(json.data.plano || null);
        setEventoParams({
          tipoEvento: json.data.tipoEvento ?? 0,
          codigoEvento: json.data.codigoEvento ?? 1,
        });
      }
      setLoading(false);
    })();
  }, [router]);

  if (loading || !eventoId) return null;

  if (!planoId || !getPlano(planoId)) {
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
              <Link href="/presala?change=1&returnTo=/plano"><span>Cambiar de evento</span></Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
        <PlanoIsometrico eventoId={eventoId} tipoEvento={eventoParams?.tipoEvento ?? 0} codigoEvento={eventoParams?.codigoEvento ?? 0} openReserva={openReserva} />
      </div>
    </main>
  );
}
