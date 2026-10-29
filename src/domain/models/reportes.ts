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
