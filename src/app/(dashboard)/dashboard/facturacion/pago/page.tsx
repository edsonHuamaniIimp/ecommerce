"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@nrivera-iimp/ui-kit-iimp";
import { Loader2 } from "lucide-react";
import Script from "next/script";

interface NiubizData {
  sessionToken: string;
  purchaseNumber: string;
  merchantId: string;
  amount: number;
  urlJs: string;
}

function PagarNiubizzPageContent() {
  const searchParams = useSearchParams();
  const facturacionId = searchParams.get("facturacionId");
  const [data, setData] = useState<NiubizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!facturacionId) { setError("Falta facturacionId"); setLoading(false); return; }
    fetch("/api/facturacion/niubizz/sesion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facturacionId }),
    })
      .then((r) => r.json())
      .then((json: { success: boolean; data?: NiubizData; error?: { message: string } }) => {
        if (json.success && json.data) setData(json.data);
        else setError(json.error?.message ?? "Error");
      })
      .catch(() => setError("Error de conexion"))
      .finally(() => setLoading(false));
  }, [facturacionId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-slate-500">Preparando pasarela de pago...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-red-600">{error || "Error al cargar la pasarela"}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-4 text-center">
          <h1 className="text-lg font-semibold text-slate-800">Pago con tarjeta</h1>
          <p className="text-sm text-slate-500">Monto: {data.amount.toFixed(2)} USD</p>
        </div>
        <div id="niubizz-form-container" className="rounded-xl border bg-white p-4 shadow-sm" />
      </div>

      <Script
        src={data.urlJs}
        data-sessiontoken={data.sessionToken}
        data-channel="web"
        data-merchantid={data.merchantId}
        data-purchasenumber={data.purchaseNumber}
        data-amount={data.amount.toFixed(2)}
        data-expirationminutes="20"
        data-timeouturl={`${window.location.origin}/dashboard/facturacion/pago/error`}
        strategy="afterInteractive"
        onLoad={() => {
          setTimeout(() => {
            const w = window as unknown as Record<string, unknown>;
            const checkout = w.VisanetCheckout as { open?: () => void; configure?: (c: Record<string, unknown>) => void } | undefined;
            if (checkout?.open) {
              checkout.configure?.({
                sessiontoken: data.sessionToken,
                channel: "web",
                merchantid: data.merchantId,
                purchasenumber: data.purchaseNumber,
                amount: data.amount.toFixed(2),
                expirationminutes: "20",
                timeouturl: `${window.location.origin}/dashboard/facturacion/pago/error`,
                merchantlogo: "",
                formbuttoncolor: "#059669",
                action: `${window.location.origin}/dashboard/facturacion/pago/response?facturacionId=${facturacionId}`,
                complete: function() {},
              });
              checkout.open();
            }
          }, 500);
        }}
      />
    </main>
  );
}

export default function PagarNiubizzPage() {
  return (
    <Suspense fallback={null}>
      <PagarNiubizzPageContent />
    </Suspense>
  );
}
