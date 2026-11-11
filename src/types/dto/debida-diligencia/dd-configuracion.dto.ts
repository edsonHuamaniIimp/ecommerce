/** Configuracion del modulo Debida Diligencia para el backoffice. */
export interface DdConfiguracionDTO {
  plazoDiasHabiles: number;
  estadoCierreAutomatico: string;
  exigirEvidencia: boolean;
  permitirNaSinEvidencia: boolean;
  revalidacionDeclaracion: boolean;
  noAptoBloqueaEmpresa: boolean;
  legalSoloDerivacionSig: boolean;
  vigenciaMeses: number;
  permitirReutilizacionVinculo: boolean;
  manualUrl: string | null;
  reglamentoUrl: string | null;
  plantillaInformeUrl: string | null;
  linkListasUrl: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface DdConfiguracionRequestDTO {
  plazoDiasHabiles: number;
  estadoCierreAutomatico: string;
  exigirEvidencia: boolean;
  permitirNaSinEvidencia: boolean;
  revalidacionDeclaracion: boolean;
  noAptoBloqueaEmpresa: boolean;
  legalSoloDerivacionSig: boolean;
  vigenciaMeses: number;
  permitirReutilizacionVinculo: boolean;
  manualUrl: string | null;
  reglamentoUrl: string | null;
  plantillaInformeUrl: string | null;
  linkListasUrl: string | null;
}

export interface DdAuditoriaItemDTO {
  id: string;
  actor: string | null;
  mensaje: string;
  entidad: string | null;
  createdAt: string;
}
