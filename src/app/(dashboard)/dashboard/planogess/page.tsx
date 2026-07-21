import { eventosService } from "@/lib/api/services/facade";
import { PlanogessView } from "@/components/plano/planogess-view";

export default async function PlanogessPage() {
  const { evento } = await eventosService.getEventoActual();

  return (
    <main className="flex-1 px-6 py-6 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Plano GESS
          </h1>
          <p className="text-sm text-muted-foreground">
            Datos de stands desde KBEventos — tipo {evento.tipoEvento}, evento {evento.codigoEvento}
          </p>
        </div>
        <PlanogessView tipoEvento={evento.tipoEvento} codigoEvento={evento.codigoEvento} />
      </div>
    </main>
  );
}
