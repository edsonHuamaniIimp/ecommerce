const GRADOS_POR_RADIAN = 180 / Math.PI;
const RADIANES_POR_GRADO = Math.PI / 180;

export interface PuntoAlineable {
  id: string;
  x: number;
  z: number;
}

export interface AlineacionGuias {
  x: number;
  z: number;
  guiaX: number | null;
  guiaZ: number | null;
}

export const planoEditorUtils = {
  aGrados(rad: number): number {
    return rad * GRADOS_POR_RADIAN;
  },

  aRadianes(deg: number): number {
    return deg * RADIANES_POR_GRADO;
  },

  /** Normaliza un angulo a [0, 360). */
  normalizarGrados(deg: number): number {
    return ((deg % 360) + 360) % 360;
  },

  /** Redondea un angulo al multiplo de `paso` mas cercano. */
  snapGrados(deg: number, paso: number): number {
    if (paso <= 0) return deg;
    return Math.round(deg / paso) * paso;
  },

  /**
   * Ajusta (x, z) al centro de otro objeto si esta dentro del umbral.
   * Devuelve las coordenadas finales y la coordenada de la guia a dibujar (null si no alinea).
   */
  alinear(x: number, z: number, candidatos: PuntoAlineable[], umbral: number): AlineacionGuias {
    let mejorX: { valor: number; distancia: number } | null = null;
    let mejorZ: { valor: number; distancia: number } | null = null;
    for (const c of candidatos) {
      const dx = Math.abs(x - c.x);
      if (dx <= umbral && (!mejorX || dx < mejorX.distancia)) mejorX = { valor: c.x, distancia: dx };
      const dz = Math.abs(z - c.z);
      if (dz <= umbral && (!mejorZ || dz < mejorZ.distancia)) mejorZ = { valor: c.z, distancia: dz };
    }
    return {
      x: mejorX?.valor ?? x,
      z: mejorZ?.valor ?? z,
      guiaX: mejorX?.valor ?? null,
      guiaZ: mejorZ?.valor ?? null,
    };
  },

  /**
   * Genera `cantidad` IDs consecutivos a partir de un ID base, evitando los ya existentes.
   * - "BLOQUE-11" -> BLOQUE-11, BLOQUE-12, ... (mismo relleno de ceros)
   * - "VIP4334"   -> VIP4334, VIP4335, ...
   * - "MESA-A"    -> MESA-A-01, MESA-A-02, ...
   */
  siguientesIdsBloque(base: string, cantidad: number, existentes: Iterable<string> = []): string[] {
    const usados = new Set(Array.from(existentes, (e) => e.trim().toUpperCase()));
    const limpio = base.trim().toUpperCase();
    const match = /^(.*?)(\d+)$/.exec(limpio);
    let prefijo: string;
    let numero: number;
    let relleno: number;
    if (match && match[1] !== undefined && match[2] !== undefined) {
      prefijo = match[1];
      numero = Number.parseInt(match[2], 10);
      relleno = match[2].length;
    } else {
      prefijo = limpio ? `${limpio}-` : "BLOQUE-";
      numero = 1;
      relleno = 2;
    }
    const total = Math.max(1, Math.floor(cantidad));
    const out: string[] = [];
    let n = numero;
    let intentos = 0;
    while (out.length < total && intentos < total + 1000) {
      const id = `${prefijo}${String(n).padStart(relleno, "0")}`;
      if (!usados.has(id)) out.push(id);
      n += 1;
      intentos += 1;
    }
    return out;
  },

  /** Agrega un id a la seleccion multiple sin duplicar. */
  agregarSeleccion(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids : [...ids, id];
  },

  /** Quita un id de la seleccion multiple. */
  quitarSeleccion(ids: string[], id: string): string[] {
    return ids.filter((x) => x !== id);
  },

  /** Desplaza un conjunto de posiciones por (dx, dz). */
  desplazarGrupo(inicio: Array<{ id: string; x: number; z: number }>, dx: number, dz: number): Array<{ id: string; x: number; z: number }> {
    return inicio.map((i) => ({ id: i.id, x: i.x + dx, z: i.z + dz }));
  },
};
