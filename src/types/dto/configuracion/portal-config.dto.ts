/** Configuracion publica del portal (login/presala). Campo vacio = enlace oculto. */
export interface PortalConfigDTO {
  mesaAyudaEmail: string | null;
  contactoEmail: string | null;
  manualUrl: string | null;
  reglamentoUrl: string | null;
}
