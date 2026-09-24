/** Sigla corta de un evento a partir de su nombre (hasta 3 iniciales). */
export const eventoUtils = {
  sigla(nombre: string, porDefecto = "IIMP"): string {
    const palabras = nombre.trim().split(/\s+/).filter(Boolean);
    const primera = palabras[0];
    if (!primera) return porDefecto;
    if (palabras.length === 1) return primera.slice(0, 3).toUpperCase();
    return palabras
      .slice(0, 3)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  },
};
