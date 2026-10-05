export interface DatosFacturacionRequestDTO {
  razonSocial: string;
  tipoDocumento: string;
  numeroDocumento: string;
  email: string;
  /** Datos comerciales del paso 1 (snapshot fiscal de la solicitud). */
  tipoComprobante?: string;
  direccion?: string;
  telefono?: string;
  contacto?: string;
}

export interface ReservaRequestDTO {
  standIds: string[];
  documentos?: string[];
  datos?: DatosFacturacionRequestDTO;
}

export interface ReservaResponseDTO {
  ok?: boolean;
  error?: string;
  conflicted?: string[];
  message?: string;
  /** Solicitud creada por la reserva (para generar el contrato). */
  solicitudId?: string | null;
}
