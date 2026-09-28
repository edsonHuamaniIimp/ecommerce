import { VISTAS_BANDEJA, type VistaBandeja } from "@/lib/shared/constants";

const PREFIJO = "iimp-vista-bandeja";

/**
 * Persistencia de la vista (cuadricula/lista) de una bandeja.
 * Reutilizable: cada bandeja usa una clave propia y el usuario conserva su eleccion.
 */
export const vistaUtils = {
  /** Clave de localStorage para una bandeja. */
  key(bandeja: string): string {
    return `${PREFIJO}:${bandeja}`;
  },

  /** Vista guardada de la bandeja (o el valor por defecto). */
  get(bandeja: string, porDefecto: VistaBandeja = VISTAS_BANDEJA.GRID): VistaBandeja {
    if (typeof window === "undefined") return porDefecto;
    const valor = window.localStorage.getItem(this.key(bandeja));
    return valor === VISTAS_BANDEJA.GRID || valor === VISTAS_BANDEJA.ROW ? valor : porDefecto;
  },

  /** Guarda la vista elegida por el usuario. */
  set(bandeja: string, vista: VistaBandeja): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(this.key(bandeja), vista);
  },
};
