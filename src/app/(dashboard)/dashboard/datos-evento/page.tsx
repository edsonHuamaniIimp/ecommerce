import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PlanogessView } from "@/components/plano/planogess-view";
import { Card, CardContent, Button } from "@nrivera-iimp/ui-kit-iimp";
import Link from "next/link";

export default async function DatosEventoPage() {
  const session = await getSession();
  let tipoEvento = 0;
  let codigoEvento = 0;

  if (session?.eventoId) {
    const evento = await prisma.evento.findUnique({
      where: { id: session.eventoId },
      select: { tipoEvento: true, codigoEvento: true, anio: true },
    });
    if (evento) {
      tipoEvento = evento.tipoEvento;
      codigoEvento = evento.codigoEvento;
    }
  }

  if (!session?.eventoId) {
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
            Datos del Evento
          </h1>
          <p className="text-sm text-muted-foreground">
            Datos de stands desde KBEventos
          </p>
        </div>
        <PlanogessView tipoEvento={tipoEvento} codigoEvento={codigoEvento} />
      </div>
    </main>
  );
}
