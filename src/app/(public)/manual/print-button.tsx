"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-semibold text-primary transition-colors hover:border-primary/30 hover:bg-secondary"
    >
      <Printer className="h-3.5 w-3.5" />
      <span>Imprimir o guardar PDF</span>
    </button>
  );
}
