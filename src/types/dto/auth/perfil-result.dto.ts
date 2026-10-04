export interface PerfilResult {
  email: string;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
  tipoUsuarioId: number | null;
  idEmpresa: string | null;
  nombreEmpresa: string | null;
  /** Logo propio del usuario (URL); tiene prioridad sobre el de su empresa en el mapa. */
  logoUrl: string | null;
  /** Firma digital del usuario (URL de la imagen); se usa para firmar contratos desde el portal. */
  firmaUrl: string | null;
  /** Idioma preferido (es | en). */
  idioma: string | null;
}
