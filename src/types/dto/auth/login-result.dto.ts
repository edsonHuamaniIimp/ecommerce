export type LoginResult =
  | { token: string; roles: string[]; email: string; remember: boolean }
  | { error: string; status: 400 | 401 | 403 };
