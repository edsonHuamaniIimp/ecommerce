import { ReservarEmpresaPanel } from "@/components/reservas/reservar-empresa-panel";

export default function ReservarEmpresaPage() {
  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reservar para empresa</h1>
          <p className="text-sm text-muted-foreground">
            Reserva interna para pabellones internacionales. La solicitud pasa directamente a Pendiente Pago.
          </p>
        </div>
        <ReservarEmpresaPanel />
      </div>
    </main>
  );
}
