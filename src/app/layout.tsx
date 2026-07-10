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

const verticalInitScript = `
(function () {
  try {
    var allowed = ["proexplo", "wmc", "gess", "perumin"];
    var saved = localStorage.getItem("iimp-vertical");
    var params = new URLSearchParams(window.location.search);
    var themeParam = params.get("theme");
    var vertical = allowed.indexOf(themeParam) !== -1
      ? themeParam
      : (allowed.indexOf(saved) !== -1 ? saved : "proexplo");
    document.documentElement.classList.add("vert-" + vertical);
    document.documentElement.setAttribute("data-vertical", vertical);
  } catch (e) {}
})();
`;

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
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: verticalInitScript }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
