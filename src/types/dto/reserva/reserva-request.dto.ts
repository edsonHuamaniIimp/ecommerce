export interface ReservaRequestDTO {
  standIds: string[];
  documentos?: string[];
  datos?: {
    razonSocial: string;
    tipoDocumento: string;
    numeroDocumento: string;
    email: string;
  };
}

export interface ReservaResponseDTO {
  ok?: boolean;
  error?: string;
  conflicted?: string[];
  message?: string;
  /** Solicitud creada por la reserva (para generar el contrato). */
  solicitudId?: string | null;
}
