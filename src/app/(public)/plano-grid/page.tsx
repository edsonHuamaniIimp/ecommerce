import { eventosService } from "@/lib/client/api/services/facade";
import { PlanoGrid2D } from "@/components/plano/plano-grid-2d";

export default async function PlanoGridPage() {
  const [contexto] = await Promise.all([eventosService.getEventoActual()]);

  return (
    <main className="flex-1 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Plano Grid 2D — {contexto.eventoPadre.nombre} {contexto.evento.anio}
          </h1>
          <p className="text-sm text-muted-foreground">
            Reconstrucción exacta del layout espacial isométrico. Celdas coloreadas = stands, vacías = pasillos.
          </p>
        </div>
        <PlanoGrid2D />
      </div>
    </main>
  );
}
