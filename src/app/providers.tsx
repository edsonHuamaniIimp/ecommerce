"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { VerticalProvider, Toaster } from "@nrivera-iimp/ui-kit-iimp";
import { EventoProvider } from "@/contexts/evento-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <VerticalProvider defaultVertical="proexplo">
        <EventoProvider>
          {children}
          <Toaster />
        </EventoProvider>
      </VerticalProvider>
    </ThemeProvider>
  );
}
