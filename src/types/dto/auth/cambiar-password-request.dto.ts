export interface CambiarPasswordRequestDTO {
  /** Contrasena actual (la temporal enviada por correo). */
  passwordActual: string;
  /** Nueva contrasena definida por el usuario. */
  passwordNueva: string;
}
