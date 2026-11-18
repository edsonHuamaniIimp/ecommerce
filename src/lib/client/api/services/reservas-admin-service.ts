"use client";

import { internalApi } from "./internal-api";
import type { ReservaAdminRequestDTO, ReservaAdminResponseDTO } from "@/types/dto/reserva";

/** Fachada de la reserva interna a nombre de una empresa. */
export const reservasAdminService = {
  crear(body: ReservaAdminRequestDTO) {
    return internalApi.post<ReservaAdminResponseDTO>("/api/reservas/admin", body);
  },
};
