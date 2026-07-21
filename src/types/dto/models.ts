import type {
  Vertical,
  TipoComprobante,
  EstadoStand,
  EstadoReserva,
  AreaAprobacion,
  ResultadoAprobacion,
  EstadoEvento,
} from "@/lib/constants";

/* ---------- Eventos ---------- */
export interface EventoPadreDTO {
  id: string;
  codigo: string;
  vertical: Vertical;
  nombre: string;
}

export interface EventoDTO {
  id: string;
  evento_padre_id: string;
  tipo_evento: number;
  codigo_evento: number;
  anio: string;
  estado: EstadoEvento;
}

/* ---------- Plano ---------- */
export interface PlanoStandDTO {
  id: string;
  numero: string;
  tipo_stand: string;
  tipo_stand_id: string;
  monto: number;
  moneda: string;
  medidas: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  estado: EstadoStand;
  empresa: string | null;
  tipo_camara: string | null;
  numero_camara: string | null;
}

/* ---------- Reservas ---------- */
export interface CuotaDTO {
  numero: number;
  porcentaje: number;
  monto: number;
  fecha_pago: string | null;
}

export interface DatosFacturacionDTO {
  tipo_comprobante: TipoComprobante;
  razon_social: string;
  ruc: string;
  nombre: string;
  numero_documento: string;
  direccion: string;
  correo: string;
}

export interface AprobacionDTO {
  area: AreaAprobacion;
  estado: ResultadoAprobacion;
  responsable: string | null;
  comentario: string | null;
  fecha: string | null;
}

export interface StandResumenDTO {
  id: string;
  numero: string;
  tipo_stand: string;
  monto: number;
  moneda: string;
}

export interface ReservaDTO {
  id: string;
  evento_id: string;
  empresa_ref: string;
  empresa_nombre: string;
  stand_ids: string[];
  stands: StandResumenDTO[];
  monto_total: number;
  moneda: string;
  facturacion: DatosFacturacionDTO;
  cuotas: CuotaDTO[];
  aprobaciones: AprobacionDTO[];
  estado: EstadoReserva;
  creado_en: string;
}

export interface ReservaCreateDTO {
  evento_id: string;
  stand_ids: string[];
  empresa_ref: string;
  empresa_nombre: string;
  facturacion: DatosFacturacionDTO;
  cuotas: Omit<CuotaDTO, "monto">[];
}

export interface InteropCallbackDTO {
  reserva_id: string;
  estado: "confirmado" | "error";
  orden_venta: string | null;
  comprobante: string | null;
  stands_ocupados: string[];
}

/* ---------- GESS Stand (API planogess proxy) ---------- */
export interface GessStandDTO {
  id: string;
  evento_id: string;
  stand_api_id: string;
  stand_code: string;
  tipo_stand: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  pabellon: string | null;
  ubicacion: string | null;
  raw_data: unknown;
  bloque_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GessSyncResultDTO {
  creados: number;
  actualizados: number;
  total: number;
}
