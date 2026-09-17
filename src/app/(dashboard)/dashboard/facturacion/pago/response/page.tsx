"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@nrivera-iimp/ui-kit-iimp";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { internalApi } from "@/lib/client/api/services/internal-api";

function NiubizzResponsePageContent() {
  const searchParams = useSearchParams();
  const facturacionId = searchParams.get("facturacionId");
  const transactionToken = searchParams.get("transactionToken");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    (async () => {
      if (!facturacionId || !transactionToken) {
        setStatus("error");
        return;
      }
      try {
        await internalApi.post("/api/facturacion/niubizz/confirmar", { facturacionId, transactionToken });
        setStatus("success");
      } catch {
        setStatus("error");
      }
    })();
  }, [facturacionId, transactionToken]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          {status === "loading" && <Loader2 className="h-10 w-10 animate-spin text-amber-500" />}
          {status === "success" && <CheckCircle2 className="h-10 w-10 text-emerald-500" />}
          {status === "error" && <XCircle className="h-10 w-10 text-red-500" />}
          <p className="text-sm font-medium">
            {status === "loading" ? "Procesando pago..." :
             status === "success" ? "Pago procesado correctamente" :
             "Error al procesar el pago"}
          </p>
          <Link href="/dashboard/mis-solicitudes" className="text-sm text-primary hover:underline">
            Volver a Mis solicitudes
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

export default function NiubizzResponsePage() {
  return (
    <Suspense fallback={null}>
      <NiubizzResponsePageContent />
    </Suspense>
  );
}
