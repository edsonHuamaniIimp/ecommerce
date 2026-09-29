export interface StandExhibidoraDTO {
  stand_api_id: string;
  stand_numero: string;
  tipo_stand: string | null;
  /** Estado comercial: `disponible` | `en_evaluacion` | `reservado`. */
  estado: string | null;
  /** Estado crudo de la solicitud asociada (trazabilidad). */
  estado_solicitud: string | null;
  /** Nombre legible del pabellon (null mientras no haya fuente oficial; nunca coordenadas). */
  pabellon: string | null;
  /** Zona/sector del stand (si existe). */
  zona: string | null;
  /** Coordenada X del stand (extraida de `pabellon`). */
  x: number | null;
  /** Coordenada Y del stand (extraida de `pabellon`). */
  y: number | null;
  empresa: string | null;
  /** Empresa montajista asignada al stand (SIE), null si sin asignar. */
  empresa_montajista_id: string | null;
  empresa_montajista_nombre: string | null;
  /** Contexto transversal de evento (clave compartida con otros sistemas) */
  evento_id: string;
  tipo_evento: number;
  codigo_evento: number;
  /** Mapa 3D (plano) al que pertenece el stand via bloqueId. null si no esta vinculado */
  mapa: string | null;
}

/** Empresa montajista (catalogo para el selector / validacion). */
export interface EmpresaMontajistaDTO {
  sie_code: string;
  razon_social: string;
}

/** Request M2M/UI para asignar o desasignar la montajista de un stand. */
export interface AsignarMontajistaInput {
  tipo_evento: number;
  codigo_evento: number;
  stand_api_id: string;
  /** null = desasignar. */
  empresa_montajista: { sie_code: string; razon_social: string } | null;
}

/** Resultado de la asignacion. */
export interface AsignacionMontajistaDTO {
  stand_api_id: string;
  empresa_montajista_id: string | null;
  empresa_montajista_nombre: string | null;
  actualizado_en: string | null;
}

export interface ContratoStandDTO {
  stand_api_id: string;
  estado_solicitud: string;
  estado_contrato: "FIRMADO_Y_VIGENTE" | "EN_REVISION" | "OBSERVADO" | "PENDIENTE_FIRMA" | "RESCINDIDO";
  fecha_aprobacion: string | null;
  id_contrato: string | null;
}
