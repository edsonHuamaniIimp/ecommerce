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
  /** RUC de la empresa seleccionada; el servidor resuelve la empresa fiscal local (FK). */
  ruc?: string | null;
  /** Empresa fiscal local vinculada (viene del GET); null si no hay registro local con su RUC. */
  empresa?: {
    ruc: string;
    razonSocial: string;
    direccionFiscal: string | null;
    telefono: string | null;
    emailContacto: string | null;
    representanteLegalNombre: string | null;
    representanteLegalDni: string | null;
    representanteCorreo: string | null;
    representanteCelular: string | null;
    representanteDireccion: string | null;
    /** Partida electronica del representante (ficha: partidaElectronica). */
    representantePartida: string | null;
  } | null;
  /** true = tiene empresa y le faltan datos obligatorios del representante legal. */
  representanteIncompleto?: boolean;
  /** Datos del representante legal (se guardan en la ficha de la empresa). */
  representanteNombre?: string | null;
  representanteDni?: string | null;
  representanteCorreo?: string | null;
  representanteCelular?: string | null;
  representanteDireccion?: string | null;
  representantePartida?: string | null;
  /** Logo propio del usuario (URL); prioridad sobre el de su empresa en el mapa. */
  logoUrl?: string | null;
  /** Firma digital del usuario (imagen); se usa para firmar contratos desde el portal. */
  firmaUrl?: string | null;
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
