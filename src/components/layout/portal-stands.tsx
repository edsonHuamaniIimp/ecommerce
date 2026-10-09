"use client";

import Link from "next/link";
import Image from "next/image";
import { HelpCircle, ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { usePortalConfig } from "@/hooks/use-portal-config";

/** Header institucional del portal de exhibidores. */
export function PortalHeader() {
  const config = usePortalConfig();

  return (
    <header className="z-20 w-full border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/iimp-logo.png" alt="IIMP" width={202} height={65} className="h-8 w-auto" preload />
          <span className="flex flex-col">
            <span className="text-base font-bold leading-tight tracking-tight text-primary">ecommerce</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Portal Oficial de Exhibidores
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {config.mesaAyudaEmail && (
            <a
              href={`mailto:${config.mesaAyudaEmail}`}
              className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary sm:inline-flex"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Mesa de Ayuda</span>
            </a>
          )}
          <div className="hidden h-4 w-px bg-border sm:block" />
          <LanguageSwitcher />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" />
            <span>Acceso Seguro SSL</span>
          </span>
        </div>
      </div>
    </header>
  );
}

interface EnlacePortal {
  href: string;
  label: string;
  externo: boolean;
}

/** Footer institucional con enlaces configurables (los vacios no se muestran). */
export function PortalFooter() {
  const config = usePortalConfig();

  const enlaces: EnlacePortal[] = [
    config.mesaAyudaEmail ? { href: `mailto:${config.mesaAyudaEmail}`, label: "Mesa de Ayuda", externo: false } : null,
    config.manualUrl ? { href: config.manualUrl, label: "Manual del Exhibidor", externo: true } : null,
    config.reglamentoUrl ? { href: config.reglamentoUrl, label: "Reglamento de Stands", externo: true } : null,
    config.contactoEmail ? { href: `mailto:${config.contactoEmail}`, label: "Contacto", externo: false } : null,
  ].filter((enlace): enlace is EnlacePortal => enlace !== null);

  return (
    <footer className="z-20 w-full border-t border-border bg-card py-5">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row md:px-10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-gold" />
          <span>Conexion cifrada de 256 bits | Instituto de Ingenieros de Minas del Peru</span>
        </div>

        {enlaces.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
            {enlaces.map((enlace) => (
              <a
                key={enlace.label}
                href={enlace.href}
                {...(enlace.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {enlace.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
