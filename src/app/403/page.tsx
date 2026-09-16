"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CreditCard, ScanFace, ShieldAlert } from "lucide-react";

/* ================================================================
   CONTROL DE ACCESO Y BLOQUEO — 403 interactivo IIMP
   Máquina de estados: idle → scanning → denied → lockdown
   ================================================================ */

type Phase = "idle" | "scanning" | "denied" | "lockdown";

/* Primer cruce del spring (stiffness 100 / damping 12 / mass 2) ≈ 320ms */
const GATE_IMPACT_MS = 320;

/* Keyframes como constantes — identidad estable, no se reinician en re-renders */
const DENIED_SHAKE = { x: [0, -5, 5, -5, 5, 0], y: 0 };
const IMPACT_SHAKE = {
  x: [0, -18, 14, -8, 4, 0],
  y: [0, 12, -8, 5, -2, 0],
};
const REST_POSE = { x: 0, y: 0 };
const LASER_SWEEP = { y: [-20, 20, -20] };
const NEON_FLICKER = { opacity: [1, 0.82, 1, 0.9, 1, 0.72, 1] };

const STATUS_TEXT: Record<Phase, string> = {
  idle: "SISTEMA EN LÍNEA — ACERQUE SU FOTOCHECK",
  scanning: "LEYENDO CREDENCIAL…",
  denied: "CREDENCIAL RECHAZADA",
  lockdown: "BLOQUEO TOTAL ACTIVADO",
};

/* ----------------------------------------------------------------
   Fondo: rejilla metálica sutil
   ---------------------------------------------------------------- */
function MetalGridBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(rgba(161,161,170,0.5) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(161,161,170,0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 180px 80px rgba(0,0,0,0.55)" }}
        aria-hidden
      />
    </>
  );
}

/* ----------------------------------------------------------------
   Puerta de socavón entreabierta (escenario)
   ---------------------------------------------------------------- */
function TunnelDoor({ phase }: { phase: Phase }) {
  const denied = phase === "denied" || phase === "lockdown";

  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="relative flex flex-col items-center">
        {/* Señal */}
        <div className="mb-3 border border-zinc-700 bg-zinc-900/80 px-4 py-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
            Socavón N°7 — Nivel -403
          </span>
        </div>

        {/* Boca del túnel */}
        <div className="relative h-[36vh] max-h-[360px] w-[240px] overflow-hidden rounded-t-[120px] border-[10px] border-zinc-700 bg-zinc-950 shadow-[0_20px_60px_rgba(0,0,0,0.7)] md:w-[280px]">
          {/* Resplandor interior (ámbar → rojo en alarma) */}
          <motion.div
            className="absolute inset-0"
            animate={{
              background: denied
                ? "radial-gradient(ellipse at 65% 60%, rgba(239,68,68,0.4) 0%, rgba(239,68,68,0.08) 45%, transparent 75%)"
                : "radial-gradient(ellipse at 65% 60%, rgba(245,158,11,0.35) 0%, rgba(245,158,11,0.06) 45%, transparent 75%)",
            }}
            transition={{ duration: 0.25 }}
          />

          {/* Puerta de acero entreabierta (cubre la izquierda, deja la rendija) */}
          <div className="absolute left-0 top-0 h-full w-[68%] border-r-4 border-zinc-600 bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800">
            {/* Ribs de la puerta */}
            <div className="absolute inset-y-0 left-4 w-1 bg-zinc-800/70" />
            <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-zinc-800/70" />
            {/* Rueda de apertura */}
            <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-zinc-500">
              <div className="absolute left-1/2 top-1/2 h-1 w-full -translate-x-1/2 -translate-y-1/2 bg-zinc-500" />
              <div className="absolute left-1/2 top-1/2 h-full w-1 -translate-x-1/2 -translate-y-1/2 bg-zinc-500" />
            </div>
            {/* Placa de peligro */}
            <div className="absolute left-1/2 top-6 -translate-x-1/2 border border-yellow-500/50 bg-zinc-900 px-2 py-0.5">
              <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-yellow-500/80">
                Peligro
              </span>
            </div>
          </div>
        </div>

        {/* Umbral */}
        <div className="h-2 w-[300px] bg-gradient-to-b from-zinc-600 to-zinc-800 md:w-[340px]" />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Láser de escaneo (azul → rojo sangre en denied)
   ---------------------------------------------------------------- */
function ScanLaser({ denied }: { denied: boolean }) {
  return (
    <motion.div
      className="absolute left-3 right-3 top-1/2 h-[3px] rounded-full"
      animate={LASER_SWEEP}
      transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
      style={{
        backgroundColor: denied ? "#ef4444" : "#38bdf8",
        boxShadow: denied
          ? "0 0 12px 3px rgba(239,68,68,0.95), 0 0 32px 10px rgba(239,68,68,0.45)"
          : "0 0 12px 3px rgba(56,189,248,0.95), 0 0 32px 10px rgba(56,189,248,0.45)",
      }}
      aria-hidden
    />
  );
}

/* ----------------------------------------------------------------
   Panel del escáner de fotocheck
   ---------------------------------------------------------------- */
function ScannerPanel({
  phase,
  onScan,
}: {
  phase: Phase;
  onScan: () => void;
}) {
  const isIdle = phase === "idle";
  const isScanning = phase === "scanning";
  const isDenied = phase === "denied";
  const alarmed = isDenied || phase === "lockdown";

  return (
    <motion.div
      className={`relative w-[300px] rounded-xl border-2 bg-zinc-800/90 p-4 backdrop-blur-sm transition-colors duration-150 ${
        alarmed
          ? "border-red-500/70 shadow-[0_0_35px_rgba(239,68,68,0.3)]"
          : "border-cyan-500/40 shadow-[0_0_30px_rgba(34,211,238,0.15)]"
      }`}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24, transition: { duration: 0.2 } }}
      transition={{ delay: 0.4, type: "spring", stiffness: 180, damping: 20 }}
    >
      {/* Ranura de tarjeta */}
      <div className="mx-auto mb-3 h-1.5 w-24 rounded-full bg-zinc-950 shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]" />

      {/* Ventana de escaneo */}
      <div
        className={`relative mb-4 h-24 overflow-hidden rounded-md border transition-colors duration-150 ${
          alarmed ? "border-red-500/50 bg-red-950/20" : "border-zinc-700 bg-zinc-900/90"
        }`}
      >
        {/* Retícula */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(56,189,248,0.3) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(56,189,248,0.3) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
          aria-hidden
        />

        {/* Idle: ícono palpitante / scanning+denied: láser */}
        {isIdle && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <ScanFace className="h-10 w-10 text-cyan-400" />
            </motion.div>
          </div>
        )}
        {(isScanning || isDenied) && <ScanLaser denied={isDenied} />}
      </div>

      {/* Botón principal */}
      <motion.button
        type="button"
        onClick={onScan}
        disabled={!isIdle}
        aria-label="Escanear fotocheck"
        className={`flex w-full items-center justify-center gap-2.5 rounded-md border-2 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.2em] transition-colors duration-150 ${
          alarmed
            ? "cursor-not-allowed border-red-500/60 bg-red-950/40 text-red-400"
            : "border-cyan-400/60 bg-cyan-950/40 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.35)] hover:bg-cyan-900/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]"
        }`}
        animate={{ scale: isIdle ? 1 : 0.95 }}
        transition={{ type: "spring", stiffness: 700, damping: 28 }}
      >
        <CreditCard className="h-4 w-4" />
        Escanear Fotocheck
      </motion.button>

      {/* Línea de estado */}
      <p
        className={`mt-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.25em] ${
          alarmed ? "text-red-400" : "text-cyan-500/70"
        }`}
      >
        {STATUS_TEXT[phase]}
        <motion.span
          className="ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-current"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </p>
    </motion.div>
  );
}

/* ----------------------------------------------------------------
   Destello de alarma (viñeta roja pulsante durante denied)
   ---------------------------------------------------------------- */
function AlarmFlash() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.75, 0, 0.75, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, times: [0, 0.25, 0.5, 0.75, 1] }}
      style={{ boxShadow: "inset 0 0 140px 40px rgba(239,68,68,0.4)" }}
      aria-hidden
    />
  );
}

/* ----------------------------------------------------------------
   Contenido estampado sobre la compuerta (403 + copy + escape)
   ---------------------------------------------------------------- */
const gateContentVariants = {
  hidden: {},
  show: (reduced: boolean) => ({
    transition: { staggerChildren: 0.16, delayChildren: reduced ? 0.15 : 0.85 },
  }),
};

const gateItemVariants = {
  hidden: { opacity: 0, y: 26, filter: "blur(5px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 170, damping: 20 },
  },
};

function GateContent({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center px-6 text-center"
      variants={gateContentVariants}
      custom={reduced}
      initial="hidden"
      animate="show"
    >
      {/* 403 — aerosol rojo / neón parpadeante */}
      <div className="relative -rotate-3">
        {/* Halo de aerosol */}
        <motion.span
          className="absolute inset-0 select-none text-[16vw] font-black leading-none tracking-tight text-red-500/50 blur-[6px]"
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            delay: reduced ? 0 : 0.55,
            type: "spring",
            stiffness: 260,
            damping: 18,
          }}
          aria-hidden
        >
          403
        </motion.span>
        {/* Núcleo */}
        <motion.span
          className="relative block select-none text-[16vw] font-black leading-none tracking-tight text-red-500"
          style={{
            textShadow:
              "0 0 14px rgba(239,68,68,0.9), 0 0 45px rgba(239,68,68,0.55), 0 0 90px rgba(239,68,68,0.35)",
          }}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: NEON_FLICKER.opacity }}
          transition={{
            scale: {
              delay: reduced ? 0 : 0.55,
              type: "spring",
              stiffness: 260,
              damping: 18,
            },
            opacity: {
              delay: reduced ? 0.3 : 1.3,
              duration: 2.8,
              repeat: Infinity,
              ease: "linear",
            },
          }}
        >
          403
        </motion.span>
      </div>

      <motion.h2
        variants={gateItemVariants}
        className="mt-8 max-w-2xl text-xl font-bold tracking-tight text-zinc-100 md:text-2xl"
      >
        ¡Acceso Restringido! Zona de alto riesgo.
      </motion.h2>

      <motion.p
        variants={gateItemVariants}
        className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400 md:text-base"
      >
        Tu nivel de seguridad no autoriza el ingreso a este socavón.
        Comunícate con el Jefe de Guardia.
      </motion.p>

      <motion.div variants={gateItemVariants} className="pointer-events-auto mt-10">
        <a
          href="mailto:soporte@iimp.org.pe?subject=Solicitud%20de%20permiso%20—%20Socav%C3%B3n%20Nivel%20403"
          className="group relative inline-flex items-center gap-3 border-2 border-red-500 bg-transparent px-8 py-4 font-mono text-xs font-bold uppercase tracking-[0.25em] text-red-400 no-underline transition-colors duration-200 hover:bg-red-500 hover:text-zinc-950 hover:shadow-[0_0_35px_rgba(239,68,68,0.5)] md:text-sm"
        >
          <ShieldAlert className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
          <span>Solicitar Permiso</span>
        </a>
      </motion.div>
    </motion.div>
  );
}

/* ----------------------------------------------------------------
   Compuerta de acero — cae con física de resorte pesada
   ---------------------------------------------------------------- */
function SteelGate({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      className="absolute inset-0 z-40 overflow-hidden bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800"
      initial={{ y: reduced ? 0 : "-100vh" }}
      animate={{ y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: "spring", stiffness: 100, damping: 12, mass: 2 }
      }
    >
      {/* Costuras verticales de planchas */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0px, transparent 118px, rgba(0,0,0,0.35) 118px, rgba(0,0,0,0.35) 122px)",
        }}
        aria-hidden
      />

      {/* Vigas horizontales con remaches */}
      {[18, 62].map((top) => (
        <div
          key={top}
          className="absolute inset-x-0 flex h-12 items-center justify-between border-y-2 border-zinc-800/80 bg-zinc-800/50 px-8"
          style={{ top: `${top}%` }}
          aria-hidden
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full bg-zinc-500/70 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.6)]"
            />
          ))}
        </div>
      ))}

      {/* Brillo superior del filo */}
      <div className="absolute inset-x-0 top-0 h-2 bg-zinc-400/40" aria-hidden />

      {/* Franjas de peligro — borde inferior */}
      <div
        className="absolute inset-x-0 bottom-0 h-8"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, #eab308 0px, #eab308 20px, #09090b 20px, #09090b 40px)",
        }}
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-8 h-1 bg-zinc-950/80" aria-hidden />

      {/* Sombra interior de peso */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 -60px 80px rgba(0,0,0,0.5)" }}
        aria-hidden
      />

      <GateContent reduced={reduced} />
    </motion.div>
  );
}

/* ================================================================
   PÁGINA — orquestación de la máquina de estados
   ================================================================ */

export default function ForbiddenPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [impacted, setImpacted] = useState(false);
  const timeouts = useRef<number[]>([]);
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion === true;

  useEffect(
    () => () => {
      timeouts.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const scan = useCallback(() => {
    if (phase !== "idle") return;

    if (reduced) {
      setPhase("lockdown");
      setImpacted(false);
      return;
    }

    setPhase("scanning");
    timeouts.current.push(window.setTimeout(() => setPhase("denied"), 1200));
    timeouts.current.push(window.setTimeout(() => setPhase("lockdown"), 1700));
    timeouts.current.push(
      window.setTimeout(() => setImpacted(true), 1700 + GATE_IMPACT_MS),
    );
  }, [phase, reduced]);

  return (
    <main className="relative h-dvh w-full select-none overflow-hidden bg-zinc-900">
      <MetalGridBackground />

      {/* Escena con camera shake (denied corto / impacto fuerte) */}
      <motion.div
        className="absolute inset-0"
        animate={
          phase === "denied" ? DENIED_SHAKE : impacted ? IMPACT_SHAKE : REST_POSE
        }
        transition={{ duration: phase === "denied" ? 0.4 : 0.5 }}
      >
        <TunnelDoor phase={phase} />

        {/* Panel del escáner */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center pb-10">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-zinc-900 via-zinc-900/70 to-transparent"
            aria-hidden
          />
          <div className="relative">
            <AnimatePresence>
              {phase !== "lockdown" && (
                <ScannerPanel key="scanner" phase={phase} onScan={scan} />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Alarma roja durante denied */}
        <AnimatePresence>
          {phase === "denied" && <AlarmFlash key="alarm" />}
        </AnimatePresence>

        {/* Compuerta de acero */}
        {phase === "lockdown" && <SteelGate reduced={reduced} />}
      </motion.div>
    </main>
  );
}
