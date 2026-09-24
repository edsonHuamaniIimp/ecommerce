import Link from "next/link";
import { Button, Card, CardContent } from "@nrivera-iimp/ui-kit-iimp";

/** Estado vacio cuando no hay evento seleccionado en la presala. */
export function SinEvento() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16">
        <p className="text-sm text-muted-foreground">Selecciona un evento en la presala para continuar.</p>
        <Button asChild>
          <Link href="/presala?change=1"><span>Ir a la presala</span></Link>
        </Button>
      </CardContent>
    </Card>
  );
}
