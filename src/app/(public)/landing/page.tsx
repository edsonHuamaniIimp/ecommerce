import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  MousePointerClick,
  FileText,
  ShieldCheck,
  ClipboardCheck,
  Layers,
  BadgeCheck,
  Store,
} from "lucide-react";

/* Landing pública `/landing`.
 * Diseño: "Minimalism & Swiss Style" (designmd.app) — ver docs/03-arquitectura/DESIGN-landing.md.
 * Aplica SOLO a esta página. Colores: #000000 / #FFFFFF / #F5F1E8 / #808080 / #B38B6D.
 * Bordes rectos, grid, alto contraste, sin gradientes. */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#808080]">{children}</p>
  );
}

const PASOS = [
  { icon: Layers, titulo: "Elige el evento", desc: "Selecciona la edición ferial y define el pabellón o zona donde quieres exponer." },
  { icon: MousePointerClick, titulo: "Selecciona tus stands", desc: "Explora el plano 3D interactivo, revisa disponibilidad y arma tu selección en el carrito." },
  { icon: FileText, titulo: "Datos y documentos", desc: "Completa los datos comerciales, descarga el contrato y adjunta tu documentación firmada." },
  { icon: ClipboardCheck, titulo: "Revisión y cierre", desc: "Logística, Comunicación y Legal validan tu expediente hasta la emisión del contrato." },
];

const CAPACIDADES = [
  { icon: Store, titulo: "Plano 3D interactivo", desc: "Vista isométrica y macro por pabellones, con disponibilidad en tiempo real y selección múltiple." },
  { icon: FileText, titulo: "Expediente digital", desc: "Contrato, anexos e imágenes en un solo lugar, con trazabilidad de quién subió cada archivo." },
  { icon: ShieldCheck, titulo: "Revisión por áreas", desc: "Flujo institucional por Logística, Comunicación y Legal (SGC) con estados auditables." },
  { icon: BadgeCheck, titulo: "Seguimiento del trámite", desc: "Consulta el avance, adjunta lo pendiente y descarga tus documentos en cualquier momento." },
];

export default function LandingPage() {
  return (
    <main className="min-h-[100dvh] bg-white text-[#000000]">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-12 px-6 py-20 md:grid-cols-12 md:py-28">
        <div className="md:col-span-7">
          <SectionLabel>IIMP · Contratos de Stands</SectionLabel>
          <h1 className="mt-4 max-w-[20ch] text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Reserva tu stand en el plano interactivo
          </h1>
          <p className="mt-6 max-w-[58ch] text-base leading-relaxed text-[#808080] md:text-lg">
            Selecciona tus espacios sobre el plano 3D, completa tu expediente digital y sigue el
            trámite en línea hasta la firma del contrato con el IIMP.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/mapa"
              className="inline-flex items-center justify-center gap-2 rounded-none bg-[#000000] px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#B38B6D] active:translate-y-[1px]"
            >
              Ver el plano
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 rounded-none border border-[#808080] px-6 py-3 text-sm font-semibold text-[#000000] transition-colors duration-200 hover:bg-[#F5F1E8]"
            >
              Ingresar
            </Link>
          </div>
        </div>

        {/* Imagen comercial (convención) */}
        <div className="md:col-span-5">
          <div className="relative aspect-square w-full overflow-hidden border border-[#000000]/10">
            <Image
              src="https://picsum.photos/seed/iimp-convencion/1200/1200"
              alt="Convención minera"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover grayscale contrast-125"
            />
            <div className="absolute inset-0 bg-[#000000]/20" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-[#000000]/85 px-4 py-2.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white">Convención minera</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">Eventos IIMP</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── MÉTRICAS ─────────────────────────────────────────────────────── */}
      <section className="border-y border-[#000000]/10">
        <div className="mx-auto grid w-full max-w-[1280px] grid-cols-2 divide-[#000000]/10 px-6 md:grid-cols-4 md:divide-x">
          {[
            ["3D", "Plano isométrico interactivo"],
            ["100%", "Expediente digital"],
            ["3 áreas", "Revisión institucional"],
            ["24/7", "Seguimiento del trámite"],
          ].map(([n, t], i) => (
            <div key={t} className={`py-8 md:px-8 ${i % 2 === 1 ? "border-l border-[#000000]/10 md:border-l-0" : ""}`}>
              <p className="text-3xl font-bold tracking-tight">{n}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[#808080]">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[1280px] px-6 py-20 md:py-28">
        <SectionLabel>Cómo funciona</SectionLabel>
        <h2 className="mt-3 max-w-[24ch] text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          De la selección del stand al contrato, sin salir del portal
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-px bg-[#000000]/10 md:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((p, i) => (
            <div key={p.titulo} className="bg-white p-8">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold tabular-nums text-[#B38B6D]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p.icon className="h-5 w-5 text-[#000000]" />
              </div>
              <h3 className="mt-6 text-base font-semibold tracking-tight">{p.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#808080]">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PARA EXPOSITORES ─────────────────────────────────────────────── */}
      <section className="border-t border-[#000000]/10">
        <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-12 px-6 py-20 md:grid-cols-12 md:py-28">
          <div className="order-2 md:order-1 md:col-span-7">
            <div className="relative aspect-[4/3] w-full overflow-hidden border border-[#000000]/10">
              <Image
                src="https://picsum.photos/seed/iimp-expositores/1600/1200"
                alt="Expositores en una feria minera"
                fill
                sizes="(max-width: 768px) 100vw, 58vw"
                className="object-cover grayscale contrast-125"
              />
            </div>
          </div>
          <div className="order-1 md:order-2 md:col-span-5">
            <SectionLabel>Para expositores</SectionLabel>
            <h2 className="mt-3 max-w-[22ch] text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              Más visibilidad para tu empresa
            </h2>
            <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-[#808080]">
              Elige ubicaciones estratégicas dentro del recinto y asegura tu presencia en la convención
              minera más importante del país.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Ubicaciones por pabellón y metraje",
                "Disponibilidad en tiempo real",
                "Contrato y expediente en línea",
                "Acompañamiento comercial del IIMP",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 border-t border-[#000000]/10 pt-3 first:border-t-0 first:pt-0">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#B38B6D]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/mapa"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-none bg-[#000000] px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#B38B6D]"
            >
              Elegir mi ubicación
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CAPACIDADES (grid asimétrico) ────────────────────────────────── */}
      <section className="border-t border-[#000000]/10 bg-[#F5F1E8]">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-20 md:py-28">
          <SectionLabel>Qué incluye</SectionLabel>
          <h2 className="mt-3 max-w-[24ch] text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            Todo lo que necesitas para formalizar tu participación
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-12">
            {CAPACIDADES.map((c, i) => (
              <div
                key={c.titulo}
                className={`flex flex-col justify-between border border-[#000000]/10 bg-white p-8 ${
                  i % 3 === 0 ? "md:col-span-5" : i % 3 === 1 ? "md:col-span-7" : "md:col-span-12"
                }`}
              >
                <c.icon className="h-6 w-6 text-[#000000]" />
                <div className="mt-8">
                  <h3 className="text-lg font-semibold tracking-tight">{c.titulo}</h3>
                  <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-[#808080]">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <section className="bg-[#000000]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start justify-between gap-8 px-6 py-20 md:flex-row md:items-center md:py-24">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#B38B6D]">Empieza ahora</p>
            <h2 className="mt-3 max-w-[28ch] text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
              Reserva tus stands para la próxima edición
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/mapa"
              className="inline-flex items-center justify-center gap-2 rounded-none bg-white px-6 py-3 text-sm font-semibold text-[#000000] transition-colors duration-200 hover:bg-[#F5F1E8]"
            >
              Ir al plano
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-none border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/10"
            >
              Ingresar al portal
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#000000]/10">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-none bg-[#000000] px-2 py-1 text-[11px] font-bold tracking-wider text-white">IIMP</span>
            <span className="text-sm font-semibold tracking-tight">Contratos Stands</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-8 gap-y-3 text-xs uppercase tracking-[0.15em] text-[#808080]">
            <Link href="/mapa" className="transition-colors hover:text-[#000000]">Plano</Link>
            <Link href="/presala" className="transition-colors hover:text-[#000000]">Eventos</Link>
            <Link href="/auth/login" className="transition-colors hover:text-[#000000]">Ingresar</Link>
          </nav>
          <p className="text-xs text-[#808080]">
            © {new Date().getFullYear()} Instituto de Ingenieros de Minas del Perú
          </p>
        </div>
      </footer>
    </main>
  );
}
