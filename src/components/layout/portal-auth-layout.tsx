import type { ReactNode } from "react";
import { Label } from "@nrivera-iimp/ui-kit-iimp";
import { PortalFooter, PortalHeader } from "./portal-stands";

/** Shell de las vistas de acceso del portal: header institucional + tarjeta centrada + footer. */
export function PortalAuthLayout({ children, ancho = "max-w-[460px]" }: { children: ReactNode; ancho?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PortalHeader />
      <main className="bg-architectural-grid relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className={`w-full rounded-xl border border-border bg-card p-7 shadow-xl transition-all sm:p-9 ${ancho}`}>
          {children}
        </div>
      </main>
      <PortalFooter />
    </div>
  );
}

/** Encabezado de tarjeta de acceso: icono circular + titulo + descripcion. */
export function PortalAuthCardHeader({
  icono,
  titulo,
  descripcion,
}: {
  icono: ReactNode;
  titulo: string;
  descripcion: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center border-b border-border pb-6 text-center">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icono}
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-primary">{titulo}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>
    </div>
  );
}

/**
 * Campo de formulario del portal: label + icono a la izquierda + control.
 * El control (Input/Textarea del UI Kit) se pasa como children para conservar
 * sus props y clases (incluidas las de PORTAL_UI).
 */
export function PortalField({
  id,
  label,
  icono,
  accionLabel,
  children,
}: {
  id: string;
  label: string;
  icono: ReactNode;
  /** Accion opcional alineada a la derecha del label (ej. "Olvidaste tu contrasena?"). */
  accionLabel?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label htmlFor={id} className="block text-xs font-semibold tracking-wide text-primary">
          <span>{label}</span>
        </Label>
        {accionLabel}
      </div>
      <div className="relative rounded-lg shadow-sm">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
          {icono}
        </span>
        {children}
      </div>
    </div>
  );
}
