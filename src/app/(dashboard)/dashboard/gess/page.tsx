import { eventosService } from "@/lib/api/services/facade";
import { GessMantenedor } from "@/components/gess/gess-mantenedor";

export default async function GessMantenedorPage() {
  const { evento } = await eventosService.getEventoActual();

  return (
    <main className="flex-1 px-6 py-6 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Mantenedor GESS
          </h1>
          <p className="text-sm text-muted-foreground">
            Vincular stands del API externo con bloques del plano isometrico.
          </p>
        </div>
        <GessMantenedor eventoId={evento.id} tipoEvento={evento.tipoEvento} codigoEvento={evento.codigoEvento} />
      </div>
    </main>
  );
}
