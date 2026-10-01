export const archivoUtils = {
  /** true si la URL (sin query) apunta a un PDF. */
  esPdf(url: string | null | undefined): boolean {
    if (!url) return false;
    const base = url.split("?")[0] ?? "";
    return base.trim().toLowerCase().endsWith(".pdf");
  },
};
