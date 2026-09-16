import 'client-only';

import type { LoginRequestDTO, LoginResponseDTO, SessionDTO, SeleccionarEventoRequestDTO } from "@/types/dto/models";
import { internalApi } from "./internal-api";

export const authService = {
  login(body: LoginRequestDTO) {
    return internalApi.post<LoginResponseDTO>("/api/auth/login", body);
  },
  logout() {
    return internalApi.post<void>("/api/auth/logout");
  },
  getSession() {
    return internalApi.get<SessionDTO>("/api/auth/session");
  },
  seleccionarEvento(body: SeleccionarEventoRequestDTO) {
    return internalApi.post<void>("/api/auth/seleccionar-evento", body);
  },
};
