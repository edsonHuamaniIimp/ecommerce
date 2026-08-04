"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { VerticalProvider, Toaster, TooltipProvider } from "@nrivera-iimp/ui-kit-iimp";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <VerticalProvider defaultVertical="proexplo">
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster richColors />
        </TooltipProvider>
      </VerticalProvider>
    </ThemeProvider>
  );
}
