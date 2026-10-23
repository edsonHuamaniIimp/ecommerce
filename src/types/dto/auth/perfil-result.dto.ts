export interface CorreoNotificacionDisponible {
  email: string;
  label: string;
  /** True si es el correo verificado actualmente para notificaciones. */
  activo: boolean;
}

export interface PerfilResult {
  email: string;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
  tipoUsuarioId: number | null;
  idEmpresa: string | null;
  nombreEmpresa: string | null;
  /** Correo verificado para notificaciones; null = usar el correo de acceso. */
  notificationEmail: string | null;
  /** Correo pendiente de verificar; null = sin verificacion en curso. */
  notificationEmailPending: string | null;
  /** Correos que el usuario puede elegir para notificaciones. */
  emailsNotificacion: CorreoNotificacionDisponible[];
  /** Fecha de verificacion del correo de notificaciones. */
  notificationEmailVerifiedAt: Date | null;
  /** Empresa fiscal local vinculada (FK `empresa_id`); null si no hay registro local con su RUC. */
  empresa: {
    ruc: string;
    pais: string;
    razonSocial: string;
    nombreComercial: string | null;
    direccionFiscal: string | null;
    telefono: string | null;
    emailContacto: string | null;
    emailFacturacion: string | null;
    nombreFriso: string | null;
    actividadEconomica: string | null;
    estadoContribuyente: string | null;
    facturarANombre: string | null;
    responsableExteminNombre: string | null;
    responsableExteminTelefono: string | null;
    responsableExteminDni: string | null;
    responsableExteminEmail: string | null;
    responsablePagosNombre: string | null;
    responsablePagosTelefono: string | null;
    responsablePagosDni: string | null;
    responsablePagosEmail: string | null;
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
  /** true = el usuario tiene empresa y le faltan datos obligatorios del representante legal. */
  representanteIncompleto: boolean;
  /** Logo propio del usuario (URL); tiene prioridad sobre el de su empresa en el mapa. */
  logoUrl: string | null;
  /** Firma digital del usuario (URL de la imagen); se usa para firmar contratos desde el portal. */
  firmaUrl: string | null;
  /** Idioma preferido (es | en). */
  idioma: string | null;
}
