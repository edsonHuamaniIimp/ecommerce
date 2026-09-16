import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Contratos Stands - IIMP",
  description: "Gestión de contratos de stands para eventos IIMP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Anti-flash de vertical: script externo hoistable (React 19 lo
            eleva al <head> y lo ejecuta antes del primer paint) */}
        <script async src="/vertical-init.js" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
