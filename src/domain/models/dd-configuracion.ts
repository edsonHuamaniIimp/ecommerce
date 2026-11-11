/** Configuracion unica del modulo Debida Diligencia. */
export interface DdConfiguracionEntity {
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
  updatedAt: Date | null;
}

export interface DdConfiguracionData {
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
}

/** Evento reciente de auditoria del modulo DD. */
export interface DdAuditoriaItem {
  id: string;
  actor: string | null;
  mensaje: string;
  entidad: string | null;
  createdAt: Date;
}
