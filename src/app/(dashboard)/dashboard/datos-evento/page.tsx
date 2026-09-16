import { getSession } from "@/lib/server/auth";
import { Card, CardContent, Button } from "@nrivera-iimp/ui-kit-iimp";
import { DatosEventoManager } from "@/components/plano/datos-evento-manager";
import Link from "next/link";

export default async function DatosEventoPage() {
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
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Datos del Evento</h1>
          <p className="text-sm text-muted-foreground">Stands vinculados desde KBEventos</p>
        </div>
        <DatosEventoManager eventoId={eventoId} />
      </div>
    </main>
  );
}
