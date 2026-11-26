/**
 * Response de `GET /api/integracion/solicitud` (M2M, solo lectura): los datos VIGENTES de la
 * solicitud tal como los enviaria hoy la plataforma al SIE. Permite que el SIE consulte y
 * actualice su registro sin que la plataforma regenere ni reenvie nada.
 */
export interface SolicitudVigenteFacturacionDTO {
  /** `01` factura | `03` boleta. */
  tipoComprobante: string;
  /** `6` RUC | `0` empresa extranjera | `1` DNI | `4` CE | `7` pasaporte. */
  tipoDocumento: string;
  numeroDocumento: string;
  /** Razon social de la empresa facturada (null en boleta a persona natural). */
  razonSocial: string | null;
  /** Solo boleta a persona natural. */
  nombres: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  /** Empresa extranjera: codigo numerico del catalogo de ubigeo del SIE (Alemania = 5). */
  paisCodigo: number | null;
  direccion: string;
  telefono: string | null;
  web: string | null;
  friso: string | null;
  correoFacturacion: string;
  correoContrato: string;
  correoPagos: string;
}

export interface SolicitudVigenteStandDTO {
  codigo: string;
  standCode: string;
  /** Precio de lista (USD). */
  precioLista: number;
  descuentoPorcentaje: number | null;
  descuentoMonto: number | null;
  /** Neto del stand despues del descuento (antes de IGV); null si no hay descuento por stand. */
  neto: number | null;
}

export interface SolicitudVigenteCuotaDTO {
  numero: number;
  porcentaje: number;
  /** AAAA-MM-DD. */
  vencimiento: string;
  /** Monto de la cuota con IGV, en la moneda de la solicitud. */
  monto: number;
}

export interface SolicitudVigenteResponseDTO {
  numeroSolicitud: string;
  /** Contrato del SIE si la reserva ya fue registrada. */
  contrato: string | null;
  cuentaCorriente: string | null;
  /** Huella estable de facturacion + montos + stands + cuotas: cambia solo si cambia algo. */
  version: string;
  facturacion: SolicitudVigenteFacturacionDTO;
  comercial: {
    moneda: string;
    tipoCambio: number | null;
    modalidad: string | null;
    netoLista: number | null;
    descuentoMonto: number | null;
    netoDescontado: number | null;
    igv: number | null;
    total: number | null;
  };
  stands: SolicitudVigenteStandDTO[];
  cuotas: SolicitudVigenteCuotaDTO[];
}
