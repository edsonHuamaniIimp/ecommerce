import { planoService, eventosService } from "@/lib/api/services/facade";
import { PlanoGrid } from "@/components/plano/plano-grid";

export default async function PlanoGridPage() {
  const [stands, contexto] = await Promise.all([
    planoService.getPlano("ev-perumin38"),
    eventosService.getEventoActual(),
  ]);

  return (
    <main className="flex-1 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Plano Grid — {contexto.eventoPadre.nombre} {contexto.evento.anio}
          </h1>
          <p className="text-sm text-muted-foreground">
            Layout tipo asientos con pasillo central. Clic para seleccionar.
          </p>
        </div>
        <PlanoGrid stands={stands} />
      </div>
    </main>
  );
}
