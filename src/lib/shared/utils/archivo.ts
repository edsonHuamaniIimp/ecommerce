import { UPLOAD_ALLOWED_EXTENSIONS } from "@/lib/shared/constants";

export const archivoUtils = {
  /** true si la URL (sin query) apunta a un PDF. */
  esPdf(url: string | null | undefined): boolean {
    if (!url) return false;
    const base = url.split("?")[0] ?? "";
    return base.trim().toLowerCase().endsWith(".pdf");
  },

  /** Extension en minusculas del nombre (sin query); "" si no tiene una valida. */
  extensionDeArchivo(nombre: string): string {
    const base = String(nombre ?? "").trim().toLowerCase().split("?")[0] ?? "";
    const punto = base.lastIndexOf(".");
    if (punto <= 0 || punto === base.length - 1) return "";
    return base.slice(punto + 1);
  },

  /** true si la extension del nombre esta permitida (por defecto, la lista global de /api/upload). */
  extensionPermitida(nombre: string, permitidas: readonly string[] = UPLOAD_ALLOWED_EXTENSIONS): boolean {
    const ext = archivoUtils.extensionDeArchivo(nombre);
    return Boolean(ext) && permitidas.includes(ext);
  },

  /** Descarga un Blob en el navegador con el nombre indicado (no-op en SSR). */
  descargarBlob(blob: Blob, nombre: string): void {
    if (typeof window === "undefined") return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  },
};
