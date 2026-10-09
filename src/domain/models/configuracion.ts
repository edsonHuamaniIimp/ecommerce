/** Configuracion publica del portal (registro unico, administrable). */
export interface PortalConfigEntity {
  /** Correo de la Mesa de Ayuda (mailto en el portal). */
  mesaAyudaEmail: string | null;
  /** Correo de contacto general. */
  contactoEmail: string | null;
  /** URL del Manual del Exhibidor. */
  manualUrl: string | null;
  /** URL del Reglamento de Stands. */
  reglamentoUrl: string | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

/** Cambios de la configuracion del portal (siempre se guardan completos). */
export interface ActualizarPortalConfigData {
  mesaAyudaEmail: string | null;
  contactoEmail: string | null;
  manualUrl: string | null;
  reglamentoUrl: string | null;
  updatedBy: string | null;
}
