"use client";

import { Card, CardContent, Button } from "@nrivera-iimp/ui-kit-iimp";
import { XCircle } from "lucide-react";
import Link from "next/link";

export default function NiubizzErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <XCircle className="h-10 w-10 text-red-500" />
          <p className="text-sm font-medium">El pago no pudo ser completado o fue cancelado.</p>
          <Link href="/dashboard/mis-solicitudes" className="text-sm text-primary hover:underline">
            Volver a Mis solicitudes
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
