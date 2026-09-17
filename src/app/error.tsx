"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Power, AlertTriangle } from "lucide-react";

const IS_PROD = process.env.NEXT_PUBLIC_APP_ENV === "production";

/* ================================================================
   Dev error display — full stack trace, no creative page
   ================================================================ */
function DevErrorDisplay({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-300 font-mono p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-400" />
          <h1 className="text-xl font-bold text-red-400">Error del Servidor (500)</h1>
        </div>
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
          <p className="text-sm text-red-300 font-semibold mb-2">{error.message}</p>
          {error.stack && (
            <pre className="text-xs text-zinc-500 overflow-auto max-h-[400px] whitespace-pre-wrap border-t border-red-900/30 pt-3 mt-3">
              {error.stack}
            </pre>
          )}
        </div>
        {error.digest && (
          <p className="text-xs text-zinc-600">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="rounded bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}

/* ================================================================
   APAGON EN LA CASA DE FUERZA — Error 500 interactivo IIMP (PROD)
   Maquina de estados: idle → cranking → short_circuit → blackout
   ================================================================ */

type Phase = "idle" | "cranking" | "short_circuit" | "blackout";

const CRANK_MS = 1500;
const FLASH_MS = 400;

/**
 * PRNG determinístico (mulberry32) — mismos valores en servidor y
 * cliente, evita hydration mismatch en SSR.
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

/* Keyframes como constantes de módulo — identidad estable */
const PANEL_HUM = { x: [0, 0.5, 0, -0.5, 0], y: 0 };
const PANEL_CRANK = {
  x: [0, -1, 1, -2, 2, -3, 3, -5, 5, -7, 7, -9, 9, -11, 11],
  y: [0, 1, -1, 2, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -6],
};
const PANEL_JOLT = {
  x: [0, -16, 13, -8, 4, 0],
  y: [0, 7, -9, 4, -2, 0],
};
const NEEDLE_IDLE = { rotate: [-28, -22, -28] };
const NEEDLE_WILD = { rotate: [-45, 35, -15, 50, -30, 55] };
const NEEDLE_PEGGED = { rotate: 60 };
const SIGN_SWAY = { rotate: [15, 13.2, 15, 16.8, 15] };
const NEON_BROKEN = {
  opacity: [1, 0.35, 1, 0.7, 0.12, 1, 0.9, 0.45, 1],
};
const EMERGENCY_PULSE = { opacity: [0.3, 0.8, 0.3] };

const GREEN = "#22c55e";
const ORANGE = "#f97316";
const GREEN_GLOW = "0 0 8px 2px rgba(34,197,94,0.8)";
const ORANGE_GLOW = "0 0 10px 3px rgba(249,115,22,0.85)";

/* ----------------------------------------------------------------
   Medidor analógico (aguja reacciona a la fase)
   ---------------------------------------------------------------- */
function Gauge({ phase, mirror }: { phase: Phase; mirror?: boolean }) {
  const state =
    phase === "cranking"
      ? NEEDLE_WILD
      : phase === "short_circuit"
        ? NEEDLE_PEGGED
        : NEEDLE_IDLE;

  return (
    <div className="relative h-16 w-16 rounded-full border-2 border-zinc-500 bg-zinc-900 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
      {/* Ticks */}
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 h-1.5 w-0.5 bg-zinc-500"
          style={{
            transform: `translate(-50%, -50%) rotate(${-60 + i * 30}deg) translateY(-24px)`,
          }}
        />
      ))}
      {/* Aguja */}
      <motion.div
        className="absolute bottom-1/2 left-1/2 h-6 w-0.5 origin-bottom rounded-full bg-red-400"
        style={{ x: "-50%", rotate: mirror ? 28 : -28 }}
        animate={state}
        transition={
          phase === "cranking"
            ? { duration: CRANK_MS / 1000, ease: "linear" }
            : phase === "short_circuit"
              ? { type: "spring", stiffness: 500, damping: 15 }
              : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-400" />
    </div>
  );
}

/* ----------------------------------------------------------------
   LED indicador (verde → parpadeo naranja en cranking → rojo)
   ---------------------------------------------------------------- */
function IndicatorLed({ phase, index }: { phase: Phase; index: number }) {
  if (phase === "cranking") {
    return (
      <motion.span
        className="h-3 w-3 rounded-full"
        animate={{
          backgroundColor: [GREEN, ORANGE],
          boxShadow: [GREEN_GLOW, ORANGE_GLOW],
        }}
        transition={{
          duration: 0.28,
          repeat: Infinity,
          repeatType: "mirror",
          delay: index * 0.11,
        }}
      />
    );
  }

  return (
    <motion.span
      className="h-3 w-3 rounded-full"
      animate={{
        backgroundColor: phase === "short_circuit" ? "#ef4444" : GREEN,
        boxShadow:
          phase === "short_circuit"
            ? "0 0 10px 3px rgba(239,68,68,0.9)"
            : GREEN_GLOW,
      }}
      transition={{ duration: 0.15 }}
    />
  );
}

/* ----------------------------------------------------------------
   Interruptor tipo breaker (salta en el cortocircuito)
   ---------------------------------------------------------------- */
function BreakerSwitch({ phase }: { phase: Phase }) {
  const tripped = phase === "short_circuit" || phase === "blackout";

  return (
    <div className="flex h-16 w-8 items-center justify-center rounded-sm border border-zinc-600 bg-zinc-800 shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)]">
      <motion.span
        className="h-6 w-4 rounded-[2px] bg-zinc-400 shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
        animate={tripped ? { y: 10, rotate: 14 } : { y: -8, rotate: 0 }}
        transition={{ type: "spring", stiffness: 600, damping: 16 }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------
   Panel eléctrico industrial + botón verde de reset
   ---------------------------------------------------------------- */
function GeneratorPanel({
  phase,
  onReset,
}: {
  phase: Phase;
  onReset: () => void;
}) {
  const isIdle = phase === "idle";

  return (
    <motion.div
      className="relative"
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      animate={
        phase === "cranking"
          ? PANEL_CRANK
          : phase === "short_circuit"
            ? PANEL_JOLT
            : PANEL_HUM
      }
      transition={
        phase === "cranking"
          ? { duration: CRANK_MS / 1000, ease: "linear" }
          : phase === "short_circuit"
            ? { duration: FLASH_MS / 1000 }
            : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
      }
    >
      {/* Gabinete */}
      <div className="relative w-[300px] rounded-lg border-4 border-zinc-600 bg-gradient-to-b from-zinc-600 to-zinc-700 p-5 shadow-[0_30px_60px_rgba(0,0,0,0.6)]">
        {/* Placa superior */}
        <div className="mb-4 border border-zinc-500/60 bg-zinc-800 px-3 py-1.5 text-center">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-300">
            Casa de Fuerza · GEN-04 · 480V
          </span>
        </div>

        {/* Medidores */}
        <div className="mb-4 flex justify-center gap-4">
          <Gauge phase={phase} />
          <Gauge phase={phase} mirror />
        </div>

        {/* Banco de LEDs */}
        <div className="mb-4 flex items-center justify-between rounded-sm border border-zinc-600/70 bg-zinc-800/80 px-4 py-2.5">
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <IndicatorLed key={i} phase={phase} index={i} />
            ))}
          </div>
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-500">
            Bus A-B-C-D
          </span>
        </div>

        {/* Breakers */}
        <div className="mb-4 flex justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <BreakerSwitch key={i} phase={phase} />
          ))}
        </div>

        {/* Rejilla de ventilación */}
        <div className="mb-5 space-y-1.5 px-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-1 rounded-full bg-zinc-800/90" />
          ))}
        </div>

        {/* Botón hongo verde de RESET */}
        <div className="flex justify-center pb-1">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-zinc-600 bg-zinc-800 shadow-[inset_0_3px_8px_rgba(0,0,0,0.7)]">
            <motion.button
              type="button"
              onClick={onReset}
              disabled={!isIdle}
              aria-label="Reiniciar sistema de ventilación y energía"
              className="relative h-14 w-14 cursor-pointer rounded-full border-b-4 border-green-800 bg-green-500 outline-none disabled:cursor-not-allowed"
              animate={
                isIdle
                  ? {
                      scale: [1, 1.04, 1],
                      boxShadow: [
                        "0 0 18px 2px rgba(34,197,94,0.5)",
                        "0 0 30px 6px rgba(34,197,94,0.75)",
                        "0 0 18px 2px rgba(34,197,94,0.5)",
                      ],
                    }
                  : { scale: 0.9, y: 3, boxShadow: "0 0 6px 1px rgba(34,197,94,0.3)" }
              }
              transition={
                isIdle
                  ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  : { type: "spring", stiffness: 700, damping: 24 }
              }
            >
              <span className="absolute inset-x-3 top-2 h-2 rounded-full bg-green-300/70" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Patas del gabinete */}
      <div className="mx-auto flex w-[260px] justify-between">
        <span className="h-5 w-4 bg-zinc-600" />
        <span className="h-5 w-4 bg-zinc-600" />
      </div>

      {/* Leyenda */}
      <p className="mx-auto mt-4 max-w-[280px] text-center font-mono text-[10px] font-bold uppercase leading-relaxed tracking-[0.25em] text-zinc-400">
        Reiniciar sistema de ventilación y energía
      </p>
    </motion.div>
  );
}

/* ----------------------------------------------------------------
   Chispas eléctricas (30 partículas, trayectorias irregulares)
   ---------------------------------------------------------------- */
interface Spark {
  id: number;
  isCircle: boolean;
  size: number;
  length: number;
  x: number;
  y: number;
  baseRotate: number;
  spin: number;
  duration: number;
  delay: number;
  color: string;
  glow: string;
}

function SparksBurst() {
  const sparks = useMemo<Spark[]>(() => {
    const rng = createSeededRandom(555);
    return Array.from({ length: 30 }, (_, i) => {
      const isCircle = i % 4 === 3;
      const angle = rng() * Math.PI * 2;
      const dist = rand(rng, 140, 430);
      const isYellow = rng() > 0.45;
      return {
        id: i,
        isCircle,
        size: rand(rng, 3, 6),
        length: rand(rng, 10, 30),
        x: Math.cos(angle) * dist + rand(rng, -40, 40),
        y: Math.sin(angle) * dist + rand(rng, -30, 60),
        baseRotate: rand(rng, 0, 360),
        spin: rand(rng, 180, 720),
        duration: rand(rng, 0.4, 0.75),
        delay: rand(rng, 0, 0.1),
        color: isYellow ? "#fde047" : "#22d3ee",
        glow: isYellow
          ? "0 0 8px 2px rgba(253,224,71,0.9)"
          : "0 0 8px 2px rgba(34,211,238,0.9)",
      };
    });
  }, []);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[44%] z-40"
      aria-hidden
    >
      {sparks.map((s) => (
        <motion.span
          key={s.id}
          className="absolute"
          style={{
            width: s.isCircle ? s.size : s.length,
            height: s.isCircle ? s.size : 2,
            borderRadius: s.isCircle ? "50%" : 1,
            backgroundColor: s.color,
            boxShadow: s.glow,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: s.baseRotate, scale: 1 }}
          animate={{
            x: s.x,
            y: s.y,
            rotate: s.baseRotate + s.spin,
            opacity: [1, 1, 0],
            scale: [1, 1, 0.2],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            ease: [0.1, 0.7, 0.4, 1],
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------
   Flash ciego de cortocircuito (150ms a pleno blanco)
   ---------------------------------------------------------------- */
function FlashOverlay() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-50 bg-white"
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: FLASH_MS / 1000, times: [0, 0.375, 1] }}
      aria-hidden
    />
  );
}

/* ----------------------------------------------------------------
   Foco de emergencia rojo (sirena giratoria simulada)
   ---------------------------------------------------------------- */
function EmergencyLight({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.55) 0%, rgba(220,38,38,0.15) 45%, transparent 78%)",
      }}
      animate={reduced ? { opacity: 0.55 } : EMERGENCY_PULSE}
      transition={
        reduced
          ? { duration: 0.3 }
          : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
      }
      aria-hidden
    />
  );
}

/* ----------------------------------------------------------------
   El 500 colgando torcido — neón roto en el último dígito
   ---------------------------------------------------------------- */
function Hanging500({ reduced }: { reduced: boolean }) {
  const strokeGray = {
    WebkitTextStroke: "3px #52525b",
    color: "transparent",
  } as const;

  return (
    <motion.div
      className="flex flex-col items-center"
      style={{ transformOrigin: "50% 0%" }}
      initial={{ y: -80, opacity: 0, rotate: 15 }}
      animate={
        reduced
          ? { y: 0, opacity: 1, rotate: 15 }
          : { y: 0, opacity: 1, ...SIGN_SWAY }
      }
      transition={
        reduced
          ? { duration: 0.3 }
          : {
              y: { type: "spring", stiffness: 90, damping: 14 },
              opacity: { duration: 0.4 },
              rotate: { duration: 5.2, repeat: Infinity, ease: "easeInOut" },
            }
      }
    >
      {/* Cable */}
      <div className="h-[9vh] w-[3px] bg-gradient-to-b from-zinc-500 to-zinc-600" />
      {/* Grapa */}
      <div className="h-3 w-8 rounded-sm border border-zinc-600 bg-zinc-700" />
      {/* Dígitos */}
      <div className="flex items-start leading-none">
        <span
          className="select-none text-[16vw] font-black md:text-[12vw]"
          style={strokeGray}
        >
          5
        </span>
        <span
          className="select-none text-[16vw] font-black md:text-[12vw]"
          style={strokeGray}
        >
          0
        </span>
        <motion.span
          className="select-none text-[16vw] font-black md:text-[12vw]"
          style={{
            ...strokeGray,
            textShadow: "0 0 22px rgba(239,68,68,0.45), 0 0 8px rgba(239,68,68,0.6)",
          }}
          animate={reduced ? { opacity: 1 } : NEON_BROKEN}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        >
          0
        </motion.span>
      </div>
    </motion.div>
  );
}

/* ----------------------------------------------------------------
   Copywriting + botón de emergencia (fase blackout)
   ---------------------------------------------------------------- */
const blackoutVariants = {
  hidden: {},
  show: (reduced: boolean) => ({
    transition: { staggerChildren: 0.15, delayChildren: reduced ? 0.1 : 0.5 },
  }),
};

const blackoutItemVariants = {
  hidden: { opacity: 0, y: 24, filter: "blur(5px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 160, damping: 20 },
  },
};

function BlackoutContent({
  error,
  reduced,
  onReset,
}: {
  error: Error & { digest?: string };
  reduced: boolean;
  onReset: () => void;
}) {
  return (
    <>
      <motion.div
        className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center px-6 pb-[9vh] text-center"
        variants={blackoutVariants}
        custom={reduced}
        initial="hidden"
        animate="show"
      >
        <motion.h2
          variants={blackoutItemVariants}
          className="max-w-2xl text-xl font-bold tracking-tight text-zinc-300 md:text-2xl"
          style={{ textShadow: "0 0 24px rgba(220,38,38,0.25)" }}
        >
          ¡Cortocircuito! Apagón en la Casa de Fuerza.
        </motion.h2>

        <motion.p
          variants={blackoutItemVariants}
          className="mt-3 max-w-md text-sm leading-relaxed text-zinc-500 md:text-base"
        >
          Nuestros servidores principales volaron un fusible. La cuadrilla de
          mantenimiento de software ya bajó con los repuestos.
        </motion.p>

        <motion.div variants={blackoutItemVariants} className="mt-9">
          <button
            type="button"
            onClick={onReset}
            className="group inline-flex cursor-pointer items-center gap-3 border-2 border-red-700 bg-red-800 px-8 py-4 font-mono text-xs font-bold uppercase tracking-[0.25em] text-red-100 transition-all duration-200 hover:border-red-500 hover:bg-red-600 hover:text-white hover:shadow-[0_0_45px_rgba(220,38,38,0.7)] active:scale-95 md:text-sm"
          >
            <Power className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
            Intentar nuevamente
          </button>
        </motion.div>
      </motion.div>

      {/* Referencia de falla */}
      <motion.span
        className="absolute bottom-3 left-4 z-30 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Fault_Ref · {error.digest ?? "GEN-04"} · 480V
      </motion.span>
    </>
  );
}

/* ================================================================
   ERROR BOUNDARY — orquestación de la máquina de estados
   ================================================================ */

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const timeouts = useRef<number[]>([]);
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion === true;

  // Log error in production
  useEffect(() => {
    if (IS_PROD) {
      fetch("/api/errors/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          digest: error.digest,
          url: window.location.href,
        }),
      }).catch(() => {});
    }
  }, [error]);

  useEffect(
    () => () => {
      timeouts.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const attemptRestart = useCallback(() => {
    if (phase !== "idle") return;

    if (reduced) {
      setPhase("blackout");
      return;
    }

    setPhase("cranking");
    timeouts.current.push(
      window.setTimeout(() => setPhase("short_circuit"), CRANK_MS),
    );
    timeouts.current.push(
      window.setTimeout(() => setPhase("blackout"), CRANK_MS + FLASH_MS),
    );
  }, [phase, reduced]);

  // Dev: show full error details
  if (!IS_PROD) {
    return <DevErrorDisplay error={error} reset={reset} />;
  }

  const dark = phase === "blackout";

  return (
    <main
      className={`relative h-dvh w-full select-none overflow-hidden ${
        dark ? "bg-black" : "bg-zinc-800"
      }`}
    >
      {/* ============ ESCENA ILUMINADA (idle / cranking / short_circuit) ============ */}
      <AnimatePresence>
        {!dark && (
          <motion.div
            key="lit-scene"
            className="absolute inset-0 flex flex-col items-center justify-center"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            {/* Luz de trabajo cálida */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.09) 0%, transparent 55%)",
              }}
              aria-hidden
            />
            {/* Sombra de piso */}
            <div
              className="absolute bottom-[16%] left-1/2 h-8 w-[380px] -translate-x-1/2 rounded-[50%] bg-black/50 blur-md"
              aria-hidden
            />
            {/* Conduits de fondo */}
            <div className="absolute left-[18%] top-0 h-full w-3 bg-zinc-700/50" aria-hidden />
            <div className="absolute right-[18%] top-0 h-full w-3 bg-zinc-700/50" aria-hidden />

            <GeneratorPanel phase={phase} onReset={attemptRestart} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ CHISPAS (nacen en short_circuit, viven en blackout) ============ */}
      {(phase === "short_circuit" || phase === "blackout") && !reduced && (
        <SparksBurst />
      )}

      {/* ============ FLASH CIEGO ============ */}
      <AnimatePresence>
        {phase === "short_circuit" && <FlashOverlay key="flash" />}
      </AnimatePresence>

      {/* ============ BLACKOUT ============ */}
      <AnimatePresence>
        {dark && (
          <motion.div
            key="blackout"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
          >
            <EmergencyLight reduced={reduced} />

            {/* Letrero colgante */}
            <div className="absolute inset-x-0 top-0 z-20 flex justify-center">
              <Hanging500 reduced={reduced} />
            </div>

            <BlackoutContent error={error} reduced={reduced} onReset={reset} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
