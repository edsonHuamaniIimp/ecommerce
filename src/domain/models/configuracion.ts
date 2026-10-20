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
  /** Minutos que un stand queda bloqueado mientras el cliente completa el wizard. */
  holdReservaMinutos: number;
  /** Aviso global de mantenimiento para los usuarios del portal. */
  mantenimientoActivo: boolean;
  mantenimientoInicio: Date | null;
  mantenimientoFin: Date | null;
  mantenimientoPermiteCerrar: boolean;
  updatedBy: string | null;
  updatedAt: Date | null;
}

/** Cambios de la configuracion del portal (siempre se guardan completos). */
export interface ActualizarPortalConfigData {
  mesaAyudaEmail: string | null;
  contactoEmail: string | null;
  manualUrl: string | null;
  reglamentoUrl: string | null;
  holdReservaMinutos: number;
  mantenimientoActivo: boolean;
  mantenimientoInicio: Date | null;
  mantenimientoFin: Date | null;
  mantenimientoPermiteCerrar: boolean;
  updatedBy: string | null;
}
