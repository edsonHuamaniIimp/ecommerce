import type { DdEtapaEnvio } from "@/lib/shared/constants";

/** Datos base de una notificacion de debida diligencia. */
export interface DdNotificacionBase {
  to: string;
  codigo: string;
  razonSocial: string;
}

export interface DdNotificacionRecibida extends DdNotificacionBase {
  etapa: DdEtapaEnvio;
}

export interface DdNotificacionObservada extends DdNotificacionBase {
  observaciones: string[];
}

export interface DdNotificacionAprobada extends DdNotificacionBase {
  fechaVencimiento: Date | null;
}

export interface DdNotificacionRechazada extends DdNotificacionBase {
  motivo: string | null;
}

/** Puerto de notificaciones del modulo (correo + campana interna). */
export interface IDebidaDiligenciaNotificacionPort {
  expedienteRecibido(datos: DdNotificacionRecibida): Promise<void>;
  expedienteObservado(datos: DdNotificacionObservada): Promise<void>;
  expedienteAprobado(datos: DdNotificacionAprobada): Promise<void>;
  expedienteRechazado(datos: DdNotificacionRechazada): Promise<void>;
  notificarLogistica(email: string, mensaje: string, url: string): Promise<void>;
  /** Alerta + correo a quienes tienen permiso de Legal; `reenvio` = el cliente subsano una observacion legal. */
  notificarLegal(datos: {
    codigo: string;
    razonSocial: string;
    motivo: string | null;
    reenvio?: boolean;
  }): Promise<void>;
  /** Avisa a los usuarios con acceso a la matriz que el cliente reenvió la documentación. */
  notificarReenvioLogistica(datos: {
    codigo: string;
    razonSocial: string;
    observacionesRespondidas: number;
  }): Promise<void>;
}
