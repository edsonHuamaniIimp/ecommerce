import { CUOTAS_DIAS_MIN_ENTRE, CUOTAS_FECHA_MAXIMA, CUOTAS_MESES_MAX_POR_CUOTA, HITOS_CUOTAS, MAX_CUOTAS_PERSONALIZADAS, MODALIDADES_CUOTAS, MODOS_PAGO, PORCENTAJES_POR_MODALIDAD, type ModalidadCuotas } from "@/lib/shared/constants";
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

/** Cuota minima que necesitan los validadores (sin monto). */
export interface CuotaProgramada {
  porcentaje: number;
  fechaVencimiento: string | null;
}

/**
 * Configuracion personalizada de cuotas de una empresa: cantidad exacta de cuotas
 * y fechas de vencimiento definidas por el administrador.
 */
export interface ConfigCuotasEmpresa {
  /** Cantidad de cuotas (1..9; limite operativo del IIMP). */
  maxCuotas: number;
  /** Fechas ISO yyyy-mm-dd, una por cuota, en orden ascendente. */
  fechas: string[];
}

/** True si la configuracion tiene cantidad y fechas validas y futuras. */
export function configCuotasValida(
  config: ConfigCuotasEmpresa | null | undefined,
  hoyISO: string = dateUtils.todayLimaInputValue(),
): boolean {
  if (!config) return false;
  if (!Number.isInteger(config.maxCuotas) || config.maxCuotas < 1 || config.maxCuotas > MAX_CUOTAS_PERSONALIZADAS) return false;
  if (!Array.isArray(config.fechas) || config.fechas.length !== config.maxCuotas) return false;
  const fechas = config.fechas;
  return fechas.every((fecha, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    if (fecha <= hoyISO) return false;
    return i === 0 || fecha > (fechas[i - 1] ?? "");
  });
}

/** Normaliza la configuracion recibida (trim) para persistirla. */
export function normalizarConfigCuotas(config: ConfigCuotasEmpresa): ConfigCuotasEmpresa {
  return {
    maxCuotas: config.maxCuotas,
    fechas: config.fechas.map((fecha) => fecha.trim()),
  };
}

/** Porcentajes equitativos para una cantidad de cuotas (la ultima absorbe el redondeo). */
export function porcentajesEquitativos(cantidad: number): number[] {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CUOTAS_PERSONALIZADAS) return [];
  const base = Math.floor((100 / cantidad) * 100) / 100;
  const porcentajes = Array.from({ length: cantidad }, () => base);
  porcentajes[cantidad - 1] = redondear2(100 - base * (cantidad - 1));
  return porcentajes;
}

/** Cuotas iniciales para una configuracion personalizada valida. */
export function cuotasPersonalizadasIniciales(
  config: ConfigCuotasEmpresa | null | undefined,
  hoyISO: string = dateUtils.todayLimaInputValue(),
): Array<{ porcentaje: number; fecha: string }> | null {
  if (!config || !configCuotasValida(config, hoyISO)) return null;
  const porcentajes = porcentajesEquitativos(config.maxCuotas);
  return config.fechas.map((fecha, i) => ({ porcentaje: porcentajes[i] ?? 0, fecha }));
}

/**
 * True si las cuotas usan exactamente las fechas configuradas por el administrador
 * y sus porcentajes son validos (la distribucion es libre).
 */
export function cuotasCoincidenConfig(
  cuotas: CuotaProgramada[],
  config: ConfigCuotasEmpresa | null | undefined,
  hoyISO: string = dateUtils.todayLimaInputValue(),
): boolean {
  if (!config || !configCuotasValida(config, hoyISO)) return false;
  if (cuotas.length !== config.maxCuotas) return false;
  if (!porcentajesValidos(cuotas.map((c) => c.porcentaje), config.maxCuotas)) return false;
  return cuotas.every((cuota, i) => cuota.fechaVencimiento === config.fechas[i]);
}

/**
 * Cronogramas oficiales por cantidad de cuotas. Se elige el primero cuyas fechas
 * sean estrictamente posteriores a la reserva.
 */
const CRONOGRAMAS: Record<ModalidadCuotas, readonly (readonly string[])[]> = {
  [MODALIDADES_CUOTAS.UNA]: [[HITOS_CUOTAS.PRIMERA_2026], [HITOS_CUOTAS.ULTIMA]],
  [MODALIDADES_CUOTAS.DOS]: [
    [HITOS_CUOTAS.PRIMERA_2026, HITOS_CUOTAS.ULTIMA],
    [HITOS_CUOTAS.PRIMERA_2027, HITOS_CUOTAS.ULTIMA],
    [HITOS_CUOTAS.SEGUNDA_2027, HITOS_CUOTAS.ULTIMA],
  ],
  [MODALIDADES_CUOTAS.TRES]: [
    [HITOS_CUOTAS.PRIMERA_2026, HITOS_CUOTAS.SEGUNDA_2026, HITOS_CUOTAS.ULTIMA],
    [HITOS_CUOTAS.PRIMERA_2027, HITOS_CUOTAS.SEGUNDA_2027, HITOS_CUOTAS.ULTIMA],
  ],
};

/** True si `cantidad` es una modalidad del wizard (1, 2 o 3 cuotas). */
export function esModalidadCuotas(cantidad: number): cantidad is ModalidadCuotas {
  return cantidad === MODALIDADES_CUOTAS.UNA || cantidad === MODALIDADES_CUOTAS.DOS || cantidad === MODALIDADES_CUOTAS.TRES;
}

/**
 * Fechas del primer cronograma de la modalidad cuyas fechas son estrictamente
 * posteriores a `hoyISO`. Devuelve null si la modalidad no esta disponible
 * (todas sus fechas ya vencieron o la reserva cae en el primer hito).
 */
export function cronogramaPredeterminado(
  cantidad: number,
  hoyISO: string = dateUtils.todayLimaInputValue(),
): string[] | null {
  if (!esModalidadCuotas(cantidad)) return null;
  const opciones = CRONOGRAMAS[cantidad];
  const encontrado = opciones.find((fechas) => fechas.every((fecha) => fecha > hoyISO));
  return encontrado ? [...encontrado] : null;
}

/** Configuracion porcentaje/fecha por defecto para el wizard (sin montos). */
export function cuotasPredeterminadas(
  cantidad: ModalidadCuotas,
  hoyISO: string = dateUtils.todayLimaInputValue(),
): Array<{ porcentaje: number; fecha: string }> | null {
  const fechas = cronogramaPredeterminado(cantidad, hoyISO);
  if (!fechas) return null;
  return PORCENTAJES_POR_MODALIDAD[cantidad].map((porcentaje, i) => ({
    porcentaje,
    fecha: fechas[i] ?? "",
  }));
}

/** Plan con montos y fechas fijas; null si la modalidad ya no esta disponible. */
export function planPagoPredeterminado(
  montoTotal: number,
  cantidad: ModalidadCuotas,
  hoyISO: string = dateUtils.todayLimaInputValue(),
): CuotaPlan[] | null {
  const fechas = cronogramaPredeterminado(cantidad, hoyISO);
  if (!fechas) return null;
  return planCuotasConFechas(montoTotal, [...PORCENTAJES_POR_MODALIDAD[cantidad]], fechas);
}

/**
 * Valida que las cuotas sean exactamente una modalidad fija vigente para la fecha:
 * misma cantidad, mismos porcentajes y mismas fechas. No acepta fechas libres.
 */
export function cronogramaValido(
  cuotas: CuotaProgramada[],
  hoyISO: string = dateUtils.todayLimaInputValue(),
): boolean {
  if (cuotas.length < 1 || cuotas.length > 3) return false;
  if (!porcentajesValidos(cuotas.map((c) => c.porcentaje))) return false;
  const cantidad = cuotas.length as ModalidadCuotas;
  const porcentajesEsperados = PORCENTAJES_POR_MODALIDAD[cantidad];
  if (cuotas.some((c, i) => c.porcentaje !== porcentajesEsperados[i])) return false;
  const fechas = cronogramaPredeterminado(cantidad, hoyISO);
  if (!fechas) return false;
  return cuotas.every((c, i) => c.fechaVencimiento === fechas[i]);
}

/** True si todas las fechas tienen formato ISO y van en orden ascendente (legacy). */
export function fechasCuotasEstructuralmenteValidas(fechas: Array<string | null>): boolean {
  if (fechas.length < 1) return false;
  let previa: string | null = null;
  for (const fecha of fechas) {
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    if (previa && fecha <= previa) return false;
    previa = fecha;
  }
  return true;
}

/** Modalidad contractual a partir de los porcentajes (la 4 es personalizada/legacy). */
export function modalidadDeCuotas(porcentajes: number[]): string {
  if (porcentajes.length === 1 && porcentajes[0] === 100) return MODOS_PAGO.COMPLETO;
  if (porcentajes.length === 2 && porcentajes[0] === 50 && porcentajes[1] === 50) return MODOS_PAGO.CUOTAS;
  if (porcentajes.length === 3 && porcentajes[0] === 40 && porcentajes[1] === 30 && porcentajes[2] === 30) return MODOS_PAGO.TRES_CUOTAS;
  return MODOS_PAGO.PERSONALIZADO;
}

/** Etiqueta visible de la modalidad contractual. */
export function etiquetaModalidad(modalidad: string): string {
  if (modalidad === MODOS_PAGO.COMPLETO) return "1 cuota (100%)";
  if (modalidad === MODOS_PAGO.CUOTAS) return "2 cuotas (50% / 50%)";
  if (modalidad === MODOS_PAGO.TRES_CUOTAS) return "3 cuotas (40% / 30% / 30%)";
  return "Cronograma personalizado";
}

/** Suma dias calendario a una fecha y devuelve ISO (yyyy-mm-dd) en hora local. */
export function sumarDias(fecha: Date, dias: number): string {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return dateUtils.inputValue(d);
}

/** Suma meses a una fecha ISO recortando al ultimo dia del mes destino (31/01 + 1 mes = 28/02). */
export function sumarMesesISO(fechaISO: string, meses: number): string {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const destino = new Date(anio ?? 1970, (mes ?? 1) - 1 + meses, 1);
  const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(dia ?? 1, ultimoDia));
  return dateUtils.inputValue(destino);
}

/**
 * Fecha maxima de la cuota `indice` (0-based): cuota N hasta N meses desde la solicitud,
 * con el tope absoluto del cronograma (CUOTAS_FECHA_MAXIMA).
 */
export function fechaMaximaCuota(indice: number, hoy: Date = new Date()): string {
  const limite = sumarMesesISO(dateUtils.inputValue(hoy), (indice + 1) * CUOTAS_MESES_MAX_POR_CUOTA);
  return limite < CUOTAS_FECHA_MAXIMA ? limite : CUOTAS_FECHA_MAXIMA;
}

/** True si cada fecha respeta el maximo de su cuota (cuota N: N meses, tope del cronograma). */
export function fechasCuotasEnRango(fechas: Array<string | null>, hoy: Date = new Date()): boolean {
  if (fechas.length < 1) return false;
  return fechas.every((fecha, i) => Boolean(fecha) && (fecha as string) <= fechaMaximaCuota(i, hoy));
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

/** True si los porcentajes configurados son validos (1..maxCuotas cuotas que suman 100%). */
export function porcentajesValidos(porcentajes: number[], maxCuotas = 3): boolean {
  if (porcentajes.length < 1 || porcentajes.length > maxCuotas) return false;
  if (porcentajes.some((p) => !Number.isFinite(p) || p <= 0)) return false;
  const suma = porcentajes.reduce((s, p) => s + p, 0);
  return Math.abs(suma - 100) < 0.01;
}

/**
 * True si las fechas de pago son validas: formato ISO (yyyy-mm-dd), no anteriores a hoy
 * y cada cuota posterior a la anterior con el minimo de separacion (CUOTAS_DIAS_MIN_ENTRE).
 * Se comparan como texto ISO (orden lexicografico).
 */
export function fechasCuotasValidas(fechas: Array<string | null>, hoyISO: string = dateUtils.todayInputValue()): boolean {
  if (fechas.length < 1) return false;
  let previa: string | null = null;
  for (const fecha of fechas) {
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    const ms = new Date(`${fecha}T00:00:00`).getTime();
    if (Number.isNaN(ms)) return false;
    if (fecha < hoyISO) return false;
    if (previa && fecha < sumarDias(new Date(`${previa}T00:00:00`), CUOTAS_DIAS_MIN_ENTRE)) return false;
    previa = fecha;
  }
  return true;
}
