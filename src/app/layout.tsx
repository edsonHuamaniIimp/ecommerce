import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { GoogleTranslateScript } from "@/components/shared/google-translate-script";
import { IDIOMA_COOKIE } from "@/lib/shared/constants";
import { idiomaODefecto } from "@/lib/shared/utils/idioma";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Contratos Stands - IIMP",
  description: "Gestión de contratos de stands para eventos IIMP",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /* Idioma preferido (cookie): define el atributo `lang` y el Website Translator. */
  const cookieStore = await cookies();
  const idioma = idiomaODefecto(cookieStore.get(IDIOMA_COOKIE)?.value);

  return (
    <html
      lang={idioma}
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <GoogleTranslateScript />
      </body>
    </html>
  );
}
