export type CambiarPasswordResult =
  | { ok: true; token: string; /** La empresa aun debe validar sus datos contractuales. */ requiereValidarDatos: boolean }
  | { ok: false; error: string; status: number };
