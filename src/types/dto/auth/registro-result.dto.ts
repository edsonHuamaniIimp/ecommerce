/** Resultado de iniciar el registro: se envio el codigo de verificacion al correo. */
export type RegistroResult =
  | { ok: true; message: string }
  | { error: string; status: 400 | 403 | 409 | 502 };
