"use client";

import Link from "next/link";
import { Button, Card, CardContent } from "@nrivera-iimp/ui-kit-iimp";
import { ShieldAlert } from "lucide-react";

/** Estado de acceso denegado para las vistas del modulo Debida Diligencia. */
export function DdAccesoDenegado({
  mensaje = "No tienes permisos para acceder a esta sección del módulo de Debida Diligencia.",
}: {
  mensaje?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <div className="max-w-md">
          <h2 className="text-base font-semibold text-foreground">Acceso restringido</h2>
          <p className="mt-1 text-sm text-muted-foreground">{mensaje}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Si necesitas este acceso, solicita al administrador que revise tus permisos del módulo DD.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="text-xs">
          <Link href="/dashboard">Volver a mi panel</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
