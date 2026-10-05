export interface PuntoSeccion {
  x: number;
  y: number;
}

export interface BBoxSeccion {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Utilidades para secciones libres (poligonos de N puntos) del mapa macro. */
export const seccionPuntosUtils = {
  esPoligono(puntos: unknown): puntos is PuntoSeccion[] {
    return Array.isArray(puntos) && puntos.length >= 3 && puntos.every((p) => typeof (p as PuntoSeccion)?.x === "number" && typeof (p as PuntoSeccion)?.y === "number");
  },

  /** Bounding box (normalizada 0-1) de una lista de puntos. */
  bbox(puntos: PuntoSeccion[]): BBoxSeccion {
    const xs = puntos.map((p) => p.x);
    const ys = puntos.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x: clamp01(x), y: clamp01(y), w: Math.max(0.0001, clamp01(Math.max(...xs)) - clamp01(x)), h: Math.max(0.0001, clamp01(Math.max(...ys)) - clamp01(y)) };
  },

  /** Desplaza los puntos por (dx, dy) normalizados. */
  mover(puntos: PuntoSeccion[], dx: number, dy: number): PuntoSeccion[] {
    return puntos.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  },

  /** Limita los puntos al rango 0-1. */
  limitar(puntos: PuntoSeccion[]): PuntoSeccion[] {
    return puntos.map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }));
  },

  /** Rota los puntos `grados` alrededor de un centro normalizado. */
  rotar(puntos: PuntoSeccion[], centro: PuntoSeccion, grados: number): PuntoSeccion[] {
    const rad = (grados * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return puntos.map((p) => {
      const dx = p.x - centro.x;
      const dy = p.y - centro.y;
      return { x: centro.x + dx * cos - dy * sin, y: centro.y + dx * sin + dy * cos };
    });
  },
};
