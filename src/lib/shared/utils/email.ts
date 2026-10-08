import { EMAIL_PROVISIONAL_DOMINIO } from "@/lib/shared/constants";

/**
 * Correo interno de las cuentas creadas solo con RUC (dominio `acceso.iimp`).
 * El acceso es por RUC; a este dominio nunca se envian correos.
 */
export function emailProvisionalPorRuc(ruc: string): string {
  return `acceso-${ruc.replace(/\D/g, "")}@${EMAIL_PROVISIONAL_DOMINIO}`;
}

/** true = el correo es el marcador provisional (cuenta creada solo con RUC). */
export function esEmailProvisional(email?: string | null): boolean {
  return (email ?? "").trim().toLowerCase().endsWith(`@${EMAIL_PROVISIONAL_DOMINIO}`);
}
