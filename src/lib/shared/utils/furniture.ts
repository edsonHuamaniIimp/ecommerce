import {
  FURNITURE_FOOTPRINT,
  PISO_FURNITURE_DEFAULT,
  PERSONA_COLORES_CABEZA,
  PERSONA_FURNITURE_DEFAULT,
  TIPOS_FURNITURE,
  type PisoFurnitureConfig,
  type PersonaFurnitureConfig,
} from "@/lib/shared/constants";

function normalizarRefId(tipo: string): string {
  return (
    tipo
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 44) || "DECOR"
  );
}

function normalizarPisoConfig(config: unknown): PisoFurnitureConfig {
  const c = (config ?? {}) as Partial<PisoFurnitureConfig>;
  const w = typeof c.w === "number" && Number.isFinite(c.w) && c.w > 0.1 ? c.w : PISO_FURNITURE_DEFAULT.w;
  const d = typeof c.d === "number" && Number.isFinite(c.d) && c.d > 0.1 ? c.d : PISO_FURNITURE_DEFAULT.d;
  return { w, d };
}

export const furnitureUtils = {
  /** RefId unico para un componente decorativo: KIOSKO-01, PLAZA-01, PERSONA-01... */
  refIdSugerido(tipo: string, existentes: Iterable<string> = []): string {
    const base = normalizarRefId(tipo);
    const usados = new Set(Array.from(existentes, (r) => r.trim().toUpperCase()));
    for (let n = 1; n < 100; n++) {
      const candidato = `${base}-${String(n).padStart(2, "0")}`;
      if (!usados.has(candidato)) return candidato;
    }
    return `${base}-${Date.now().toString().slice(-4)}`;
  },

  /** Config inicial segun el tipo de componente (Persona y Piso tienen config). */
  configPorDefecto(tipo: string): unknown {
    if (tipo === TIPOS_FURNITURE.PERSONA) return { ...PERSONA_FURNITURE_DEFAULT };
    if (tipo === TIPOS_FURNITURE.PISO) return { ...PISO_FURNITURE_DEFAULT };
    return undefined;
  },

  /** Normaliza el config de un Piso con defaults ante datos invalidos o legacy. */
  pisoConfig: normalizarPisoConfig,

  /** Huella (w, d) de un componente, resolviendo el tamano configurado del Piso. */
  huella(tipo: string, config?: unknown): { w: number; d: number } {
    if (tipo === TIPOS_FURNITURE.PISO) return normalizarPisoConfig(config);
    return FURNITURE_FOOTPRINT[tipo] ?? { w: 2, d: 2 };
  },

  /** Normaliza el config de una Persona con defaults ante datos invalidos o legacy. */
  personaConfig(config: unknown): PersonaFurnitureConfig {
    const c = (config ?? {}) as Partial<PersonaFurnitureConfig>;
    const colorIdx =
      typeof c.colorIdx === "number" && Number.isFinite(c.colorIdx) && c.colorIdx >= 0
        ? Math.floor(c.colorIdx) % PERSONA_COLORES_CABEZA.length
        : PERSONA_FURNITURE_DEFAULT.colorIdx;
    return {
      colorIdx,
      torsoColor: typeof c.torsoColor === "string" && c.torsoColor ? c.torsoColor : PERSONA_FURNITURE_DEFAULT.torsoColor,
      piernasColor: typeof c.piernasColor === "string" && c.piernasColor ? c.piernasColor : PERSONA_FURNITURE_DEFAULT.piernasColor,
    };
  },
};
