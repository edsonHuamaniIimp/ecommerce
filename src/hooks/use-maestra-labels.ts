"use client";

import { useEffect, useState } from "react";
import { maestraService } from "@/lib/client/api/services/maestra-service";

/**
 * Etiquetas de un catalogo de la tabla maestra: parte de las etiquetas por defecto
 * (constantes) y las sobreescribe con el `nombre` configurado en la maestra.
 * Los mapas deben ser constantes de modulo (referencias estables).
 */
export function useMaestraLabels(
  tabla: string,
  itemIds: Readonly<Record<string, number>>,
  labelsPorDefecto: Readonly<Record<string, string>>,
): Record<string, string> {
  const [labels, setLabels] = useState<Record<string, string>>({ ...labelsPorDefecto });

  useEffect(() => {
    let vigente = true;
    maestraService
      .listar(tabla)
      .then((items) => {
        if (!vigente) return;
        const porItem = new Map<number, string>();
        for (const item of items) {
          if (item.itemId !== null) porItem.set(item.itemId, item.nombre);
        }
        const next: Record<string, string> = { ...labelsPorDefecto };
        for (const [clave, itemId] of Object.entries(itemIds)) {
          const nombre = porItem.get(itemId);
          if (nombre) next[clave] = nombre;
        }
        setLabels(next);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [tabla, itemIds, labelsPorDefecto]);

  return labels;
}
