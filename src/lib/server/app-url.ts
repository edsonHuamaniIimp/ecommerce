/**
 * URL publica de la app para correos y enlaces generados en el servidor.
 * Prioriza `APP_URL` de runtime (definida en el contenedor/ECS); cae a
 * `NEXT_PUBLIC_APP_URL` (build-time) y a localhost en desarrollo.
 */
export function getAppUrl(): string {
  const url = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return url.replace(/\/+$/, "");
}
