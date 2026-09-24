import Link from "next/link";
import { Building2, HelpCircle, ShieldCheck } from "lucide-react";

/** Header institucional del portal de exhibidores. */
export function PortalHeader() {
  return (
    <header className="z-20 w-full border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <Building2 className="h-5 w-5 text-gold-soft" />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-bold leading-tight tracking-tight text-primary">IIMP Stands</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Portal Oficial de Exhibidores
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <a
            href="#soporte"
            className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary sm:inline-flex"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Mesa de Ayuda</span>
          </a>
          <div className="hidden h-4 w-px bg-border sm:block" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" />
            <span>Acceso Seguro SSL</span>
          </span>
        </div>
      </div>
    </header>
  );
}

/** Footer institucional con enlaces de soporte y aviso de seguridad. */
export function PortalFooter() {
  return (
    <footer className="z-20 w-full border-t border-border bg-card py-5">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row md:px-10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-gold" />
          <span>Conexion cifrada de 256 bits | Instituto de Ingenieros de Minas del Peru</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
          <a href="#mesa-ayuda" className="font-medium text-muted-foreground transition-colors hover:text-primary">Mesa de Ayuda</a>
          <a href="#manual" className="font-medium text-muted-foreground transition-colors hover:text-primary">Manual del Exhibidor</a>
          <a href="#reglamento" className="font-medium text-muted-foreground transition-colors hover:text-primary">Reglamento de Stands</a>
          <a href="#contacto" className="font-medium text-muted-foreground transition-colors hover:text-primary">Contacto</a>
        </div>
      </div>
    </footer>
  );
}
