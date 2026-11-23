import { DD_MATRIZ_FILTRO_FECHA, type DdMatrizFiltroFecha } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";

export interface RangoFechaFiltro {
  fechaDesde?: string;
  fechaHasta?: string;
}

/** Suma dias a una fecha `AAAA-MM-DD` sin depender de la zona horaria. */
function sumarDias(fecha: string, dias: number): string {
  const [anio = 0, mes = 1, dia = 1] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/**
 * Rango `AAAA-MM-DD` (hora de Peru) de un atajo de fecha. `hoy` se puede fijar para pruebas.
 * Sin atajo (o "todos") no filtra; en "rango" se usan las fechas elegidas.
 */
export function rangoDeFiltroFecha(
  preset: DdMatrizFiltroFecha,
  rango: RangoFechaFiltro = {},
  hoy: string = dateUtils.todayLimaInputValue(),
): RangoFechaFiltro {
  switch (preset) {
    case DD_MATRIZ_FILTRO_FECHA.HOY:
      return { fechaDesde: hoy, fechaHasta: hoy };
    case DD_MATRIZ_FILTRO_FECHA.AYER: {
      const ayer = sumarDias(hoy, -1);
      return { fechaDesde: ayer, fechaHasta: ayer };
    }
    case DD_MATRIZ_FILTRO_FECHA.SEMANA:
      return { fechaDesde: sumarDias(hoy, -6), fechaHasta: hoy };
    case DD_MATRIZ_FILTRO_FECHA.MES:
      return { fechaDesde: `${hoy.slice(0, 8)}01`, fechaHasta: hoy };
    case DD_MATRIZ_FILTRO_FECHA.RANGO: {
      const desde = rango.fechaDesde || undefined;
      const hasta = rango.fechaHasta || undefined;
      /* Si el usuario las invierte, se ordenan para no devolver siempre vacio. */
      return desde && hasta && desde > hasta
        ? { fechaDesde: hasta, fechaHasta: desde }
        : { fechaDesde: desde, fechaHasta: hasta };
    }
    default:
      return {};
  }
}
