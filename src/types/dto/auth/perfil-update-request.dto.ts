export interface PerfilUpdateRequestDTO {
  nombre?: string;
  apellidos?: string;
  telefono?: string;
  tipoUsuarioId?: number | null;
  idEmpresa?: string | null;
  nombreEmpresa?: string | null;
  /** Logo propio del usuario (URL en /uploads/*). */
  logoUrl?: string | null;
  /** Firma digital del usuario (imagen PNG/JPG en /uploads/*). */
  firmaUrl?: string | null;
}
