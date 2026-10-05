/** Comprobante fiscal (boleta/factura) adjuntado a una cuota pagada. */
export interface ComprobanteFiscalRow {
  tipo: string;
  numero: string;
  url: string;
  at: string;
  by: string | null;
}

export interface FacturacionRow {
  id: string;
  solicitudId: string;
  tipo: string;
  estado: string;
  montoTotal: number;
  moneda: string;
  modoPago: string;
  /** El plan de pago lo definio el cliente al reservar (`solicitud.plan_cuotas`): no editable. */
  planCliente: boolean;
  standCode: string;
  correoSolicitante: string | null;
  /** Contrato y cuenta corriente del IIMP cuando la reserva ya se registro alli. */
  iimpContrato: string | null;
  iimpCuentaCorriente: string | null;
  createdAt: string;
  cuotas: Array<{
    id: string;
    numero: number;
    monto: number;
    fechaVencimiento: string | null;
    estado: string;
    comprobante: string | null;
    comprobanteFiscal: ComprobanteFiscalRow | null;
    /** Documento fiscal emitido por el IIMP para la cuota (1ra al reservar; resto en su fecha). */
    iimpDocumento: IimpDocumentoRow | null;
  }>;
}

/** Comprobante fiscal emitido por el API de reserva del IIMP. */
export interface IimpDocumentoRow {
  tipoDocumento: string;
  serie: string;
  numero: number;
  fechaEmision: string;
  tipoCambio: string;
  igv: string;
  total: string;
}

export interface FacturacionListParams {
  page: number;
  perPage: number;
  eventoId?: string;
}

export interface FacturacionListResult {
  data: FacturacionRow[];
  total: number;
}

/** Identidad del exhibidor (sesion) para validar propiedad de una facturacion. */
export interface ClienteIdent {
  userId?: string | null;
  email?: string | null;
}

/** Paginado de facturaciones del propio cliente (opcionalmente del evento activo). */
export interface FacturacionClienteParams extends ClienteIdent {
  page: number;
  perPage: number;
}

/** Datos editables de una cuota por el cliente/admin. */
export interface CuotaUpdate {
  monto?: number;
  fechaVencimiento?: string | null;
}

/** Datos del comprobante fiscal que adjunta Facturacion a una cuota pagada. */
export interface DatosComprobanteFiscal {
  tipo: string;
  numero: string;
  url: string;
}

export interface IFacturacionRepository {
  listar(params: FacturacionListParams): Promise<FacturacionListResult>;
  /** Facturaciones cuya solicitud pertenece al cliente (userId o email). */
  listarPorCliente(params: FacturacionClienteParams): Promise<FacturacionListResult>;
  detalle(id: string): Promise<FacturacionRow | null>;
  agregarCuota(facturacionId: string, monto: number, fechaVencimiento: string | null, createdBy: string): Promise<void>;
  actualizarCuota(cuotaId: string, data: CuotaUpdate, createdBy: string): Promise<void>;
  /** Adjunta/reemplaza el voucher (comprobante) de una cuota sin cambiar su estado. */
  adjuntarVoucher(cuotaId: string, comprobante: string, createdBy: string): Promise<void>;
  pagarCuota(cuotaId: string, createdBy: string, comprobante: string | null): Promise<void>;
  /** Adjunta/reemplaza el comprobante fiscal (boleta/factura) de una cuota pagada. */
  adjuntarComprobanteFiscal(cuotaId: string, data: DatosComprobanteFiscal, createdBy: string): Promise<void>;
  /** Guarda el documento fiscal emitido por el IIMP en la cuota con ese numero. */
  guardarDocumentoIImp(facturacionId: string, numero: number, documento: unknown, emitidaAt: Date): Promise<void>;
  actualizar(id: string, data: { tipo?: string; modoPago?: string }, createdBy: string): Promise<void>;
  eliminar(id: string, createdBy: string): Promise<void>;
  eliminarCuota(cuotaId: string, createdBy: string): Promise<void>;
  /** true si la facturacion pertenece al cliente indicado. */
  esPropietario(facturacionId: string, ident: ClienteIdent): Promise<boolean>;
  /** true si la cuota pertenece a una facturacion del cliente indicado. */
  esPropietarioDeCuota(cuotaId: string, ident: ClienteIdent): Promise<boolean>;
  /** Facturacion (con cuotas) a la que pertenece una cuota. */
  facturacionDeCuota(cuotaId: string): Promise<FacturacionRow | null>;
}
