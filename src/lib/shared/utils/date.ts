import { localeDeIdioma } from "./idioma";

const SIN_VALOR = "-";

/** Valor `YYYY-MM-DD` (hora local) de una fecha. */
function aInputValue(fecha: Date): string {
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mm}-${dd}`;
}

/** Opciones comunes de formateo por idioma. */
interface OpcionesFecha {
  /** Idioma (es | en). Sin valor usa espanol (es-PE). */
  idioma?: string | null;
}

export const dateUtils = {
  /** Fecha (dd MMM yyyy) según el idioma. */
  format(iso: string | null | undefined, opciones?: OpcionesFecha): string {
    if (!iso) return SIN_VALOR;
    /* Se parsea en local (sin desfase UTC) y solo si la fecha es valida. */
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!match) return SIN_VALOR;
    const [y = "0", m = "1", d = "1"] = match.slice(1);
    return new Date(+y, +m - 1, +d).toLocaleDateString(localeDeIdioma(opciones?.idioma), {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  },

  /** Fecha + hora según el idioma. La hora se muestra SIEMPRE en zona horaria de Perú
   *  (America/Lima): el servidor de prod corre en UTC y sin esto los mensajes/emails
   *  mostraban la hora UTC (p. ej. "01:30 p. m." en vez de "08:30 a. m."). */
  formatDateTime(iso: string | Date | null | undefined, opciones?: OpcionesFecha): string {
    if (!iso) return SIN_VALOR;
    const d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return SIN_VALOR;
    return d.toLocaleDateString(localeDeIdioma(opciones?.idioma), {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Lima",
    });
  },

  /** Fecha + hora sin anio (para historiales compactos), según el idioma (hora de Perú). */
  formatDateTimeShort(iso: string | Date | null | undefined, opciones?: OpcionesFecha): string {
    if (!iso) return SIN_VALOR;
    const d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return SIN_VALOR;
    return d.toLocaleDateString(localeDeIdioma(opciones?.idioma), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Lima",
    });
  },

  toInputValue(iso: string | null | undefined): string {
    if (!iso) return "";
    return iso.slice(0, 10);
  },

  /** Valor `YYYY-MM-DD` para un `<input type="date">` de una fecha (hora local). */
  inputValue(fecha: Date): string {
    return aInputValue(fecha);
  },

  /** Valor `YYYY-MM-DD` para un `<input type="date">` con la fecha de hoy (hora local). */
  todayInputValue(): string {
    return aInputValue(new Date());
  },

  extractYear(iso: string): number {
    return new Date(iso).getFullYear();
  },
};
