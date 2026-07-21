import { EventosMantenedor } from "@/components/admin/eventos-mantenedor";

export default function EventosMantenedorPage() {
  return (
    <main className="flex-1 px-6 py-6 lg:px-10">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Eventos y Versiones
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestion de eventos padre y sus versiones anuales.
          </p>
        </div>
        <EventosMantenedor />
      </div>
    </main>
  );
}
