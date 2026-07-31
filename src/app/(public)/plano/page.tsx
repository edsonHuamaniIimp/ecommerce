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
      let te: number | undefined;
      let ce: number | undefined;

      if (raw) {
        try {
          const pub = JSON.parse(raw) as { eventoId: string; tipoEvento?: number; codigoEvento?: number };
          eid = pub.eventoId; te = pub.tipoEvento; ce = pub.codigoEvento;
        } catch { /* ignore */ }
      }
      if (!eid) {
        const s = await authService.getSession();
        eid = s.eventoId ?? null; te = s.tipoEvento; ce = s.codigoEvento;
      }
      if (!eid) {
        const returnTo = openReserva ? "/plano?openReserva=1" : "/plano";
        router.replace(`/presala?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      setEventoId(eid);

      // Buscar plano desde evento_metadata via API
      let plano = "gess";
      try {
        const res = await fetch("/api/eventos/listar").then((r) => r.json());
        const grupos = (res.data ?? []) as Array<{ versiones: Array<{ tipoEvento: number; codigoEvento: number; plano: string | null }> }>;
        for (const g of grupos) {
          const v = g.versiones.find((x) => x.tipoEvento === te && x.codigoEvento === ce);
          if (v?.plano) { plano = v.plano; break; }
        }
      } catch { /* ignore */ }
      setPlanoId(plano);
      setEventoParams({ tipoEvento: te ?? 0, codigoEvento: ce ?? 1 });
      setLoading(false);
    })();
  }, [router, openReserva]);

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
