export const numberUtils = {
  /** Monto con separador de miles y moneda (ej. "US$ 135,000"). */
  monto(valor: number, moneda: string): string {
    return `${moneda} ${valor.toLocaleString("en-US")}`;
  },
  /** Porcentaje con un decimal (ej. 37.5). Devuelve 0 si el total es 0. */
  porcentaje(parte: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((parte / total) * 1000) / 10;
  },
};
