import { getSession } from "@/lib/auth";
import { Card, CardContent, Button } from "@nrivera-iimp/ui-kit-iimp";
import { ReservasManager } from "@/components/reservas/reservas-manager";
import Link from "next/link";

export default async function ReservasPage() {
  const session = await getSession();
  const eventoId = session?.eventoId ?? "";

  if (!eventoId) {
    return (
      <main className="flex-1 px-6 py-6 lg:px-10">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-muted-foreground">Selecciona un evento en la presala para continuar.</p>
            <Button asChild><Link href="/presala?change=1"><span>Ir a la presala</span></Link></Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-6 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestion de Reservas</h1>
          <p className="text-sm text-muted-foreground">Solicitudes de reserva de stands recibidas desde el plano interactivo.</p>
        </div>
        <ReservasManager eventoId={eventoId} />
      </div>
    </main>
  );
}
