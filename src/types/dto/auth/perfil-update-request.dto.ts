export interface PerfilUpdateRequestDTO {
  nombre?: string;
  apellidos?: string;
  telefono?: string;
  tipoUsuarioId?: number | null;
  idEmpresa?: string | null;
  nombreEmpresa?: string | null;
  /** RUC de la empresa seleccionada: resuelve la empresa fiscal local (FK `empresa_id`). */
  ruc?: string | null;
  /** Logo propio del usuario (URL en /uploads/*). */
  logoUrl?: string | null;
  /** Firma digital del usuario (imagen PNG/JPG en /uploads/*). */
  firmaUrl?: string | null;
  /** Datos del representante legal (se guardan en la ficha de la empresa del usuario). */
  representanteNombre?: string | null;
  representanteDni?: string | null;
  representanteCorreo?: string | null;
  representanteCelular?: string | null;
  representanteDireccion?: string | null;
  representantePartida?: string | null;
}
