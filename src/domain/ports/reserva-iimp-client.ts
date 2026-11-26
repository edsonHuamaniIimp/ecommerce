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
  /** Texto libre de la cuota (max. 100): se migra a SAP como FreeTxt de la orden de venta. */
  textoLibre?: string | null;
  /** Importes de la cuota en la moneda del contrato (solo solicitudes internas, string decimal 2 dec.). */
  baseImponible?: string;
  igv?: string;
  monto?: string;
}

/** Condiciones comerciales pactadas (solo solicitudes internas). Importes string decimal, 2 dec. */
export interface ReservaIimpComercial {
  /** NINGUNO | PORCENTAJE | MONTO | POR_STAND */
  tipoDescuento: string;
  sumaLista: string;
  descuentoTotal: string;
  baseImponible: string;
  tasaIgv: string;
  igv: string;
  total: string;
}

/** Precio pactado por stand (solo solicitudes internas con descuento por stand). */
export interface ReservaIimpStandDetalle {
  numero: string;
  precioLista: string;
  descuentoPorcentaje: string;
  descuentoMonto: string;
  precioNeto: string;
}

/** Declaracion de requisitos de facturacion (solo solicitudes internas). */
export interface ReservaIimpRequisitos {
  oc: boolean;
  hes: boolean;
  plataforma: boolean;
  plataformaNombre: string | null;
  plataformaUrl: string | null;
  valorizacion: boolean;
  otros: string | null;
  ninguna: boolean;
  cuotaOrigen: number | null;
}

/** Trazabilidad del registro (solo solicitudes internas). */
export interface ReservaIimpOrigen {
  sistema: string;
  tipoSolicitud: string;
  registradoPor: string | null;
  /** ISO-8601 UTC. */
  registradoEn: string;
  /** ISO-8601 UTC; solo si lo registro una tarea programada. */
  programadaPara: string | null;
}

/** Archivo (link) de la cuenta corriente del IIMP: OC, HES, detraccion o diferencia. */
export interface ReservaIimpArchivoInput {
  tipo: string;
  /** Obligatoria en DETRACCION y DIFERENCIA; opcional en OC/HES. */
  cuota?: number | null;
  link: string;
  nombre?: string | null;
}

/** Archivo registrado en la cuenta corriente (respuesta del IIMP). */
export interface ReservaIimpArchivo {
  item: number;
  tipo: string;
  cuota: number | null;
  link: string;
  nombre: string | null;
  fecha: string;
}

/** Payload de POST /stands/reserva (API del IIMP). */
export interface ReservaIimpInput {
  /** PK de la solicitud en la web (hasta 30 chars). Unica: una solicitud = una reserva. */
  numeroSolicitud: string;
  tipEvCod: number;
  evenCod: number;
  /** Moneda de la reserva (USD | PEN). */
  moneda?: string | null;
  /** Tipo de cambio pactado (soles por dolar, 4 dec.). "1.0000" si el contrato es USD. */
  tipoCambio?: string | null;
  stands: string[];
  /** Solicitudes internas: precio pactado por stand (cuando hay descuento por stand). */
  standsDetalle?: ReservaIimpStandDetalle[] | null;
  /** Solicitudes internas: condiciones comerciales pactadas. */
  comercial?: ReservaIimpComercial | null;
  /** Solicitudes internas: modo de pago (completo | cuotas | tres_cuotas | personalizado). */
  modalidad?: string | null;
  /** Solicitudes internas: requisitos de facturacion declarados. */
  requisitos?: ReservaIimpRequisitos | null;
  /** Solicitudes internas: trazabilidad. */
  origen?: ReservaIimpOrigen | null;
  tipoFacturacion: string;
  tipDocFacturacion: string;
  numDocFacturacion: string;
  /** Empresa: obligatorio con documento `6` (RUC) o `0` (extranjera). */
  razonSocial?: string | null;
  /** Empresa extranjera (documento `0`): codigo numerico del pais en el catalogo de ubigeo del SIE (Alemania = 5). */
  pais?: number | null;
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
  /** Links de archivos de la cuenta corriente; tambien se pueden agregar despues. */
  archivos?: ReservaIimpArchivoInput[] | null;
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
  numeroSolicitud: string;
  contrato: string;
  cuentaCorriente: number;
  cliente: { tipo: string; codigo: string; nombre: string; tipDocumento: string; numDocumento: string };
  moneda: string;
  stands: Array<{ numero: string; tipo: string; pabellon: string; area: string; precio: string }>;
  cuotas: ReservaIimpCuota[];
  archivos: ReservaIimpArchivo[];
  baseImponible: string;
  igv: string;
  total: string;
}

/**
 * Identificacion de la cuenta corriente para los endpoints de archivos:
 * `NumeroSolicitud` (recomendado desde la v3) o el trio clasico
 * `TipEvCod` + `EvenCod` + `CuentaCorriente`.
 */
export interface ReservaIimpCuentaInput {
  numeroSolicitud?: string | null;
  tipEvCod?: number | null;
  evenCod?: number | null;
  cuentaCorriente?: number | null;
}

export interface IReservaIimpClient {
  /** Cuerpo JSON (PascalCase) que se enviaria en `POST /stands/reserva`; funcion pura, no llama al IIMP. */
  armarCuerpo(input: ReservaIimpInput): Record<string, unknown>;
  /** Registra la reserva (contrato + cuenta corriente). El IIMP factura cada cuota en su fecha. */
  reservar(input: ReservaIimpInput): Promise<ReservaIimpResponse>;
  /** Agrega archivos (hasta 20; todo o nada) y devuelve la lista completa de la cuenta. */
  agregarArchivos(input: ReservaIimpCuentaInput & { archivos: ReservaIimpArchivoInput[] }): Promise<ReservaIimpArchivo[]>;
  /** Lista los archivos registrados en la cuenta corriente. */
  listarArchivos(input: ReservaIimpCuentaInput): Promise<ReservaIimpArchivo[]>;
  /** Quita un archivo por su `item` y devuelve la lista completa de la cuenta. */
  eliminarArchivo(input: ReservaIimpCuentaInput & { item: number }): Promise<ReservaIimpArchivo[]>;
}
