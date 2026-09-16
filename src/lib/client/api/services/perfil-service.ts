import 'client-only';

import { internalApi } from "./internal-api";

interface PerfilDTO {
  email?: string;
  nombre?: string;
  apellidos?: string;
  telefono?: string;
  tipoUsuarioId?: number | null;
  idEmpresa?: string | null;
  nombreEmpresa?: string | null;
}

export type { PerfilDTO };

export const perfilService = {
  get() {
    return internalApi.get<PerfilDTO>("/api/auth/perfil");
  },
  update(data: Partial<PerfilDTO>) {
    return internalApi.patch<{ ok: boolean }>("/api/auth/perfil", data);
  },
  requestReset(email: string) {
    return internalApi.post<{ ok: boolean; message: string }>("/api/auth/reset-password", { email });
  },
  confirmReset(token: string, password: string) {
    return internalApi.post<{ ok: boolean }>("/api/auth/reset-password/confirm", { token, password });
  },
};
