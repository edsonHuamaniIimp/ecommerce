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

/** Datos exportables de una solicitud. */
export interface ReporteExportacionSolicitud {
  id: string;
  empresa: string | null;
  ruc: string | null;
  pais: string | null;
  estado: string | null;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
  usuario: string | null;
  email: string | null;
  standCodes: string[];
  pabellones: string[];
  tipoStand: string | null;
  precio: number;
}

/** Datos exportables de un stand vinculado a una solicitud. */
export interface ReporteExportacionStand {
  solicitudId: string;
  empresa: string | null;
  ruc: string | null;
  pais: string | null;
  standCode: string | null;
  bloqueId: string | null;
  pabellon: string | null;
  estadoSolicitud: string | null;
  activa: boolean;
  tipoStand: string | null;
  precio: number;
}

/** Dataset completo para el Excel de reportes. */
export interface ReporteExportacion {
  empresas: EmpresaPaisReporte[];
  solicitudes: ReporteExportacionSolicitud[];
  stands: ReporteExportacionStand[];
}
