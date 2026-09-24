import Link from "next/link";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { Building2, CalendarDays, HelpCircle, LifeBuoy, LogIn } from "lucide-react";

interface PresalaHeaderProps {
  autenticado: boolean;
  nombreUsuario?: string | null;
  empresa?: string | null;
  codigoEmpresa?: string | null;
}

function iniciales(texto: string | null | undefined): string {
  if (!texto) return "II";
  return texto
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

/** Header del portal de expositor: marca, empresa activa, navegacion y cuenta. */
export function PresalaHeader({ autenticado, nombreUsuario, empresa, codigoEmpresa }: PresalaHeaderProps) {
  const enlaceNav = "flex items-center gap-1.5 pb-1 transition-colors duration-150";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center gap-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-inner">
              <Building2 className="h-5 w-5 text-gold-soft" />
            </span>
            <span>
              <span className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-primary">IIMP Stands</span>
                <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-gold uppercase">
                  Reserva Oficial
                </span>
              </span>
              <p className="text-xs font-medium text-muted-foreground">Instituto de Ingenieros de Minas del Peru</p>
            </span>
          </Link>

          {autenticado && empresa && (
            <>
              <div className="hidden h-7 w-px bg-border md:block" />
              <div className="hidden items-center gap-2.5 rounded-lg border border-border/60 bg-secondary px-3 py-1.5 lg:flex">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="max-w-[240px] truncate text-xs font-semibold text-primary">{empresa}</span>
                {codigoEmpresa && (
                  <span className="text-[11px] text-muted-foreground">Codigo {codigoEmpresa}</span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
            <Link href="/presala" className={`${enlaceNav} border-b-2 border-primary font-semibold text-primary`}>
              <CalendarDays className="h-4 w-4" />
              <span>Eventos disponibles</span>
            </Link>
            {autenticado && (
              <Link href="/dashboard/mis-solicitudes" className={`${enlaceNav} text-muted-foreground hover:text-primary`}>
                <span>Mis solicitudes</span>
              </Link>
            )}
            <a href="#soporte" className={`${enlaceNav} text-muted-foreground hover:text-primary`}>
              <HelpCircle className="h-4 w-4" />
              <span>Ayuda y soporte</span>
            </a>
          </nav>

          <div className="hidden h-6 w-px bg-border sm:block" />

          {autenticado ? (
            <div className="flex items-center gap-3 pl-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-1 ring-border">
                {iniciales(nombreUsuario ?? empresa)}
              </span>
              <span className="hidden flex-col text-left xl:flex">
                <span className="text-xs leading-tight font-semibold text-foreground">{nombreUsuario ?? "Usuario"}</span>
                <span className="w-fit rounded-sm bg-gold/15 px-1.5 text-[11px] font-medium text-gold">
                  Exhibidor Autorizado
                </span>
              </span>
            </div>
          ) : (
            <Button asChild className="gap-2 bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <Link href="/auth/login">
                <LogIn className="h-4 w-4" />
                <span>Iniciar sesion</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

/** Tarjeta de asistencia del portal (aside de presala). */
export function PresalaAyudaCard() {
  return (
    <div id="soporte" className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5 text-primary">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold">
          <LifeBuoy className="h-4 w-4" />
        </span>
        <h3 className="text-base font-bold text-primary">Asistencia para exhibidores</h3>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Si necesitas apoyo con la reserva, los documentos del contrato o el estado de tu solicitud,
        contacta a la Mesa de Ayuda del IIMP.
      </p>
      <a
        href="#contacto"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-primary py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-secondary"
      >
        <HelpCircle className="h-4 w-4" />
        <span>Ir a Mesa de Ayuda</span>
      </a>
    </div>
  );
}
