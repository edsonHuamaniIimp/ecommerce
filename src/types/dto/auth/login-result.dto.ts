export type LoginResult =
  | { token: string; roles: string[]; email: string; remember: boolean; debeCambiarPassword?: boolean; requiereValidarDatos?: boolean; idioma?: string }
  | { error: string; status: 400 | 401 | 403 };
