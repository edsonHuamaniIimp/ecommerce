import 'client-only';

import type { LoginRequestDTO, LoginResponseDTO, SessionDTO, SeleccionarEventoRequestDTO } from "@/types/dto/models";
import type { RegistroRequestDTO } from "@/types/dto/auth/registro-request.dto";
import type { RegistroResult } from "@/types/dto/auth/registro-result.dto";
import type { RegistroConfirmarRequestDTO } from "@/types/dto/auth/registro-confirmar-request.dto";
import { internalApi } from "./internal-api";

export const authService = {
  login(body: LoginRequestDTO) {
    return internalApi.post<LoginResponseDTO>("/api/auth/login", body);
  },
  /** Devuelve el resultado exitoso; los errores de negocio llegan como excepcion. */
  registrar(body: RegistroRequestDTO) {
    return internalApi.post<Extract<RegistroResult, { ok: true }>>("/api/auth/registro", body);
  },
  confirmarRegistro(body: RegistroConfirmarRequestDTO) {
    return internalApi.post<LoginResponseDTO>("/api/auth/registro/confirmar", body);
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
