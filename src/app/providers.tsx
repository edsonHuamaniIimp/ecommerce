"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster, TooltipProvider } from "@nrivera-iimp/ui-kit-iimp";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="light">
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster richColors />
      </TooltipProvider>
    </ThemeProvider>
  );
}
