export interface StandExhibidoraDTO {
  stand_api_id: string;
  stand_numero: string;
  tipo_stand: string | null;
  estado: string | null;
  pabellon: string | null;
  empresa: string | null;
  /** Contexto transversal de evento (clave compartida con otros sistemas) */
  evento_id: string;
  tipo_evento: number;
  codigo_evento: number;
  /** Mapa 3D (plano) al que pertenece el stand via bloqueId. null si no esta vinculado */
  mapa: string | null;
}

export interface ContratoStandDTO {
  stand_api_id: string;
  estado_solicitud: string;
  estado_contrato: "FIRMADO_Y_VIGENTE" | "EN_REVISION" | "OBSERVADO" | "PENDIENTE_FIRMA" | "RESCINDIDO";
  fecha_aprobacion: string | null;
  id_contrato: string | null;
}
