import { localeDeIdioma } from "./idioma";

/** Opciones de formato de monto. */
interface OpcionesMonto {
  /** Idioma (es | en) para el separador de miles/decimales. Sin valor usa en-US (compatibilidad). */
  idioma?: string | null;
  /** Cantidad de decimales (default 0). */
  decimales?: number;
}

export const numberUtils = {
  /**
   * Numero con separador de miles (sin moneda), ej. "135,000" o "3,389.83".
   * Con `idioma` usa el locale del idioma (`es-PE` / `en-US`).
   */
  numero(valor: number, opciones?: OpcionesMonto): string {
    const locale = opciones?.idioma ? localeDeIdioma(opciones.idioma) : "en-US";
    const decimales = opciones?.decimales ?? 0;
    return valor.toLocaleString(locale, {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
  },

  /**
   * Monto con separador de miles y moneda (ej. "US$ 135,000" o "US$ 12,000.00").
   * Con `idioma` usa el locale del idioma (`es-PE` / `en-US`).
   */
  monto(valor: number, moneda: string, opciones?: OpcionesMonto): string {
    return `${moneda} ${this.numero(valor, opciones)}`;
  },

  /** Porcentaje con un decimal (ej. 37.5). Devuelve 0 si el total es 0. */
  porcentaje(parte: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((parte / total) * 1000) / 10;
  },
};
