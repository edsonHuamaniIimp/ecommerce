export type LoginResult =
  | { token: string; roles: string[]; email: string }
  | { error: string; status: 400 | 401 | 403 };
