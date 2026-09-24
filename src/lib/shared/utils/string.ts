/** Iniciales para avatares (hasta 2 letras). */
export const stringUtils = {
  iniciales(texto: string | null | undefined, porDefecto = "II"): string {
    if (!texto) return porDefecto;
    const iniciales = texto
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
    return iniciales || porDefecto;
  },

  /** Nombre de archivo legible a partir de una URL. */
  nombreArchivo(url: string | null | undefined): string {
    if (!url) return "";
    const nombre = url.split("/").pop() ?? url;
    try {
      return decodeURIComponent(nombre);
    } catch {
      return nombre;
    }
  },
};
