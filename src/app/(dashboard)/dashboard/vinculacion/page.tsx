import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GessMantenedor } from "@/components/gess/gess-mantenedor";
import { Card, CardContent, Button } from "@nrivera-iimp/ui-kit-iimp";
import Link from "next/link";

export default async function VinculacionPage() {
  const session = await getSession();
  let eventoId = "";
  let plano = "gess";

  if (session?.eventoId) {
    const evento = await prisma.evento.findUnique({
      where: { id: session.eventoId },
      select: { plano: true },
    });
    if (evento) {
      eventoId = session.eventoId;
      plano = evento.plano;
    }
  }

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
          <h1 className="text-2xl font-semibold tracking-tight">
            Vinculacion de Stands
          </h1>
          <p className="text-sm text-muted-foreground">
            Vincular datos del API externo con bloques del plano isometrico.
          </p>
        </div>
        <GessMantenedor eventoId={eventoId} tipoEvento={14} codigoEvento={1} plano={plano} />
      </div>
    </main>
  );
}
