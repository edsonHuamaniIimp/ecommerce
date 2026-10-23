/** Configuracion publica del portal (login/presala). Campo vacio = enlace oculto. */
export interface PortalConfigDTO {
  mesaAyudaEmail: string | null;
  contactoEmail: string | null;
  manualUrl: string | null;
  reglamentoUrl: string | null;
  /** Minutos de bloqueo del stand al abrir el wizard de reserva. */
  holdReservaMinutos: number;
  /** Maximo de stands que un cliente puede solicitar en una reserva. */
  maxStandsReserva: number;
  /** Aviso global de mantenimiento para los usuarios del portal. */
  mantenimientoActivo: boolean;
  mantenimientoInicio: string | null;
  mantenimientoFin: string | null;
  mantenimientoPermiteCerrar: boolean;
}
