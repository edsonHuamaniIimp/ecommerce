export type CambiarIdiomaResult =
  | { ok: true; idioma: string }
  | { ok: false; error: string; status: number };
