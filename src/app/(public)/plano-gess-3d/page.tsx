import { planoService, eventosService } from "@/lib/api/services/facade";
import { PlanoGess3D } from "@/components/plano/plano-gess-3d";

export default async function PlanoGess3DPage() {
  const [stands, contexto] = await Promise.all([
    planoService.getPlano("ev-perumin38"),
    eventosService.getEventoActual(),
  ]);

  return (
    <main className="flex-1 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Plano GESS 3D — {contexto.eventoPadre.nombre} {contexto.evento.anio}
          </h1>
          <p className="text-sm text-muted-foreground">
            Reconstrucción 3D basada en el análisis de planogess.png: pabellones beige, jardín central, bloques de stands terracota.
          </p>
        </div>
        <PlanoGess3D stands={stands} />
      </div>
    </main>
  );
}
