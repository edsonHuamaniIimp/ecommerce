import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GessMantenedor } from "@/components/gess/gess-mantenedor";
import { Card, CardContent, Button } from "@nrivera-iimp/ui-kit-iimp";
import Link from "next/link";

export default async function VinculacionPage() {
  const session = await getSession();
  const eventoId = session?.eventoId ?? "";
  const tipoEvento = session?.tipoEvento ?? 0;
  const codigoEvento = session?.codigoEvento ?? 0;

  let plano = "gess";

  if (tipoEvento && codigoEvento) {
    const meta = await prisma.$queryRawUnsafe<Array<{ plano: string | null }>>(
      `SELECT plano FROM evento_metadata WHERE tipo_evento = $1 AND codigo_evento = $2`,
      tipoEvento, codigoEvento,
    );
    if (meta.length > 0 && meta[0].plano) plano = meta[0].plano;
  }

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
          <h1 className="text-2xl font-semibold tracking-tight">Vinculacion de Stands</h1>
          <p className="text-sm text-muted-foreground">Vincular datos del API externo con bloques del plano isometrico.</p>
        </div>
        <GessMantenedor eventoId={eventoId} tipoEvento={tipoEvento} codigoEvento={codigoEvento} plano={plano} />
      </div>
    </main>
  );
}
