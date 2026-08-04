import { getSession } from "@/lib/auth";
import { Card, CardContent, Button } from "@nrivera-iimp/ui-kit-iimp";
import { MisSolicitudesManager } from "@/components/solicitudes/mis-solicitudes-manager";
import Link from "next/link";

export default async function MisSolicitudesPage() {
  const session = await getSession();
  const eventoId = session?.eventoId ?? "";
  const userId = session?.sub ?? "";

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
          <h1 className="text-2xl font-semibold tracking-tight">Mis solicitudes</h1>
          <p className="text-sm text-muted-foreground">Estado de tus solicitudes de alquiler de stands en el evento actual.</p>
        </div>
        <MisSolicitudesManager eventoId={eventoId} userId={userId} />
      </div>
    </main>
  );
}
