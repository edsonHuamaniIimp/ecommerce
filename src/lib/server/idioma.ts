import 'server-only';

import { cookies } from "next/headers";
import { IDIOMA_COOKIE } from "@/lib/shared/constants";
import { idiomaODefecto } from "@/lib/shared/utils/idioma";
import type { Idioma } from "@/lib/shared/constants";

/**
 * Idioma de la peticion actual (cookie `iimp_idioma`), fallback español.
 * Solo acceso a la cookie: la preferencia del usuario se resuelve en la capa
 * de aplicacion (`resolverIdiomaDestinatario` con el puerto de auth).
 */
export async function resolverIdiomaPeticion(): Promise<Idioma> {
  try {
    const cookieStore = await cookies();
    return idiomaODefecto(cookieStore.get(IDIOMA_COOKIE)?.value);
  } catch {
    return idiomaODefecto(null);
  }
}
