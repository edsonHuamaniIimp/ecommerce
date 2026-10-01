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
};
