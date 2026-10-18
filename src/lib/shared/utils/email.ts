import { EMAIL_PROVISIONAL_DOMINIO } from "@/lib/shared/constants";

/**
 * Correo interno de las cuentas creadas solo con el documento de la empresa
 * (dominio `acceso.iimp`). El acceso es por documento (RUC o RUT); a este
 * dominio nunca se envian correos.
 */
export function emailProvisionalPorDocumento(documento: string): string {
  return `acceso-${String(documento ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")}@${EMAIL_PROVISIONAL_DOMINIO}`;
}

/** true = el correo es el marcador provisional (cuenta creada solo con documento). */
export function esEmailProvisional(email?: string | null): boolean {
  return (email ?? "").trim().toLowerCase().endsWith(`@${EMAIL_PROVISIONAL_DOMINIO}`);
}

/**
 * Inverso de `emailProvisionalPorDocumento`: devuelve el documento (RUC/RUT) cuando
 * el correo es una cuenta provisional; null si no lo es.
 */
export function documentoDesdeEmailProvisional(email?: string | null): string | null {
  const match = /^acceso-([a-z0-9]+)@acceso\.iimp$/i.exec(String(email ?? "").trim());
  const documento = match?.[1];
  return documento ? documento.toUpperCase() : null;
}