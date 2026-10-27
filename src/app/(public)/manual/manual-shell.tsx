import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  LifeBuoy,
  ShieldCheck,
  Store,
} from "lucide-react";
import { GuiaTabs, type GuiaManual } from "./guia-tabs";
import { ManualNav } from "./manual-nav";
import { PrintButton } from "./print-button";
import type { ManualSeccion } from "./content";

interface ManualShellProps {
  guia: GuiaManual;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  version: string;
  audiencia: string;
  actualizado: string;
  metadatos: { label: string; value: string }[];
  toc: ManualSeccion[];
  html: string;
}

const GUIAS = {
  reservas: {
    nombre: "Reserva de stands",
    detalle: "Plano, contrato y pagos",
    href: "/manual",
    icon: Store,
  },
  dd: {
    nombre: "Debida diligencia",
    detalle: "Formulario, vigencia y documentos",
    href: "/manual/dd",
    icon: ShieldCheck,
  },
} as const;

export function ManualShell({
  guia,
  titulo,
  subtitulo,
  descripcion,
  version,
  audiencia,
  actualizado,
  metadatos,
  toc,
  html,
}: ManualShellProps) {
  const otraGuia = guia === "reservas" ? GUIAS.dd : GUIAS.reservas;
  const OtroIcono = otraGuia.icon;

  return (
    <div className="flex-1 bg-background">
      <aside className="manual-sidebar fixed bottom-0 left-0 top-12 z-40 hidden w-72 flex-col border-r border-border bg-card lg:flex">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-primary">Centro de ayuda</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Guías del portal IIMP
              </span>
            </span>
          </div>
          <div className="mt-3">
            <GuiaTabs activa={guia} variante="sidebar" />
          </div>
        </div>

        <nav aria-label="Secciones del manual" className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 flex items-center justify-between px-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Contenido
            </p>
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
              {toc.length} secciones
            </span>
          </div>
          <ManualNav secciones={toc} />
        </nav>

        <div className="border-t border-border p-3">
          <PrintButton />
          <div className="mt-2 rounded-lg bg-secondary p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
              <LifeBuoy className="h-3.5 w-3.5" />
              <span>¿Necesitas ayuda?</span>
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              Contacta a la Mesa de Ayuda del IIMP o al oficial de cumplimiento
              para dudas sobre tu expediente.
            </p>
          </div>
          <Link
            href={otraGuia.href}
            className="mt-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
          >
            <OtroIcono className="h-3.5 w-3.5" />
            <span className="min-w-0 flex-1 truncate">Ir a {otraGuia.nombre}</span>
            <ChevronRight className="h-3 w-3 shrink-0" />
          </Link>
          <Image
            src="/iimp-logo.png"
            alt="IIMP"
            width={202}
            height={65}
            className="mx-auto mt-3 h-5 w-auto opacity-70"
          />
        </div>
      </aside>

      <main className="manual-main min-w-0 lg:pl-72">
        <section className="manual-hero relative overflow-hidden border-b border-primary/20 bg-primary text-primary-foreground">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, var(--gold-soft) 0, transparent 32%), radial-gradient(circle at 82% 18%, var(--gold) 0, transparent 26%), linear-gradient(120deg, transparent 35%, rgba(255,255,255,.12) 35%, rgba(255,255,255,.12) 36%, transparent 36%)",
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-soft">
                  <span>Portal Oficial de Exhibidores</span>
                  <span className="h-1 w-1 rounded-full bg-gold-soft/60" />
                  <span>{subtitulo}</span>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary-foreground/80">
                  {descripcion}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {metadatos.map((meta) => (
                    <span
                      key={meta.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-1 text-[10px] text-primary-foreground/85"
                    >
                      <span className="font-semibold text-primary-foreground">{meta.label}</span>
                      <span className="text-primary-foreground/50">/</span>
                      <span>{meta.value}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 p-3.5 backdrop-blur-sm lg:max-w-[230px]">
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gold-soft">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Guía oficial</span>
                </p>
                <p className="mt-1.5 text-xs font-semibold text-primary-foreground">{audiencia}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-primary-foreground/65">
                  Versión {version} · Actualizada {actualizado}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/55">
                Cambiar de guía
              </p>
              <GuiaTabs activa={guia} />
            </div>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-6 sm:px-6 lg:px-10">
          <details className="manual-no-print group rounded-xl border border-border bg-card lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-primary">
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Contenido de esta guía
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                {toc.length} secciones
              </span>
            </summary>
            <div className="border-t border-border px-3 py-3">
              <ManualNav secciones={toc} />
            </div>
          </details>

          <article
            className="manual-content min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <div className="manual-no-print flex flex-col gap-3 rounded-xl border border-border bg-secondary/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-primary">¿Terminaste esta guía?</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Continúa con la otra guía o vuelve al portal para gestionar tu proceso.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={otraGuia.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-semibold text-primary transition-colors hover:border-primary/30 hover:bg-card"
              >
                <OtroIcono className="h-3.5 w-3.5" />
                <span>{otraGuia.nombre}</span>
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <span>Ir al portal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
