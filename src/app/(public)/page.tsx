import { Card, CardDescription, CardHeader, CardTitle, Button } from "@nrivera-iimp/ui-kit-iimp";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-20">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-2">
          <CardTitle>
            <span>Contratos de Stands</span>
          </CardTitle>
          <CardDescription>
            <span>
              Gestión de reservas de stands para eventos corporativos IIMP.
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link href="/plano">
            <span>Ir al Plano</span>
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/dashboard">
            <span>Ver Dashboard</span>
          </Link>
        </Button>
      </div>
    </main>
  );
}
