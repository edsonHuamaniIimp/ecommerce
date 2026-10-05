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

  /**
   * Clave de comparacion: minusculas, sin diacriticos ni separadores.
   * Permite emparejar nombres equivalentes escritos distinto ("PABELLÓN 1" ↔ "PABELLON1").
   */
  claveComparacion(texto: string | null | undefined): string {
    if (!texto) return "";
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  },
};
