import type {
  CrearEmpresaData,
  EmpresaEntity,
  EmpresasListParams,
  EmpresasPaginatedResult,
} from "@/domain/models/empresa";

/** Datos parciales para actualizar una empresa (solo los campos presentes). */
export interface ActualizarEmpresaData {
  ruc?: string;
  /** Identificador de la empresa en servicio-persona (sie_code). */
  sieCode?: string | null;
  razonSocial?: string;
  logoUrl?: string | null;
  nombreComercial?: string | null;
  direccionFiscal?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  emailFacturacion?: string | null;
  representanteLegalNombre?: string | null;
  representanteLegalDni?: string | null;
  partidaElectronica?: string | null;
  tipoComprobante?: string;
  sitioWeb?: string | null;
  estado?: string;
  cuentaCreada?: boolean;
  primerAccesoCompletado?: boolean;
  datosValidadosEn?: Date | null;
}

export interface IEmpresaRepository {
  listarPaginated(params: EmpresasListParams): Promise<EmpresasPaginatedResult>;
  findById(id: string): Promise<EmpresaEntity | null>;
  /** Busca por RUC exacto (para validar duplicados). */
  findByRuc(ruc: string): Promise<EmpresaEntity | null>;
  create(data: CrearEmpresaData): Promise<EmpresaEntity>;
  update(id: string, data: ActualizarEmpresaData): Promise<EmpresaEntity>;
}
