import { localeDeIdioma } from "./idioma";

const SIN_VALOR = "-";

/** Promedio de dias por mes usado para calcular fracciones de mes. */
export const DIAS_PROMEDIO_MES = 30.44;

/** Valor `YYYY-MM-DD` (hora local) de una fecha. */
function aInputValue(fecha: Date): string {
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mm}-${dd}`;
}

/** Convierte un valor a `Date` sin desfase de zona; null si es invalido. */
function aFecha(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : new Date(valor.getTime());
  }
  /* Fechas sin hora (YYYY-MM-DD): se interpretan en hora local para no mostrar el dia anterior. */
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (soloFecha) {
    const [, anio = "0", mes = "1", dia = "1"] = soloFecha;
    return new Date(+anio, +mes - 1, +dia);
  }
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Opciones comunes de formateo por idioma. */
interface OpcionesFecha {
  /** Idioma (es | en). Sin valor usa espanol (es-PE). */
  idioma?: string | null;
}

export const dateUtils = {
  /** Fecha actual (nueva instancia, segura para mutaciones controladas). */
  now(): Date {
    return new Date();
  },

  /** Fecha actual en formato ISO (UTC), para persistencia o marcas tecnicas. */
  nowIso(): string {
    return new Date().toISOString();
  },

  /** Convierte un valor a `Date`; null si es invalido. */
  toDate(valor: string | Date | null | undefined): Date | null {
    return aFecha(valor);
  },

  /** Serializa una fecha a ISO (UTC) para DTOs y persistencia tecnica. */
  toIso(fecha: Date): string {
    return fecha.toISOString();
  },

  /** true si el valor representa una fecha valida. */
  isValid(valor: string | Date | null | undefined): boolean {
    return aFecha(valor) !== null;
  },

  /** Inicio del dia (00:00 local) de una fecha. */
  startOfDay(fecha: Date): Date {
    const copia = new Date(fecha.getTime());
    copia.setHours(0, 0, 0, 0);
    return copia;
  },

  /** Suma dias a una fecha (nueva instancia). */
  addDays(fecha: Date, dias: number): Date {
    const copia = new Date(fecha.getTime());
    copia.setDate(copia.getDate() + dias);
    return copia;
  },

  /** Suma meses conservando el dia y ajustando al ultimo dia del mes. */
  addMonths(fecha: Date, meses: number): Date {
    const resultado = new Date(fecha.getTime());
    const dia = resultado.getDate();
    resultado.setDate(1);
    resultado.setMonth(resultado.getMonth() + meses);
    const ultimoDia = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
    resultado.setDate(Math.min(dia, ultimoDia));
    return resultado;
  },

  /** Dias completos entre dos fechas (hasta - desde); null si alguna es invalida. */
  diffInDays(desde: string | Date | null | undefined, hasta: string | Date | null | undefined): number | null {
    const inicio = aFecha(desde);
    const fin = aFecha(hasta);
    if (!inicio || !fin) return null;
    return Math.floor((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
  },

  /** Meses transcurridos entre dos fechas (fraccion decimal); null si alguna es invalida. */
  monthsBetween(desde: string | Date | null | undefined, hasta: string | Date | null | undefined): number | null {
    const dias = dateUtils.diffInDays(desde, hasta);
    if (dias === null) return null;
    return dias / DIAS_PROMEDIO_MES;
  },

  /** Milisegundos de una fecha; null si es invalida. */
  toMs(valor: string | Date | null | undefined): number | null {
    const fecha = aFecha(valor);
    return fecha ? fecha.getTime() : null;
  },

  /** true si `fecha` es posterior a `referencia`. */
  isAfter(fecha: string | Date | null | undefined, referencia: string | Date | null | undefined): boolean {
    const a = dateUtils.toMs(fecha);
    const b = dateUtils.toMs(referencia);
    return a !== null && b !== null && a > b;
  },

  /** true si `fecha` es igual o posterior a `referencia`. */
  isSameOrAfter(fecha: string | Date | null | undefined, referencia: string | Date | null | undefined): boolean {
    const a = dateUtils.toMs(fecha);
    const b = dateUtils.toMs(referencia);
    return a !== null && b !== null && a >= b;
  },

  /** true si `fecha` es anterior a `referencia`. */
  isBefore(fecha: string | Date | null | undefined, referencia: string | Date | null | undefined): boolean {
    const a = aFecha(fecha);
    const b = aFecha(referencia);
    if (!a || !b) return false;
    return a.getTime() < b.getTime();
  },

  /** Año de una fecha. */
  year(fecha: Date): number {
    return fecha.getFullYear();
  },

  /** Año actual. */
  currentYear(): number {
    return new Date().getFullYear();
  },

  /** Fecha (dd MMM yyyy) según el idioma. */
  format(iso: string | Date | null | undefined, opciones?: OpcionesFecha): string {
    if (!iso) return SIN_VALOR;
    /* Las fechas ISO (con o sin hora) se muestran por su dia calendario, sin desfase UTC. */
    if (typeof iso === "string") {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
      if (match) {
        const [, anio = "0", mes = "1", dia = "1"] = match;
        return new Date(+anio, +mes - 1, +dia).toLocaleDateString(localeDeIdioma(opciones?.idioma), {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
    }
    const fecha = aFecha(iso);
    if (!fecha) return SIN_VALOR;
    return fecha.toLocaleDateString(localeDeIdioma(opciones?.idioma), {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Lima",
    });
  },

  /** Fecha + hora según el idioma. La hora se muestra SIEMPRE en zona horaria de Perú
   *  (America/Lima): el servidor de prod corre en UTC y sin esto los mensajes/emails
   *  mostraban la hora UTC (p. ej. "01:30 p. m." en vez de "08:30 a. m."). */
  formatDateTime(iso: string | Date | null | undefined, opciones?: OpcionesFecha): string {
    if (!iso) return SIN_VALOR;
    const d = aFecha(iso);
    if (!d) return SIN_VALOR;
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
    const d = aFecha(iso);
    if (!d) return SIN_VALOR;
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
