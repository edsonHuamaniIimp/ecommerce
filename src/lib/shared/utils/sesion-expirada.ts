import { PUBLIC_ROUTES, SESION_EXPIRADA } from "@/lib/shared/constants";

/** Base ficticia solo para leer el pathname de URLs relativas. */
const BASE_PARSEO = "http://localhost";

function rutaDe(url: string): string {
  try {
    return new URL(url, BASE_PARSEO).pathname;
  } catch {
    return url;
  }
}

/**
 * Sesion terminada mientras la pantalla sigue abierta: el proxy solo redirige al
 * login al navegar; las acciones dentro de la pagina llegan a la API y reciben 401.
 */
export const sesionExpiradaUtils = {
  /**
   * True si el 401 de esta API debe llevar al login: solo APIs listadas en
   * `SESION_EXPIRADA.APIS_AL_LOGIN` y nunca desde pantallas publicas o de autenticacion.
   */
  debeIrAlLogin(urlPeticion: string, status: number, rutaActual: string): boolean {
    if (status !== SESION_EXPIRADA.STATUS) return false;
    if (rutaActual.startsWith(SESION_EXPIRADA.PREFIJO_RUTAS_AUTH)) return false;
    if ((PUBLIC_ROUTES as readonly string[]).includes(rutaActual)) return false;
    const ruta = rutaDe(urlPeticion);
    return SESION_EXPIRADA.APIS_AL_LOGIN.some((prefijo) => ruta === prefijo || ruta.startsWith(`${prefijo}/`));
  },

  /** URL del login que, tras ingresar, regresa a la pantalla donde se estaba. */
  urlLogin(returnTo: string): string {
    const params = new URLSearchParams({ [SESION_EXPIRADA.PARAM_RETURN_TO]: returnTo });
    return `${SESION_EXPIRADA.RUTA_LOGIN}?${params.toString()}`;
  },
};
