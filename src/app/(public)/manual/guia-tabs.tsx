import Link from "next/link";
import { ShieldCheck, Store } from "lucide-react";

export type GuiaManual = "reservas" | "dd";

const GUIAS: {
  id: GuiaManual;
  href: string;
  label: string;
  descripcion: string;
  icon: typeof Store;
}[] = [
  {
    id: "reservas",
    href: "/manual",
    label: "Reserva de stands",
    descripcion: "Plano, contrato y pagos",
    icon: Store,
  },
  {
    id: "dd",
    href: "/manual/dd",
    label: "Debida diligencia",
    descripcion: "Formulario, vigencia y documentos",
    icon: ShieldCheck,
  },
];

export function GuiaTabs({
  activa,
  variante = "hero",
}: {
  activa: GuiaManual;
  variante?: "hero" | "sidebar";
}) {
  const compacta = variante === "sidebar";

  return (
    <nav
      aria-label="Guías disponibles"
      className={
        compacta
          ? "grid gap-1.5"
          : "flex flex-col gap-2 sm:flex-row sm:items-center"
      }
    >
      {GUIAS.map(({ id, href, label, descripcion, icon: Icon }) => {
        const activaGuia = id === activa;
        return (
          <Link
            key={id}
            href={href}
            aria-current={activaGuia ? "page" : undefined}
            className={
              compacta
                ? `group flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors ${
                    activaGuia
                      ? "border-gold/60 bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-secondary hover:text-foreground"
                  }`
                : `group flex min-w-0 items-center gap-2.5 rounded-lg border px-3.5 py-2.5 transition-all ${
                    activaGuia
                      ? "border-gold/70 bg-card text-primary shadow-sm"
                      : "border-primary-foreground/20 bg-primary-foreground/5 text-primary-foreground/75 hover:border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  }`
            }
          >
            <span
              className={
                compacta
                  ? `flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      activaGuia ? "bg-primary-foreground/10 text-gold-soft" : "bg-secondary text-primary"
                    }`
                  : `flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      activaGuia ? "bg-primary/10 text-primary" : "bg-primary-foreground/10 text-gold-soft"
                    }`
              }
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-xs font-semibold">{label}</span>
              <span
                className={
                  compacta
                    ? `block truncate text-[10px] ${
                        activaGuia ? "text-primary-foreground/75" : "text-muted-foreground"
                      }`
                    : `block truncate text-[10px] ${
                        activaGuia ? "text-muted-foreground" : "text-primary-foreground/60"
                      }`
                }
              >
                {descripcion}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
