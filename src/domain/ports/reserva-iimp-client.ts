/** Contacto del API de reserva (contrato, responsable u pagos). */
export interface ReservaIimpContacto {
  nombre: string;
  cargo?: string | null;
  tipoDocumento?: string | null;
  numDocumento?: string | null;
  email?: string | null;
  telefono?: string | null;
}

/** Cuota del API de reserva: porcentaje entero y fecha AAAA-MM-DD. */
export interface ReservaIimpCuotaInput {
  porcentaje: number;
  fecha: string;
}

/** Payload de POST /stands/reserva (API del IIMP). */
export interface ReservaIimpInput {
  tipEvCod: number;
  evenCod: number;
  stands: string[];
  tipoFacturacion: string;
  tipDocFacturacion: string;
  numDocFacturacion: string;
  /** Empresa: obligatorio con documento `6` (RUC) o `0` (extranjera). */
  razonSocial?: string | null;
  /** Persona: obligatorios con documento `1` (DNI), `4` (CE) o `7` (pasaporte). */
  apellidoPaternoFact?: string | null;
  apellidoMaternoFact?: string | null;
  nombresFact?: string | null;
  dirFacturacion: string;
  web?: string | null;
  telefono?: string | null;
  friso?: string | null;
  contactos: {
    contrato: ReservaIimpContacto;
    responsable?: ReservaIimpContacto | null;
    pagos: ReservaIimpContacto;
  };
  cuotas: ReservaIimpCuotaInput[];
}

/** Documento fiscal emitido para una cuota (factura/boleta). */
export interface ReservaIimpDocumento {
  tipoDocumento: string;
  serie: string;
  numero: number;
  fechaEmision: string;
  tipoCambio: string;
  igv: string;
  total: string;
}

export interface ReservaIimpCuota {
  cuota: number;
  porcentaje: string;
  fecha: string;
  baseImponible: string;
  igv: string;
  total: string;
  /** Solo la 1ra cuota trae el comprobante emitido al reservar. */
  documento: ReservaIimpDocumento | null;
}

export interface ReservaIimpResponse {
  contrato: string;
  cuentaCorriente: number;
  cliente: { tipo: string; codigo: string; nombre: string; tipDocumento: string; numDocumento: string };
  moneda: string;
  stands: Array<{ numero: string; tipo: string; pabellon: string; area: string; precio: string }>;
  cuotas: ReservaIimpCuota[];
  baseImponible: string;
  igv: string;
  total: string;
}

export interface IReservaIimpClient {
  /** Registra la reserva (contrato + cuenta corriente) y emite la factura de la 1ra cuota. */
  reservar(input: ReservaIimpInput): Promise<ReservaIimpResponse>;
}
