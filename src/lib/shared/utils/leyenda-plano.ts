import {
  COLOR_STAND_RESERVADO,
  COLOR_STAND_SELECCIONADO,
  ESTADOS_STAND_LEGACY,
} from "@/lib/shared/constants";
import type { PlanoItem } from "@/lib/shared/planos/registry";

export interface LeyendaPlanoItem {
  color: string;
  label: string;
}

/**
 * Deriva la leyenda del chrome a partir de la definicion del plano, para que los
 * colores coincidan siempre con los que pinta el visor. Agrega los estados que el
 * visor aplica sobre el color base (reservado y seleccion).
 */
export function leyendaPlano(
  items: PlanoItem[],
  blockLabel: (type: string) => { label: string; nombre: string },
): LeyendaPlanoItem[] {
  const porTipo = new Map<string, LeyendaPlanoItem>();
  for (const item of items) {
    if (!porTipo.has(item.type)) {
      porTipo.set(item.type, { color: item.dim.color, label: blockLabel(item.type).label });
    }
  }
  return [
    ...porTipo.values(),
    { color: COLOR_STAND_RESERVADO, label: ESTADOS_STAND_LEGACY.RESERVADO },
    { color: COLOR_STAND_SELECCIONADO, label: "Tu seleccion" },
  ];
}
