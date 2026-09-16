import { getSession } from "@/lib/server/auth";
import { Card, CardContent, Button } from "@nrivera-iimp/ui-kit-iimp";
import { SolicitudesManager } from "@/components/solicitudes/solicitudes-manager";
import Link from "next/link";

export default async function SolicitudesPage() {
  const session = await getSession();
  const eventoId = session?.eventoId ?? "";

  if (!eventoId) {
    return (
      <main className="flex-1 py-6">
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
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Solicitudes de alquiler</h1>
          <p className="text-sm text-muted-foreground">Revision de solicitudes de alquiler por area (Comunicacion, Legal, Logistica).</p>
        </div>
        <SolicitudesManager eventoId={eventoId} />
      </div>
    </main>
  );
}
