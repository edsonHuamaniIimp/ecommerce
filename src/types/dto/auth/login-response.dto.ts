export interface LoginResponseDTO {
  token: string;
  roles: string[];
  email: string;
  /** Credencial temporal: el portal debe pedir el cambio de contrasena antes de continuar. */
  debeCambiarPassword?: boolean;
  /** Primer ingreso de una empresa: debe validar sus datos contractuales. */
  requiereValidarDatos?: boolean;
  /** Idioma preferido del usuario (es | en). */
  idioma?: string;
}
