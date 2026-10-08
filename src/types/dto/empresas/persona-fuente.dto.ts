/** Persona de servicio-persona (padron interno) para el backoffice de empresas. */
export interface PersonaFuenteDTO {
  sieCode: string;
  documento: string;
  nombreCompleto: string;
  direccion: string | null;
  correo: string | null;
  celular: string | null;
}
