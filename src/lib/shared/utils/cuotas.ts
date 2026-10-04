import { MODOS_PAGO } from "@/lib/shared/constants";
import { dateUtils } from "./date";
import { redondear2 } from "./importes";

/** Cuota del cronograma del contrato (Anexo 2). */
export interface CuotaPlan {
  numero: number;
  porcentaje: number;
  monto: number;
  /** Fecha de vencimiento ISO (yyyy-mm-dd) o null si no aplica. */
  fechaVencimiento: string | null;
}

/** Suma dias calendario a una fecha y devuelve ISO (yyyy-mm-dd) en hora local. */
export function sumarDias(fecha: Date, dias: number): string {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Siguiente fecha por defecto: primera cuota a 30 dias de hoy y cada siguiente a los
 * 45 dias de la anterior (referencia del Anexo 2); el cliente puede editarla.
 */
export function siguienteFechaCuota(fechaPrevia: string | null, hoy: Date = new Date()): string {
  if (!fechaPrevia) return sumarDias(hoy, 30);
  return sumarDias(new Date(`${fechaPrevia}T00:00:00`), 45);
}

/** Montos por cuota: la ultima absorbe el resto para que la suma sea exactamente el total. */
function montosDeCuotas(montoTotal: number, porcentajes: number[]): number[] {
  const montos: number[] = [];
  let acumulado = 0;
  porcentajes.forEach((porcentaje, i) => {
    const esUltima = i === porcentajes.length - 1;
    const monto = esUltima ? redondear2(montoTotal - acumulado) : redondear2(montoTotal * (porcentaje / 100));
    acumulado = redondear2(acumulado + monto);
    montos.push(monto);
  });
  return montos;
}

/** Plan de cuotas con fechas configuradas por el cliente (montos calculados en el servidor). */
export function planCuotasConFechas(
  montoTotal: number,
  porcentajes: number[],
  fechas: Array<string | null>,
): CuotaPlan[] {
  const montos = montosDeCuotas(montoTotal, porcentajes);
  return porcentajes.map((porcentaje, i) => ({
    numero: i + 1,
    porcentaje,
    monto: montos[i] ?? 0,
    fechaVencimiento: fechas[i] ?? null,
  }));
}

/** Cronograma con fechas referenciales (primera a 30 dias y cada siguiente a 45). */
export function planCuotas(montoTotal: number, porcentajes: number[], fechaBase: Date = new Date()): CuotaPlan[] {
  const validos = porcentajes.length > 0 ? porcentajes : [100];
  const fechas: string[] = [];
  let previa: string | null = null;
  for (let i = 0; i < validos.length; i++) {
    previa = siguienteFechaCuota(previa, fechaBase);
    fechas.push(previa);
  }
  return planCuotasConFechas(montoTotal, validos, fechas);
}

/**
 * Cronograma segun la modalidad clasica del contrato (compatibilidad):
 *  - `completo`: 100% a 30 dias de la firma.
 *  - `cuotas`: 50% a 30 dias + 50% a los 45 dias del primer pago.
 */
export function planCuotasPorModalidad(
  montoTotal: number,
  modalidad: string,
  fechaBase: Date = new Date(),
): CuotaPlan[] {
  return planCuotas(montoTotal, modalidad === MODOS_PAGO.CUOTAS ? [50, 50] : [100], fechaBase);
}

/** True si los porcentajes configurados son validos (1..3 cuotas que suman 100%). */
export function porcentajesValidos(porcentajes: number[]): boolean {
  if (porcentajes.length < 1 || porcentajes.length > 3) return false;
  if (porcentajes.some((p) => !Number.isFinite(p) || p <= 0)) return false;
  const suma = porcentajes.reduce((s, p) => s + p, 0);
  return Math.abs(suma - 100) < 0.01;
}

/**
 * True si las fechas de pago son validas: formato ISO (yyyy-mm-dd), no anteriores a hoy
 * y en orden cronologico ascendente. Se comparan como texto ISO (orden lexicografico).
 */
export function fechasCuotasValidas(fechas: Array<string | null>, hoyISO: string = dateUtils.todayInputValue()): boolean {
  if (fechas.length < 1) return false;
  let previa = "";
  for (const fecha of fechas) {
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    const ms = new Date(`${fecha}T00:00:00`).getTime();
    if (Number.isNaN(ms)) return false;
    if (fecha < hoyISO) return false;
    if (previa && fecha < previa) return false;
    previa = fecha;
  }
  return true;
}
