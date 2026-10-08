/** Resultado de crear la cuenta del Portal / reenviar credenciales. */
export interface ResultadoCredencialesEmpresaDTO {
  /** Correo (usuario) de la cuenta; provisional (`acceso-<ruc>@acceso.iimp`) si se creo solo con RUC. */
  email: string;
  /** Usuario de acceso: el correo de la cuenta o el RUC (cuentas sin correo real). */
  usuario: string;
  /** Contrasena temporal generada (se muestra una vez al administrador). */
  passwordTemporal: string;
  /** true = correo enviado; false = no se pudo enviar; null = sin envio (cuenta provisional sin correo real). */
  emailEnviado: boolean | null;
}
