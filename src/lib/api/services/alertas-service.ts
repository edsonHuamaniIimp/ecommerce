import { internalApi } from "./internal-api";

interface AlertaDTO {
  id: string;
  userId: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  url: string | null;
  solicitudId: string | null;
  createdAt: string;
}

export const alertasService = {
  listar(soloNoLeidas = false) {
    const qs = soloNoLeidas ? "?no_leidas=1" : "";
    return internalApi.get<{ alertas: AlertaDTO[]; noLeidas: number }>(`/api/alertas/listar${qs}`);
  },

  marcarLeida(id: string) {
    return internalApi.post<{ ok: boolean }>("/api/alertas/marcar-leida", { id });
  },

  marcarTodasLeidas() {
    return internalApi.post<{ ok: boolean }>("/api/alertas/marcar-todas-leidas");
  },
};
