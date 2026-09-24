/** Datos para confirmar el registro con el codigo enviado al correo. */
export interface RegistroConfirmarRequestDTO {
  email: string;
  codigo: string;
}
