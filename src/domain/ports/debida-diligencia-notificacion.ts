/** Datos base de una notificacion de debida diligencia. */
export interface DdNotificacionBase {
  to: string;
  codigo: string;
  razonSocial: string;
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
  expedienteRecibido(datos: DdNotificacionBase): Promise<void>;
  expedienteObservado(datos: DdNotificacionObservada): Promise<void>;
  expedienteAprobado(datos: DdNotificacionAprobada): Promise<void>;
  expedienteRechazado(datos: DdNotificacionRechazada): Promise<void>;
  notificarLogistica(email: string, mensaje: string, url: string): Promise<void>;
  notificarLegal(datos: { codigo: string; razonSocial: string; motivo: string | null }): Promise<void>;
}
