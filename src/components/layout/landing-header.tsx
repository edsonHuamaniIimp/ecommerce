import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* Header exclusivo del landing `/landing` (estilo "Minimalism & Swiss Style").
 * No usa el Header global de la app para mantener la estética del landing. */

const NAV = [
  { href: "/landing", label: "Inicio" },
  { href: "/mapa", label: "Ubicaciones" },
  { href: "/presala", label: "Eventos" },
];

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#000000]/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-6 px-6">
        <Link href="/landing" className="flex shrink-0 items-center gap-3">
          <span className="rounded-none bg-[#000000] px-2 py-1 text-[11px] font-bold tracking-wider text-white">IIMP</span>
          <span className="text-sm font-semibold tracking-tight text-[#000000]">Contratos Stands</span>
        </Link>

        <nav className="hidden items-center gap-8 text-xs font-medium uppercase tracking-[0.15em] text-[#808080] md:flex">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-[#000000]">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/auth/login"
            className="hidden text-xs font-medium uppercase tracking-[0.15em] text-[#808080] transition-colors hover:text-[#000000] sm:inline"
          >
            Ingresar
          </Link>
          <Link
            href="/mapa"
            className="inline-flex items-center gap-1.5 rounded-none bg-[#000000] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition-colors duration-200 hover:bg-[#B38B6D]"
          >
            Reservar
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
