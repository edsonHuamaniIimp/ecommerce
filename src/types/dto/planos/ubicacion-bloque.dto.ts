/** Ubicacion de un bloque de stand dentro de un plano (RF-08). */
export interface UbicacionBloqueDTO {
  plano: { id: string; codigo: string; nombre: string; tipo: string };
  bloque: { bloqueId: string; tipoCodigo: string; x: number; z: number; rotY: number };
  /** Macro que contiene al pabellon, si aplica. */
  macro: { id: string; codigo: string; nombre: string } | null;
}
