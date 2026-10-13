import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, LifeBuoy, Map } from "lucide-react";
import "./manual.css";
import { MANUAL_HTML, MANUAL_TOC } from "./content";
import { ManualNav } from "./manual-nav";

export const metadata: Metadata = {
  title: "Manual del Exhibidor — IIMP",
  description:
    "Guía del Portal del Cliente para reservar stands, firmar el contrato, hacer seguimiento y gestionar pagos.",
};

export default function ManualPage() {
  return (
    <div className="flex-1 bg-background">
      {/* Indice lateral FIJO (desktop) */}
      <aside className="fixed bottom-0 left-0 top-12 z-40 hidden w-72 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold text-primary">Manual del Exhibidor</span>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Portal de reservas IIMP
            </span>
          </span>
        </div>

        <nav aria-label="Secciones del manual" className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Contenido
          </p>
          <ManualNav secciones={MANUAL_TOC} />
        </nav>

        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-secondary p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
              <LifeBuoy className="h-3.5 w-3.5" />
              <span>¿Necesitas ayuda?</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Contacta a la Mesa de Ayuda del IIMP desde el aviso &quot;Protocolo de
              reserva&quot; del plano.
            </p>
            <Link
              href="/mapa"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary underline underline-offset-2"
            >
              <Map className="h-3 w-3" />
              <span>Ir al plano de stands</span>
            </Link>
          </div>
          <Image
            src="/iimp-logo.png"
            alt="IIMP"
            width={202}
            height={65}
            className="mx-auto mt-3 h-5 w-auto opacity-70"
          />
        </div>
      </aside>

      {/* Contenido (offset del sidebar fijo) */}
      <main className="min-w-0 lg:pl-72">
        <section className="border-b border-border bg-primary text-primary-foreground">
          <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-10">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-soft">
              Portal Oficial de Exhibidores
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Manual del Exhibidor
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
              Guía práctica para reservar stands, firmar el contrato de exhibición, hacer
              seguimiento de tu solicitud y gestionar tus pagos en los eventos del IIMP.
            </p>
            <p className="mt-1 text-[11px] text-primary-foreground/60">
              Versión 1.0 · Disponible en español e inglés (selector ES/EN del portal)
            </p>
          </div>
        </section>

        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-10">
          {/* Indice movil */}
          <details className="mb-5 rounded-lg border border-border bg-card lg:hidden">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-primary">
              Contenido del manual
            </summary>
            <div className="border-t border-border px-3 py-3">
              <ManualNav secciones={MANUAL_TOC} />
            </div>
          </details>

          <article
            className="manual-content rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8"
            /* El HTML se genera en build (scripts/build-manual-page.mjs) desde el Markdown del manual. */
            dangerouslySetInnerHTML={{ __html: MANUAL_HTML }}
          />
        </div>
      </main>
    </div>
  );
}
