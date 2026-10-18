/**
 * Nombre visible de una persona: evita duplicar apellidos cuando `nombre` ya
 * viene completo desde la fuente (servicio-persona) y `apellidos` se guarda aparte.
 */
export function nombreCompleto(nombre?: string | null, apellidos?: string | null): string | null {
  const n = String(nombre ?? "").trim();
  const a = String(apellidos ?? "").trim();
  if (!n) return a || null;
  if (!a) return n;
  return n.toLowerCase().endsWith(a.toLowerCase()) ? n : `${n} ${a}`;
}