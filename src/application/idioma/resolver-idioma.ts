import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { Idioma } from "@/lib/shared/constants";
import { idiomaODefecto } from "@/lib/shared/utils/idioma";
import { resolverIdiomaPeticion } from "@/lib/server/idioma";

/**
 * Idioma del destinatario de un correo/documento: preferencia persistida del
 * usuario (`user_role.idioma`, via puerto de repositorio) y, si no existe, la
 * cookie de la peticion y por ultimo español.
 */
export async function resolverIdiomaDestinatario(
  authRepo: IAuthRepository,
  email?: string | null,
): Promise<Idioma> {
  if (email) {
    const perfil = await authRepo.findPerfilByEmail(email).catch(() => null);
    if (perfil?.idioma) return idiomaODefecto(perfil.idioma);
  }
  return resolverIdiomaPeticion();
}
