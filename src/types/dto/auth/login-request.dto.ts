export interface LoginRequestDTO {
  email: string;
  password: string;
  /** Mantiene la sesion activa por 30 dias en este equipo. */
  remember?: boolean;
}
