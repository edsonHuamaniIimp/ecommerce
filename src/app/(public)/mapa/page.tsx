"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlanoDinamico } from "@/components/plano/plano-dinamico";
import { MacroMapaView } from "@/components/plano/macro-mapa-view";
import { ModalInformativoEvento } from "@/components/plano/modal-informativo-evento";
import { MapaSkeleton } from "@/components/shared/mapa-skeleton";
import { Card, CardContent, Button } from "@nrivera-iimp/ui-kit-iimp";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { LS_KEYS, TIPOS_PLANO } from "@/lib/shared/constants";
import { authService } from "@/lib/client/api/services/auth-service";
import { planosService } from "@/lib/client/api/services/planos-service";
import { usePlanoCarrito } from "@/lib/client/stores/plano-carrito-store";
import { planoVisitaCache } from "@/lib/client/stores/plano-visita-cache";
import type { PlanoPublicoPayloadDTO } from "@/types/dto/planos/planos-response.dto";

function MapaDinamicoPageContent() {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);
  const searchParams = useSearchParams();
  const openReserva = searchParams.get("openReserva") === "1";
  const codigoParam = searchParams.get("codigo");
  const parentParam = searchParams.get("parent");
  /** RF-08: bloque del stand a preseleccionar (resuelve el pabellon si no viene `codigo`). */
  const bloqueParam = searchParams.get("bloque");

  // Seed desde el cache de sesion: al volver del pabellon al macro no se ve skeleton.
  const [cacheInicial] = useState(() => {
    const visita = planoVisitaCache.eventoObtener() ?? null;
    const payloadCache = codigoParam ? (planoVisitaCache.payloadObtener(codigoParam) ?? null) : null;
    return { visita, payloadCache };
  });
  const [eventoId, setEventoId] = useState<string | null>(cacheInicial.visita?.eventoId ?? null);
  const [planoId, setPlanoId] = useState<string | null>(cacheInicial.payloadCache?.codigo ?? null);
  const [payload, setPayload] = useState<PlanoPublicoPayloadDTO | null>(cacheInicial.payloadCache);
  const [eventoParams, setEventoParams] = useState<{ tipoEvento: number; codigoEvento: number } | null>(
    cacheInicial.visita ? { tipoEvento: cacheInicial.visita.tipoEvento, codigoEvento: cacheInicial.visita.codigoEvento } : null,
  );
  const [loading, setLoading] = useState(!(cacheInicial.visita?.eventoId && cacheInicial.payloadCache));

  // Registra el codigo del macro para navegacion desde el carrito.
  const esMacro = payload?.tipo === TIPOS_PLANO.MACRO;
  const parentsCarrito = usePlanoCarrito((s) => s.parents);
  const macroCodigo = usePlanoCarrito((s) => s.macroCodigo);
  // Destino de "volver": el `parent` explicito o, si no vino en la URL, el plano
  // padre/macro registrado en el carrito (permite volver al macro aunque la URL
  // se haya abierto directo con ?codigo=<pabellon>).
  const destinoVolver = parentParam
    ?? (planoId ? (parentsCarrito[planoId] ?? (macroCodigo && macroCodigo !== planoId ? macroCodigo : null)) : null);
  useEffect(() => {
    if (esMacro && payload?.codigo) {
      usePlanoCarrito.getState().registrarMacro(payload.codigo);
    }
  }, [esMacro, payload?.codigo]);

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
        routerRef.current.replace(`/presala?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      setEventoId(eid);
      setEventoParams({ tipoEvento: te ?? 0, codigoEvento: ce ?? 1 });
      planoVisitaCache.eventoMarcar({ eventoId: eid, tipoEvento: te ?? 0, codigoEvento: ce ?? 0 });

      try {
        let codigoEfectivo = codigoParam;
        if (!codigoEfectivo && bloqueParam) {
          try {
            const ubicacion = await planosService.ubicacion(bloqueParam);
            codigoEfectivo = ubicacion.plano.codigo;
          } catch { /* el bloque no tiene plano: carga el plano principal del evento */ }
        }
        const data = await planosService.publico({
          ...(codigoEfectivo ? { codigo: codigoEfectivo } : { tipoEvento: te, codigoEvento: ce }),
          eventoId: eid,
        });
        planoVisitaCache.payloadMarcar(codigoEfectivo ?? `${te}-${ce}`, data);
        setPayload(data);
        setPlanoId(data?.codigo ?? null);
      } catch {
        // Si ya hay payload en cache, se mantiene; sino se muestra el estado "en construccion".
        if (!cacheInicial.payloadCache) {
          setPayload(null);
          setPlanoId(null);
        }
      }
      setLoading(false);
    })();
  }, [openReserva, codigoParam, bloqueParam, cacheInicial]);

  if (loading || !eventoId) return <MapaSkeleton />;

  const modalInformativo = eventoParams ? (
    <ModalInformativoEvento tipoEvento={eventoParams.tipoEvento} codigoEvento={eventoParams.codigoEvento} />
  ) : null;

  if (!planoId || !payload) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
        {modalInformativo}
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

  return (
    <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">
      {modalInformativo}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
        {destinoVolver && (
          <div>
            <Button variant="ghost" size="sm" className="h-7 text-xs -ml-2" asChild>
              <Link href={`/mapa?codigo=${encodeURIComponent(destinoVolver)}`}>
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
          <PlanoDinamico eventoId={eventoId} tipoEvento={eventoParams?.tipoEvento ?? 0} codigoEvento={eventoParams?.codigoEvento ?? 0} planoId={planoId} openReserva={openReserva} parentCodigo={parentParam} bloqueInicial={bloqueParam} />
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
