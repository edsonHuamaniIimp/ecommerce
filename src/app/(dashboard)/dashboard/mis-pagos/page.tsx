import { MisPagosManager } from "@/components/pagos/mis-pagos-manager";

export default function MisPagosPage() {
  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis pagos</h1>
          <p className="text-sm text-muted-foreground">
            Plan de pagos (cuotas) de tus solicitudes de stands. Puedes ver y configurar los numeros de pago.
          </p>
        </div>
        <MisPagosManager />
      </div>
    </main>
  );
}
