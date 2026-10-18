/** Contrato de las plantillas de correo: un tipo por plantilla y sus datos. */

export interface PlantillaEmail {
  subject: string;
  html: string;
}

export interface DatosPlantilla {
  /** Codigo de verificacion del registro de exhibidor. */
  "codigo-registro": { codigo: string; nombre: string };
  /** Restablecimiento de contrasena. */
  "reset-password": { nombre?: string | null; url: string; minutos: number };
  /** Credenciales del Portal del Cliente (cuenta creada por backoffice). */
  "credenciales-empresa": {
    razonSocial: string;
    nombreContacto: string | null;
    email: string;
    passwordTemporal: string;
  };
  /** Notificacion a RR.HH. por una solicitud de cuenta de exhibidor. */
  "notificacion-solicitud-cuenta": {
    email: string;
    nombre: string;
    apellidos: string;
    razonSocial: string;
    ruc?: string | null;
    telefono?: string | null;
    cargo?: string | null;
    mensaje?: string | null;
  };
  /** Invitacion al exhibidor aprobado para crear su contrasena. */
  "invitacion-cuenta": { nombre: string; razonSocial: string; token: string };
  /** Aviso de solicitud de cuenta rechazada. */
  "rechazo-cuenta": { nombre: string; razonSocial: string; motivo: string };
  /** Confirmacion de reserva al cliente (simple o multiple). */
  "reserva-confirmacion": {
    standCodes: string;
    razonSocial: string;
    documento: string;
    esMultiple?: boolean;
    solicitudId?: string;
  };
  /** Alerta al administrador por una nueva solicitud de reserva. */
  "reserva-admin": {
    standCodes: string;
    razonSocial: string;
    documento: string;
    emailCliente: string;
    solicitudId?: string;
  };
  /** Resultado de revision por areas (automatico o mensaje libre del admin). */
  "revision-resultado": {
    standCode: string;
    empresa: string;
    nombre: string;
    email: string;
    gessStandId: string;
    modo: "automatico" | "personalizado";
    mensaje?: string;
    revisiones: { area: string; estado: string; comentario: string | null }[];
  };
  /** Aviso al cliente de que Facturacion adjunto el comprobante fiscal de su pago. */
  "comprobante-pago": {
    standCode: string;
    /** "boleta" | "factura" (ver TIPOS_COMPROBANTE). */
    tipo: string;
    numero: string;
  };
  /** Debida Diligencia: expediente recibido y en revision. */
  "dd-recibida": { codigo: string; razonSocial: string };
  /** Debida Diligencia: expediente observado (correcciones solicitadas). */
  "dd-observada": { codigo: string; razonSocial: string; observaciones: string[] };
  /** Debida Diligencia: expediente aprobado. */
  "dd-aprobada": { codigo: string; razonSocial: string; fechaVencimiento: string };
  /** Debida Diligencia: expediente rechazado. */
  "dd-rechazada": { codigo: string; razonSocial: string; motivo: string };
  /** Debida Diligencia: expediente derivado a revision legal. */
  "dd-legal-revision": { codigo: string; razonSocial: string; motivo: string };
  /** Solicitud de reserva observada: el cliente debe reemplazar documentos y reenviar. */
  "documentos-observados": {
    standCodes: string;
    documentos: string[];
    justificacion: string;
    url: string;
  };
}

export type PlantillaEmailKind = keyof DatosPlantilla;

/** Constructor de una plantilla (recibe solo los datos de su tipo). */
export type ConstructorPlantilla<K extends PlantillaEmailKind> = (datos: DatosPlantilla[K]) => PlantillaEmail;

/** Paquete completo de plantillas de un idioma. */
export type PlantillasEmail = { [K in PlantillaEmailKind]: ConstructorPlantilla<K> };
