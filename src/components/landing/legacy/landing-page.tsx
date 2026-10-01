import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Store, Sparkles, Handshake } from "lucide-react";

/* Landing comercial `/landing`.
 * Diseño: "Minimalism & Swiss Style" (designmd.app) — ver docs/03-arquitectura/DESIGN-landing.md.
 * Objetivo: COMERCIAL (sin proceso ni info tecnica). Hero con composicion grid (geometrica).
 * Colores: #000000 / #FFFFFF / #F5F1E8 / #808080 / #B38B6D. Bordes rectos, alto contraste. */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#808080]">{children}</p>;
}

const BENEFICIOS = [
  { icon: MapPin, titulo: "Ubicaciones estratégicas", desc: "Espacios en los pabellones de mayor tránsito y visibilidad del recinto." },
  { icon: Store, titulo: "Metrajes a tu medida", desc: "Desde módulos compactos hasta islas y espacios preferenciales." },
  { icon: Sparkles, titulo: "Máxima visibilidad", desc: "Tu marca frente a miles de profesionales y empresas del sector minero." },
  { icon: Handshake, titulo: "Acompañamiento comercial", desc: "Un equipo del IIMP te asesora para elegir la mejor ubicación." },
];

export default function LandingPage() {
  return (
    <main className="flex-1 bg-white text-[#000000]">
      {/* ── HERO (composicion grid) ──────────────────────────────────────── */}
      <section className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-12 px-6 py-20 md:grid-cols-12 md:py-28">
        <div className="md:col-span-6">
          <SectionLabel>IIMP · Convención minera</SectionLabel>
          <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Tu marca en el corazón de la convención minera
          </h1>
          <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-[#808080] md:text-lg">
            Reserva tu espacio en el recinto ferial más importante del país y destaca frente a miles de
            profesionales, empresas y líderes del sector.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/mapa"
              className="inline-flex items-center justify-center gap-2 rounded-none bg-[#000000] px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#B38B6D] active:translate-y-[1px]"
            >
              Reservar mi espacio
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/presala"
              className="inline-flex items-center justify-center rounded-none border border-[#808080] px-6 py-3 text-sm font-semibold text-[#000000] transition-colors duration-200 hover:bg-[#F5F1E8]"
            >
              Ver eventos
            </Link>
          </div>
        </div>

        {/* Composición geométrica (grid) */}
        <div className="md:col-span-6">
          <div className="relative aspect-square w-full border border-[#000000]/10 bg-[#F5F1E8]">
            <div className="absolute inset-6 grid grid-cols-3 grid-rows-3 gap-2">
              <div className="col-span-2 row-span-2 bg-[#000000]" />
              <div className="relative overflow-hidden border border-[#000000]/10">
                <Image src="/landing/grid-a.jpg" alt="Expositores en la convención" fill sizes="15vw" className="object-cover grayscale contrast-125" />
              </div>
              <div className="bg-[#B38B6D]" />
              <div className="relative overflow-hidden border border-[#000000]/10">
                <Image src="/landing/grid-b.jpg" alt="Stand en la feria minera" fill sizes="15vw" className="object-cover grayscale contrast-125" />
              </div>
              <div className="row-span-2 bg-[#000000]/85" />
              <div className="col-span-2 border border-[#000000]/10 bg-[#FFFFFF]" />
            </div>
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between border-t border-[#000000]/10 pt-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#808080]">Pabellones</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#808080]">Stands · Red comercial</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFICIOS ───────────────────────────────────────────────────── */}
      <section className="border-t border-[#000000]/10 bg-[#F5F1E8]">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-20 md:py-28">
          <SectionLabel>Para expositores</SectionLabel>
          <h2 className="mt-3 max-w-[26ch] text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            Todo para que tu presencia destaque
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-px bg-[#000000]/10 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFICIOS.map((b) => (
              <div key={b.titulo} className="bg-white p-8">
                <b.icon className="h-6 w-6 text-[#B38B6D]" />
                <h3 className="mt-6 text-base font-semibold tracking-tight">{b.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#808080]">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ESPACIOS (grid de bloques) ───────────────────────────────────── */}
      <section className="border-t border-[#000000]/10">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-20 md:py-28">
          <SectionLabel>Espacios</SectionLabel>
          <h2 className="mt-3 max-w-[24ch] text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            Una ubicación para cada objetivo
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-12">
            {[
              { nombre: "Módulo", desc: "Ideal para primeras participaciones y marcas que buscan presencia directa.", span: "md:col-span-4" },
              { nombre: "Estándar", desc: "Equilibrio entre visibilidad y metraje para consolidar tu marca.", span: "md:col-span-4" },
              { nombre: "Isla / Preferencial", desc: "Máxima exposición en zonas de alto tránsito y esquinas estratégicas.", span: "md:col-span-4" },
            ].map((e) => (
              <div key={e.nombre} className={`border border-[#000000]/10 ${e.span}`}>
                <div className="aspect-[4/3] bg-[#F5F1E8] p-6">
                  <div className="grid h-full grid-cols-3 grid-rows-3 gap-1.5">
                    <div className="col-span-2 row-span-2 bg-[#000000]" />
                    <div className="bg-[#FFFFFF] border border-[#000000]/10" />
                    <div className="bg-[#B38B6D]" />
                    <div className="col-span-3 bg-[#FFFFFF] border border-[#000000]/10" />
                  </div>
                </div>
                <div className="border-t border-[#000000]/10 p-6">
                  <h3 className="text-lg font-semibold tracking-tight">{e.nombre}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#808080]">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALERIA ──────────────────────────────────────────────────────── */}
      <section className="border-t border-[#000000]/10 bg-[#F5F1E8]">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-20 md:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionLabel>Galería</SectionLabel>
              <h2 className="mt-3 max-w-[26ch] text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                Vive la convención minera
              </h2>
            </div>
            <p className="max-w-[42ch] text-sm leading-relaxed text-[#808080]">
              Un recinto con miles de visitantes, empresas líderes del sector y oportunidades de negocio.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-12">
            {[
              { src: "/landing/gal-1.jpg", cls: "md:col-span-5 aspect-[4/3]" },
              { src: "/landing/gal-2.jpg", cls: "md:col-span-7 aspect-[16/10]" },
              { src: "/landing/gal-3.jpg", cls: "md:col-span-7 aspect-[16/10]" },
              { src: "/landing/gal-4.jpg", cls: "md:col-span-5 aspect-[4/3]" },
            ].map((g) => (
              <div key={g.src} className={`relative overflow-hidden border border-[#000000]/10 ${g.cls}`}>
                <Image
                  src={g.src}
                  alt="Convención minera"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover grayscale contrast-125 transition-transform duration-300 hover:scale-[1.02]"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <section className="bg-[#000000]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start justify-between gap-8 px-6 py-20 md:flex-row md:items-center md:py-24">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#B38B6D]">Asegura tu lugar</p>
            <h2 className="mt-3 max-w-[28ch] text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
              Reserva hoy el espacio de tu empresa
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/mapa"
              className="inline-flex items-center justify-center gap-2 rounded-none bg-white px-6 py-3 text-sm font-semibold text-[#000000] transition-colors duration-200 hover:bg-[#F5F1E8]"
            >
              Ver ubicaciones
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
            <Link href="/mapa" className="transition-colors hover:text-[#000000]">Ubicaciones</Link>
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
