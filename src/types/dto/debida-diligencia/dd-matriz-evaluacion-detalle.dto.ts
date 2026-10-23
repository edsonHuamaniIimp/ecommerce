/** Bloque de conclusiones de un area (SIG, Reputacional o Compliance). */
export interface DdMatrizBloqueDTO {
  fecha: string | null;
  responsable: string | null;
  resultado: string | null;
  observaciones: string | null;
  conclusion: string | null;
}

export interface DdMatrizAdjuntoDTO {
  id: string;
  categoria: string;
  nombre: string;
  url: string;
  mimeType: string;
  tamano: number;
  creadoPor: string;
  createdAt: string;
}

export interface DdMatrizListaDTO {
  codigo: string;
  label: string;
  color: string;
  /** Respuesta registrada (si/no/na); null si aun no se evalua. */
  valor: string | null;
}

export interface DdMatrizGeneralesDTO {
  /** Fecha ISO (YYYY-MM-DD). */
  fechaInicioActividades: string | null;
  estadoContribuyente: string | null;
  direccionLegal: string | null;
  actividadEconomica: string | null;
  motivo: string | null;
  eventoProyecto: string | null;
  /** Pais ISO de la empresa (solo lectura; se edita en la seccion Pais y ambito). */
  paisEmpresa: string | null;
  historialIimp: string | null;
  beneficioMutuo: string | null;
}

/** Que puede hacer el usuario autenticado sobre este vinculo. */
export interface DdMatrizPermisosDTO {
  editarIdentidad: boolean;
  editarGenerales: boolean;
  editarListas: boolean;
  editarSig: boolean;
  /** Resultado y observaciones reputacionales (Comunicaciones). */
  editarReputacional: boolean;
  /** SIG puede ajustar solo la conclusion reputacional. */
  editarConclusionReputacional: boolean;
  editarCompliance: boolean;
  editarFinal: boolean;
  /** Compliance se habilita cuando SIG exige debida diligencia reforzada y adjunta informe. */
  complianceDesbloqueado: boolean;
  puedeEliminar: boolean;
}

export interface DdMatrizExpedienteDTO {
  expedienteId: string;
  codigo: string;
  estado: string;
  empresaRazonSocial: string;
  empresaRuc: string;
  paisConstitucion: string | null;
  actividadEconomica: string | null;
  tipoRelacionComercial: string | null;
  motivo: string | null;
  eventoProyecto: string | null;
  fechaIngreso: string;
  revisadoPor: string | null;
  fechaRevision: string | null;
}

/** Detalle completo de un vinculo de la Matriz de evaluacion DD. */
export interface DdMatrizEvaluacionDetalleDTO {
  id: string;
  tipo: string;
  origen: string;
  nombre: string;
  tipoDocumento: string | null;
  documento: string | null;
  nacionalidad: string | null;
  cargo: string | null;
  ambito: string;
  ambitoEditado: boolean;
  /** Pais ISO alpha-2; null si no se conoce. */
  pais: string | null;
  paisEditado: boolean;
  expediente: DdMatrizExpedienteDTO;
  generales: DdMatrizGeneralesDTO;
  listas: DdMatrizListaDTO[];
  sig: DdMatrizBloqueDTO;
  reputacional: DdMatrizBloqueDTO;
  compliance: DdMatrizBloqueDTO;
  resultadoFinal: string | null;
  finalFecha: string | null;
  finalPor: string | null;
  adjuntos: DdMatrizAdjuntoDTO[];
  permisos: DdMatrizPermisosDTO;
  updatedAt: string;
}
