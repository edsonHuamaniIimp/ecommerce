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
    nombreComercial: string | null;
    direccionFiscal: string | null;
    telefono: string | null;
    emailContacto: string | null;
    emailFacturacion: string | null;
    tipoComprobante: string;
    sitioWeb: string | null;
    representanteLegalNombre: string | null;
    representanteLegalDni: string | null;
    representanteCorreo: string | null;
    representanteCelular: string | null;
    representanteDireccion: string | null;
    /** Partida electronica del representante (ficha: partidaElectronica). */
    representantePartida: string | null;
    /** Configuracion personalizada de cuotas (Modalidad 4); null = cronograma estandar. */
    configCuotas: { maxCuotas: number; fechas: string[] } | null;
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
  /** Correo verificado para notificaciones; null = correo de acceso. */
  notificationEmail?: string | null;
  /** Correo pendiente de verificacion. */
  notificationEmailPending?: string | null;
  /** Correos disponibles para elegir como destino de notificaciones. */
  emailsNotificacion?: { email: string; label: string; activo: boolean }[];
  notificationEmailVerifiedAt?: string | null;
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
  solicitarNotificacion(email: string) {
    return internalApi.post<{ ok: boolean; email: string; verificado: boolean; emailEnviado?: boolean; expiraEnMinutos?: number }>(
      "/api/auth/notificaciones/solicitar",
      { email },
    );
  },
  confirmarNotificacion(codigo: string) {
    return internalApi.post<{ ok: boolean; email: string }>("/api/auth/notificaciones/confirmar", { codigo });
  },
};
