export const dateUtils = {
  format(iso: string | null | undefined): string {
    if (!iso) return "—";
    const [datePart] = iso.split("T");
    const [y, m, d] = datePart.split("-");
    if (!y || !m || !d) return "—";
    return new Date(+y, +m - 1, +d).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  },

  formatDateTime(iso: string | Date | null | undefined): string {
    if (!iso) return "—";
    const d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  toInputValue(iso: string | null | undefined): string {
    if (!iso) return "";
    return iso.slice(0, 10);
  },

  extractYear(iso: string): number {
    return new Date(iso).getFullYear();
  },
};
