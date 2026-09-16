"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Home } from "lucide-react";

/* ================================================================
   VOLADURA CONTROLADA — 404 interactivo IIMP
   Máquina de estados: idle → igniting → exploding → revealed
   ================================================================ */

type Phase = "idle" | "igniting" | "exploding" | "revealed";

/**
 * PRNG determinístico (mulberry32) — genera los mismos "aleatorios"
 * en servidor y cliente, evitando hydration mismatch en SSR.
 */
function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = (rng: () => number, min: number, max: number) =>
  min + rng() * (max - min);

/* Geometría de la roca intacta (silueta irregular tipo peñasco) */
const ROCK_CLIP =
  "polygon(6% 12%, 18% 4%, 38% 8%, 55% 2%, 74% 6%, 90% 14%, 96% 32%, " +
  "93% 52%, 97% 72%, 88% 90%, 68% 96%, 47% 92%, 26% 97%, 10% 88%, 3% 68%, 7% 45%, 2% 26%)";

/* Cable de detonación: curva en S desde el detonador hasta la roca */
const FUSE_PATH =
  "M100 400 C 132 340 70 280 100 218 C 126 165 78 96 100 0";

/* ----------------------------------------------------------------
   Polvo flotante ambiental (bucle suave)
   ---------------------------------------------------------------- */
function BackgroundDust() {
  const motes = useMemo(() => {
    const rng = createSeededRandom(1337);
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: `${rand(rng, 5, 95)}%`,
      top: `${rand(rng, 8, 90)}%`,
      size: rand(rng, 2, 4.5),
      drift: rand(rng, 25, 70),
      duration: rand(rng, 5, 10),
      delay: rand(rng, 0, 4),
    }));
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {motes.map((m) => (
        <motion.span
          key={m.id}
          className="absolute rounded-full bg-amber-200/10"
          style={{ left: m.left, top: m.top, width: m.size, height: m.size }}
          animate={{ y: [0, -m.drift, 0], opacity: [0.05, 0.35, 0.05] }}
          transition={{
            duration: m.duration,
            repeat: Infinity,
            delay: m.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------
   Pared de roca intacta (idle / igniting / exploding)
   ---------------------------------------------------------------- */
function RockWall() {
  return (
    <motion.div
      className="relative h-[54vh] w-[min(92vw,640px)]"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 1.18,
        filter: "blur(12px)",
        transition: { duration: 0.4, ease: "easeOut" },
      }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Cuerpo principal */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950"
        style={{ clipPath: ROCK_CLIP }}
      />
      {/* Textura granulada */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          clipPath: ROCK_CLIP,
          backgroundImage:
            "radial-gradient(circle at 24% 30%, #71717a 1px, transparent 1px)," +
            "radial-gradient(circle at 62% 58%, #52525b 1.5px, transparent 1.5px)," +
            "radial-gradient(circle at 42% 78%, #3f3f46 1px, transparent 1px)",
          backgroundSize: "26px 26px, 19px 19px, 33px 33px",
        }}
      />
      {/* Vetas de oro */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M55 95 Q125 118 185 68 T325 105" fill="none" stroke="#f59e0b" strokeWidth="1.8" opacity="0.4" />
        <path d="M55 98 Q125 121 185 71 T325 108" fill="none" stroke="#fde68a" strokeWidth="0.7" opacity="0.3" />
        <path d="M95 185 Q160 160 235 218 T365 165" fill="none" stroke="#d97706" strokeWidth="1.3" opacity="0.35" />
        <path d="M35 235 Q105 255 170 215 T295 248" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.25" />
        <path d="M135 45 Q200 35 255 78 T395 62" fill="none" stroke="#fbbf24" strokeWidth="0.8" opacity="0.28" />
        <circle cx="160" cy="82" r="2.5" fill="#f59e0b" opacity="0.4" />
        <circle cx="292" cy="98" r="2" fill="#fbbf24" opacity="0.3" />
        <circle cx="205" cy="192" r="2.2" fill="#f59e0b" opacity="0.3" />
        <circle cx="98" cy="242" r="1.5" fill="#fde68a" opacity="0.25" />
      </svg>
      {/* Luz de borde */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          clipPath: ROCK_CLIP,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 38%, transparent 62%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </motion.div>
  );
}

/* ----------------------------------------------------------------
   Roca agrietada (revealed) — dos mitades separadas con fisura de oro
   ---------------------------------------------------------------- */
function CrackedWall() {
  const spring = { type: "spring" as const, stiffness: 70, damping: 15, mass: 1.1 };

  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="relative h-[54vh] w-[min(92vw,640px)]">
        {/* Mitad izquierda */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950"
          style={{
            clipPath:
              "polygon(0% 8%, 14% 2%, 34% 6%, 52% 0%, 54% 22%, 46% 44%, 55% 68%, 47% 92%, 52% 100%, 0% 100%)",
            filter: "drop-shadow(14px 0 18px rgba(251,191,36,0.28))",
          }}
          initial={{ x: 0, rotate: 0, opacity: 0 }}
          animate={{ x: -36, rotate: -2.4, opacity: 1 }}
          transition={spring}
        />
        {/* Mitad derecha */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-bl from-zinc-700 via-zinc-800 to-zinc-950"
          style={{
            clipPath:
              "polygon(56% 0%, 76% 4%, 92% 12%, 100% 26%, 100% 100%, 50% 100%, 57% 74%, 46% 50%, 55% 26%)",
            filter: "drop-shadow(-14px 0 18px rgba(251,191,36,0.28))",
          }}
          initial={{ x: 0, rotate: 0, opacity: 0 }}
          animate={{ x: 36, rotate: 2.4, opacity: 1 }}
          transition={spring}
        />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Detonador de minas — base negra + manija ámbar industrial
   ---------------------------------------------------------------- */
function DetonatorButton({
  phase,
  onDetonate,
}: {
  phase: Phase;
  onDetonate: () => void;
}) {
  const isIdle = phase === "idle";

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24, transition: { duration: 0.22, ease: "easeIn" } }}
      transition={{ delay: 0.5, type: "spring", stiffness: 180, damping: 20 }}
    >
      <motion.button
        type="button"
        aria-label="Iniciar voladura"
        onClick={onDetonate}
        disabled={!isIdle}
        className="group relative flex cursor-pointer flex-col items-center outline-none disabled:cursor-default"
        animate={isIdle ? { scale: [1, 1.02, 1] } : { scale: 1 }}
        transition={
          isIdle
            ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.15 }
        }
        whileTap={isIdle ? { scale: 0.96 } : undefined}
      >
        {/* Manija (baja al detonar) */}
        <motion.div
          className="relative z-20 h-10 w-24 rounded-t-lg border border-amber-300/60 bg-amber-500 shadow-[0_0_22px_rgba(245,158,11,0.45)]"
          animate={{ y: isIdle ? 0 : 20 }}
          transition={{ type: "spring", stiffness: 900, damping: 22 }}
        >
          <div className="absolute inset-x-3 top-1.5 h-1 rounded-full bg-amber-200/70" />
          <div className="absolute inset-x-3 top-4 h-1 rounded-full bg-amber-700/50" />
          <div className="absolute inset-x-3 top-6.5 h-1 rounded-full bg-amber-700/50" />
        </motion.div>

        {/* Vástago */}
        <div className="z-10 h-2.5 w-4 bg-zinc-600" />

        {/* Base */}
        <div className="relative z-10 w-44 rounded-md border-2 border-zinc-600 bg-zinc-900 px-4 pb-3 pt-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.7)]">
          {/* Tornillos */}
          <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-zinc-500" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-zinc-500" />
          <span className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-zinc-500" />
          <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-zinc-500" />

          {/* LED de estado */}
          <motion.span
            className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
            animate={{
              backgroundColor: isIdle ? "#ef4444" : "#f59e0b",
              boxShadow: isIdle
                ? "0 0 8px 2px rgba(239,68,68,0.7)"
                : "0 0 10px 3px rgba(245,158,11,0.8)",
              opacity: isIdle ? [1, 0.35, 1] : 1,
            }}
            transition={
              isIdle
                ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.2 }
            }
          />

          {/* Placa */}
          <div className="border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-center">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">
              Carga N°404
            </span>
          </div>
        </div>
      </motion.button>

      {/* Invitación */}
      <motion.p
        className="mt-5 font-mono text-xs font-bold uppercase tracking-[0.35em] text-amber-400/90"
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        Iniciar Voladura (Click)
      </motion.p>
    </motion.div>
  );
}

/* ----------------------------------------------------------------
   Mecha (SVG pathLength) + chispa que recorre el mismo path
   ---------------------------------------------------------------- */
function FuseAndSpark() {
  return (
    <motion.div
      className="pointer-events-none absolute bottom-full left-1/2 z-20 h-[400px] w-[200px] -translate-x-1/2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      aria-hidden
    >
      <svg viewBox="0 0 200 400" className="h-full w-full" fill="none">
        {/* Cable sin encender */}
        <path d={FUSE_PATH} stroke="#3f3f46" strokeWidth="3" strokeLinecap="round" />
        {/* Línea de fuego */}
        <motion.path
          d={FUSE_PATH}
          stroke="#fbbf24"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.72, ease: "easeIn" }}
          style={{ filter: "drop-shadow(0 0 6px rgba(251,191,36,0.9))" }}
        />
      </svg>

      {/* Chispa viajera (sigue el mismo path con offset-path) */}
      <motion.div
        className="absolute left-0 top-0 h-5 w-5 rounded-full"
        style={{
          offsetPath: `path("${FUSE_PATH}")`,
          background:
            "radial-gradient(circle, #fffbeb 0%, #fde68a 35%, #f59e0b 65%, transparent 75%)",
          boxShadow:
            "0 0 18px 6px rgba(251,191,36,0.9), 0 0 50px 20px rgba(249,115,22,0.5)",
        }}
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: "100%" }}
        transition={{ duration: 0.72, ease: "easeIn" }}
      />
    </motion.div>
  );
}

/* ----------------------------------------------------------------
   Flash de luz blanco a pantalla completa (300ms)
   ---------------------------------------------------------------- */
function ScreenFlash() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-50 bg-white"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      aria-hidden
    />
  );
}

/* ----------------------------------------------------------------
   Fragmentos de la voladura — rocas (polígonos) + humo (blur)
   ---------------------------------------------------------------- */
interface Fragment {
  id: number;
  isSmoke: boolean;
  size: number;
  x: number;
  y: number;
  rotate: number;
  duration: number;
  delay: number;
  clipPath?: string;
  className: string;
}

function ParticleExplosion() {
  const fragments = useMemo<Fragment[]>(() => {
    const rng = createSeededRandom(9001);
    return Array.from({ length: 18 }, (_, i) => {
      const isSmoke = i >= 12;
      const jagged = `polygon(${Array.from({ length: 6 })
        .map(() => `${rand(rng, 5, 95).toFixed(0)}% ${rand(rng, 5, 95).toFixed(0)}%`)
        .join(", ")})`;

      return {
        id: i,
        isSmoke,
        size: isSmoke ? rand(rng, 28, 64) : rand(rng, 6, 18),
        x: rand(rng, -400, 400),
        y: rand(rng, -400, 400),
        rotate: rand(rng, 0, 720),
        duration: rand(rng, 0.7, 1.1),
        delay: rand(rng, 0, 0.08),
        clipPath: isSmoke ? undefined : jagged,
        className: isSmoke
          ? "rounded-full bg-zinc-500/40 blur-md"
          : ["bg-zinc-600", "bg-zinc-700", "bg-zinc-800", "bg-amber-900/80"][
              Math.floor(rand(rng, 0, 4))
            ],
      };
    });
  }, []);

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2 z-30"
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      aria-hidden
    >
      {fragments.map((f) => (
        <motion.div
          key={f.id}
          className={`absolute ${f.className}`}
          style={{
            width: f.size,
            height: f.isSmoke ? f.size * 0.7 : f.size,
            clipPath: f.clipPath,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            x: f.x,
            y: f.y,
            rotate: f.rotate,
            opacity: 0,
            scale: f.isSmoke ? 2.4 : 0.35,
          }}
          transition={{
            duration: f.duration,
            delay: f.delay,
            ease: [0.12, 0.8, 0.35, 1],
          }}
        />
      ))}
    </motion.div>
  );
}

/* ----------------------------------------------------------------
   Contenido revelado — 404 de oro hirviendo + copywriting + escape
   ---------------------------------------------------------------- */
const GLOW_CALM =
  "0 0 50px rgba(251,191,36,0.45), 0 0 22px rgba(249,115,22,0.55), 0 0 6px rgba(254,243,199,0.9)";
const GLOW_BLAZE =
  "0 0 110px rgba(251,191,36,0.8), 0 0 42px rgba(249,115,22,0.85), 0 0 14px rgba(254,243,199,1)";

const revealVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.35 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 170, damping: 20 },
  },
};

function RevealedContent() {
  const sparkles = useMemo(() => {
    const rng = createSeededRandom(777);
    return Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: Math.cos((i / 10) * Math.PI * 2) * rand(rng, 70, 150),
      y: Math.sin((i / 10) * Math.PI * 2) * rand(rng, 50, 110),
      duration: rand(rng, 2.2, 4),
      delay: rand(rng, 0.4, 1.4),
    }));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      {/* Roca agrietada al fondo */}
      <CrackedWall />

      {/* Núcleo incandescente en la fisura */}
      <motion.div
        className="absolute h-72 w-72 rounded-full bg-amber-500/20 blur-3xl"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        aria-hidden
      />
      <motion.div
        className="absolute h-44 w-44 rounded-full bg-amber-400/25 blur-2xl"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
        aria-hidden
      />

      {/* Bloque de texto con stagger */}
      <motion.div
        className="pointer-events-none relative z-10 flex flex-col items-center px-6 text-center"
        variants={revealVariants}
        initial="hidden"
        animate="show"
      >
        {/* 404 — oro hirviendo */}
        <div className="relative">
          <motion.span
            className="block select-none text-[15vw] font-black leading-none tracking-tight text-transparent"
            style={{ WebkitTextStroke: "3px #f59e0b" }}
            initial={{ scale: 0.55, opacity: 0, filter: "blur(10px)" }}
            animate={{
              scale: 1,
              opacity: 1,
              filter: "blur(0px)",
              textShadow: [GLOW_CALM, GLOW_BLAZE, GLOW_CALM],
            }}
            transition={{
              scale: { type: "spring", stiffness: 110, damping: 13, delay: 0.15 },
              opacity: { duration: 0.35, delay: 0.15 },
              filter: { duration: 0.45, delay: 0.15 },
              textShadow: { duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 0.9 },
            }}
          >
            404
          </motion.span>

          {/* Chispas de oro orbitando */}
          {sparkles.map((s) => (
            <motion.span
              key={s.id}
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-amber-300"
              initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
              animate={{
                opacity: [0, 0.9, 0],
                x: s.x,
                y: s.y,
                scale: [0, 1, 0],
              }}
              transition={{
                duration: s.duration,
                delay: s.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              aria-hidden
            />
          ))}
        </div>

        <motion.h2
          variants={itemVariants}
          className="mt-6 max-w-2xl text-xl font-bold tracking-tight text-amber-100 md:text-2xl"
        >
          ¡Voladura fallida! Veta de datos no encontrada.
        </motion.h2>

        <motion.p
          variants={itemVariants}
          className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400 md:text-base"
        >
          La excavación no encontró información en esta cota topográfica. El
          túnel está vacío.
        </motion.p>

        {/* Botón de escape */}
        <motion.div variants={itemVariants} className="pointer-events-auto mt-10">
          <Link
            href="/"
            className="group relative inline-flex items-center gap-3 border-2 border-amber-500/70 bg-zinc-900/70 px-8 py-4 font-mono text-xs font-bold uppercase tracking-[0.25em] text-amber-200 no-underline transition-colors duration-300 hover:border-amber-400 hover:text-amber-100 md:text-sm"
          >
            <Home className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
            <span>Regresar al Plano General</span>

            {/* LEDs de esquina (se encienden en hover) */}
            <span className="absolute -left-1 -top-1 h-2 w-2 bg-amber-500/0 transition-all duration-300 group-hover:bg-amber-400 group-hover:shadow-[0_0_10px_3px_rgba(251,191,36,0.8)]" />
            <span className="absolute -right-1 -top-1 h-2 w-2 bg-amber-500/0 transition-all duration-300 group-hover:bg-amber-400 group-hover:shadow-[0_0_10px_3px_rgba(251,191,36,0.8)]" />
            <span className="absolute -bottom-1 -left-1 h-2 w-2 bg-amber-500/0 transition-all duration-300 group-hover:bg-amber-400 group-hover:shadow-[0_0_10px_3px_rgba(251,191,36,0.8)]" />
            <span className="absolute -bottom-1 -right-1 h-2 w-2 bg-amber-500/0 transition-all duration-300 group-hover:bg-amber-400 group-hover:shadow-[0_0_10px_3px_rgba(251,191,36,0.8)]" />

            {/* Resplandor general */}
            <span className="absolute inset-0 opacity-0 shadow-[0_0_35px_rgba(251,191,36,0.35)] transition-opacity duration-300 group-hover:opacity-100" />
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ----------------------------------------------------------------
   Humo residual post-voladura
   ---------------------------------------------------------------- */
function SmokeWisps() {
  const wisps = useMemo(() => {
    const rng = createSeededRandom(4242);
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      left: `${22 + i * 11 + rand(rng, -3, 3)}%`,
      width: 60 + i * 18,
      height: 32 + i * 10,
      duration: 4 + i * 0.8,
      delay: i * 0.6,
    }));
  }, []);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
      exit={{ opacity: 0 }}
      aria-hidden
    >
      {wisps.map((w) => (
        <motion.div
          key={w.id}
          className="absolute top-[48%] rounded-full bg-zinc-500/10 blur-xl"
          style={{ left: w.left, width: w.width, height: w.height }}
          initial={{ opacity: 0.18, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -170, scale: 2.2 }}
          transition={{
            duration: w.duration,
            delay: w.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </motion.div>
  );
}

/* ================================================================
   PÁGINA — orquestación de la máquina de estados
   ================================================================ */

export default function NotFoundPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const timeouts = useRef<number[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(
    () => () => {
      timeouts.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const detonate = useCallback(() => {
    if (phase !== "idle") return;

    if (prefersReducedMotion) {
      setPhase("revealed");
      return;
    }

    setPhase("igniting");
    timeouts.current.push(window.setTimeout(() => setPhase("exploding"), 800));
    timeouts.current.push(window.setTimeout(() => setPhase("revealed"), 1400));
  }, [phase, prefersReducedMotion]);

  const showIntactRock =
    phase === "idle" || phase === "igniting" || phase === "exploding";

  return (
    <main className="relative h-dvh w-full select-none overflow-hidden bg-zinc-950">
      {/* Profundidad de caverna */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(24,24,27,0.25) 0%, rgba(9,9,11,0.8) 55%, rgba(9,9,11,0.96) 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 200px 90px rgba(0,0,0,0.55)" }}
        aria-hidden
      />

      <BackgroundDust />

      {/* Escena con camera shake */}
      <motion.div
        className="absolute inset-0"
        animate={
          phase === "exploding"
            ? {
                x: [0, -15, 20, -10, 5, -2, 0],
                y: [0, 10, -15, 8, -5, 0],
              }
            : { x: 0, y: 0 }
        }
        transition={{ duration: 0.4 }}
      >
        {/* Pared de roca */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence>
            {showIntactRock && <RockWall key="rock-wall" />}
          </AnimatePresence>
        </div>

        {/* Fragmentos de la voladura */}
        <AnimatePresence>
          {phase === "exploding" && <ParticleExplosion key="fragments" />}
        </AnimatePresence>

        {/* 404 revelado */}
        <AnimatePresence>
          {phase === "revealed" && <RevealedContent key="revealed" />}
        </AnimatePresence>
      </motion.div>

      {/* Humo residual */}
      <AnimatePresence>
        {phase === "revealed" && <SmokeWisps key="smoke" />}
      </AnimatePresence>

      {/* UI inferior: detonador + mecha */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center pb-10">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent"
          aria-hidden
        />
        <div className="relative">
          <AnimatePresence>
            {phase === "igniting" && <FuseAndSpark key="fuse" />}
          </AnimatePresence>
          <AnimatePresence>
            {(phase === "idle" || phase === "igniting") && (
              <DetonatorButton
                key="detonator"
                phase={phase}
                onDetonate={detonate}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Flash de la explosión (por encima de todo) */}
      <AnimatePresence>
        {phase === "exploding" && <ScreenFlash key="flash" />}
      </AnimatePresence>
    </main>
  );
}
