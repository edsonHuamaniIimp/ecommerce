/** Datos para crear una cuenta de exhibidor y iniciar sesion automaticamente. */
export interface RegistroRequestDTO {
  email: string;
  password: string;
  nombre: string;
  apellidos: string;
  razonSocial: string;
  /** RUC de la empresa (11 digitos, obligatorio). */
  ruc: string;
  telefono?: string;
}
