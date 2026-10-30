export interface ResumenPaisSolicitudes {
  pais: string | null;
  empresas: number;
  solicitudes: number;
}

export interface EmpresaPaisReporte {
  empresaId: string | null;
  pais: string | null;
  ruc: string | null;
  tipoDocumento: string | null;
  razonSocial: string;
  estado: string | null;
  solicitudes: number;
  solicitudesActivas: number;
  solicitudesInactivas: number;
  datosValidadosEn: string | null;
}

/** Distribucion de una metrica por pais dentro del mapa de pabellones. */
export interface PaisMetricaPabellon {
  pais: string | null;
  empresas: number;
  solicitudes: number;
}

/** Metricas agregadas de un pabellon o de un bloque del plano. */
export interface PabellonMapaReporte {
  planoCodigo: string | null;
  planoNombre: string | null;
  pabellon: string | null;
  empresas: number;
  solicitudes: number;
  paises: PaisMetricaPabellon[];
}

/** Metricas agregadas de un bloque concreto del plano 2D. */
export interface BloqueMapaReporte {
  planoCodigo: string;
  bloqueId: string;
  standCode: string | null;
  empresas: number;
  solicitudes: number;
  paises: PaisMetricaPabellon[];
}

/** Respuesta del mapa de calor de pabellones. */
export interface MapaPabellonesReporte {
  pabellones: PabellonMapaReporte[];
  bloques: BloqueMapaReporte[];
}
