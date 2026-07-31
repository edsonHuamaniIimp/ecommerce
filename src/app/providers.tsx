"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { VerticalProvider, Toaster } from "@nrivera-iimp/ui-kit-iimp";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <VerticalProvider defaultVertical="proexplo">
        {children}
        <Toaster richColors />
      </VerticalProvider>
    </ThemeProvider>
  );
}
