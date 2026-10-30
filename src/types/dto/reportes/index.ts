export interface ResumenPaisSolicitudesDTO {
  pais: string | null;
  empresas: number;
  solicitudes: number;
}

export interface EmpresaPaisReporteDTO {
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

export interface PaisMetricaPabellonDTO {
  pais: string | null;
  empresas: number;
  solicitudes: number;
}

export interface PabellonMapaReporteDTO {
  planoCodigo: string | null;
  planoNombre: string | null;
  pabellon: string | null;
  empresas: number;
  solicitudes: number;
  paises: PaisMetricaPabellonDTO[];
}

export interface BloqueMapaReporteDTO {
  planoCodigo: string;
  bloqueId: string;
  empresas: number;
  solicitudes: number;
  paises: PaisMetricaPabellonDTO[];
}

export interface MapaPabellonesReporteDTO {
  pabellones: PabellonMapaReporteDTO[];
  bloques: BloqueMapaReporteDTO[];
}
