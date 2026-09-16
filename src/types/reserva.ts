import type {
  Vertical,
  EstadoStand,
  EstadoReserva,
  TipoComprobante,
  AreaAprobacion,
  ResultadoAprobacion,
  EstadoEvento,
} from "@/lib/shared/constants";

export type { Vertical, EstadoStand, EstadoReserva, TipoComprobante, AreaAprobacion, EstadoEvento };

export type { ResultadoAprobacion };

/* ---------- Eventos ---------- */
export interface EventoPadre {
  id: string;
  codigo: string;
  vertical: Vertical;
  nombre: string;
}

export interface Evento {
  id: string;
  eventoPadreId: string;
  tipoEvento: number;
  codigoEvento: number;
  anio: string;
  estado: EstadoEvento;
}

/* ---------- Tipos de Stand ---------- */
export interface TipoStand {
  id: string;
  nombre: string;
  medidas: string;
  montoBase: number;
  moneda: string;
}

/* ---------- GessStand (datos del API planogess) ---------- */
export interface GessStand {
  id: string;
  eventoId: string;
  standApiId: string;
  standCode: string;
  tipoStand: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  pabellon: string | null;
  ubicacion: string | null;
  rawData: unknown;
  bloqueId: string | null;
  documentos: string[];
  imagenes: string[];
  createdAt: string;
  updatedAt: string;
}

/* ---------- Plano ---------- */
export interface PlanoStand {
  id: string;
  numero: string;
  tipoStand: string;
  tipoStandId: string;
  monto: number;
  moneda: string;
  medidas: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  estado: EstadoStand;
  empresa: string | null;
  tipoCamara: string | null;
  numeroCamara: string | null;
  color?: string;
}

export interface Cuota {
  numero: number;
  porcentaje: number;
  monto: number;
  fechaPago: string | null;
}

export interface DatosFacturacion {
  tipoComprobante: TipoComprobante;
  razonSocial: string;
  ruc: string;
  nombre: string;
  numeroDocumento: string;
  direccion: string;
  correo: string;
}

export interface Aprobacion {
  area: AreaAprobacion;
  estado: ResultadoAprobacion;
  responsable: string | null;
  comentario: string | null;
  fecha: string | null;
}

export interface Reserva {
  id: string;
  eventoId: string;
  empresaRef: string;
  empresaNombre: string;
  standIds: string[];
  stands: Pick<PlanoStand, "id" | "numero" | "tipoStand" | "monto" | "moneda">[];
  montoTotal: number;
  moneda: string;
  facturacion: DatosFacturacion;
  cuotas: Cuota[];
  aprobaciones: Aprobacion[];
  estado: EstadoReserva;
  creadoEn: string;
}
