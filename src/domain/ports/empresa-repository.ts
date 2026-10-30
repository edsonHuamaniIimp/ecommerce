import type {
  CrearEmpresaData,
  EmpresaEntity,
  EmpresaRepresentanteAdicionalInput,
  EmpresasListParams,
  EmpresasPaginatedResult,
} from "@/domain/models/empresa";
import type { ConfigCuotasEmpresa } from "@/lib/shared/utils/cuotas";

/** Datos parciales para actualizar una empresa (solo los campos presentes). */
export interface ActualizarEmpresaData {
  ruc?: string;
  /** Tipo de documento de empresa (TIPOS_DOCUMENTO_EMPRESA). */
  tipoDocumento?: string;
  pais?: string;
  paisOrigen?: string | null;
  paisSincronizadoEn?: Date | null;
  /** Identificador de la empresa en servicio-persona (sie_code). */
  sieCode?: string | null;
  razonSocial?: string;
  logoUrl?: string | null;
  nombreComercial?: string | null;
  direccionFiscal?: string | null;
  inicioOperaciones?: Date | null;
  telefono?: string | null;
  emailContacto?: string | null;
  emailFacturacion?: string | null;
  representanteLegalNombre?: string | null;
  representanteLegalTipoDocumento?: string | null;
  representanteLegalDni?: string | null;
  representanteCorreo?: string | null;
  representanteCelular?: string | null;
  representanteDireccion?: string | null;
  /** Codigo SIE del representante en servicio-persona (se guarda al sincronizar). */
  representanteSieCode?: string | null;
  representanteUserId?: string | null;
  partidaElectronica?: string | null;
  /** Datos adicionales de la solicitud de participacion. */
  nombreFriso?: string | null;
  actividadEconomica?: string | null;
  estadoContribuyente?: string | null;
  facturarANombre?: string | null;
  responsableExteminNombre?: string | null;
  responsableExteminTelefono?: string | null;
  responsableExteminTipoDocumento?: string | null;
  responsableExteminDni?: string | null;
  responsableExteminEmail?: string | null;
  responsablePagosNombre?: string | null;
  responsablePagosTelefono?: string | null;
  responsablePagosTipoDocumento?: string | null;
  responsablePagosDni?: string | null;
  responsablePagosEmail?: string | null;
  /** Configuracion personalizada de cuotas (null = volver al cronograma estandar). */
  configCuotas?: ConfigCuotasEmpresa | null;
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
  findPaisesPendientes(limite?: number): Promise<EmpresaEntity[]>;
  /** Busca por RUC exacto (para validar duplicados). */
  findByRuc(ruc: string): Promise<EmpresaEntity | null>;
  /** Busca por codigo SIE (servicio-persona/entidades); null si la ficha no lo tiene guardado. */
  findBySieCode(sieCode: string): Promise<EmpresaEntity | null>;
  create(data: CrearEmpresaData): Promise<EmpresaEntity>;
  update(id: string, data: ActualizarEmpresaData): Promise<EmpresaEntity>;
  /** Reemplaza los representantes adicionales activos; los omitidos pasan a baja logica. */
  replaceRepresentantesAdicionales(
    empresaId: string,
    representantes: EmpresaRepresentanteAdicionalInput[],
  ): Promise<void>;
}
