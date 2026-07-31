import { internalApi } from "./internal-api";
import type { MaestraItemDTO } from "@/types/dto/maestra";

export const maestraService = {
  listar(tabla: string) {
    return internalApi.get<MaestraItemDTO[]>(`/api/maestra/listar?tabla=${encodeURIComponent(tabla)}`);
  },
};
