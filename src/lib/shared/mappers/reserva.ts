import type {
  EventoPadreDTO,
  EventoDTO,
  PlanoStandDTO,
  ReservaDTO,
  DatosFacturacionDTO,
  CuotaDTO,
  AprobacionDTO,
  ReservaCreateDTO,
} from "@/types/dto/models";
import type {
  EventoPadre,
  Evento,
  PlanoStand,
  Reserva,
  DatosFacturacion,
  Cuota,
  Aprobacion,
} from "@/types/reserva";
import type { ReservaCreateInput } from "@/lib/client/api/services/types";

export function mapEventoPadre(dto: EventoPadreDTO): EventoPadre {
  return dto;
}

export function mapEvento(dto: EventoDTO): Evento {
  return {
    id: dto.id,
    eventoPadreId: dto.evento_padre_id,
    tipoEvento: dto.tipo_evento,
    codigoEvento: dto.codigo_evento,
    anio: dto.anio,
    estado: dto.estado,
  };
}

export function mapPlanoStand(dto: PlanoStandDTO): PlanoStand {
  return {
    id: dto.id,
    numero: dto.numero,
    tipoStand: dto.tipo_stand,
    tipoStandId: dto.tipo_stand_id,
    monto: dto.monto,
    moneda: dto.moneda,
    medidas: dto.medidas,
    x: dto.x,
    y: dto.y,
    ancho: dto.ancho,
    alto: dto.alto,
    estado: dto.estado,
    empresa: dto.empresa,
    tipoCamara: dto.tipo_camara,
    numeroCamara: dto.numero_camara,
  };
}

function mapDatosFacturacion(dto: DatosFacturacionDTO): DatosFacturacion {
  return {
    tipoComprobante: dto.tipo_comprobante,
    razonSocial: dto.razon_social,
    ruc: dto.ruc,
    nombre: dto.nombre,
    numeroDocumento: dto.numero_documento,
    direccion: dto.direccion,
    correo: dto.correo,
  };
}

function mapCuota(dto: CuotaDTO): Cuota {
  return {
    numero: dto.numero,
    porcentaje: dto.porcentaje,
    monto: dto.monto,
    fechaPago: dto.fecha_pago,
  };
}

function mapAprobacion(dto: AprobacionDTO): Aprobacion {
  return {
    area: dto.area,
    estado: dto.estado,
    responsable: dto.responsable,
    comentario: dto.comentario,
    fecha: dto.fecha,
  };
}

export function mapReserva(dto: ReservaDTO): Reserva {
  return {
    id: dto.id,
    eventoId: dto.evento_id,
    empresaRef: dto.empresa_ref,
    empresaNombre: dto.empresa_nombre,
    standIds: dto.stand_ids,
    stands: dto.stands.map((s) => ({
      id: s.id,
      numero: s.numero,
      tipoStand: s.tipo_stand,
      monto: s.monto,
      moneda: s.moneda,
    })),
    montoTotal: dto.monto_total,
    moneda: dto.moneda,
    facturacion: mapDatosFacturacion(dto.facturacion),
    cuotas: dto.cuotas.map(mapCuota),
    aprobaciones: dto.aprobaciones.map(mapAprobacion),
    estado: dto.estado,
    creadoEn: dto.creado_en,
  };
}

export function mapReservaInput(input: ReservaCreateInput): ReservaCreateDTO {
  return {
    evento_id: input.eventoId,
    stand_ids: input.standIds,
    empresa_ref: input.empresaRef,
    empresa_nombre: input.empresaNombre,
    facturacion: {
      tipo_comprobante: input.facturacion.tipoComprobante,
      razon_social: input.facturacion.razonSocial,
      ruc: input.facturacion.ruc,
      nombre: input.facturacion.nombre,
      numero_documento: input.facturacion.numeroDocumento,
      direccion: input.facturacion.direccion,
      correo: input.facturacion.correo,
    },
    cuotas: input.cuotas.map((c: { numero: number; porcentaje: number; fechaPago: string | null }) => ({
      numero: c.numero,
      porcentaje: c.porcentaje,
      fecha_pago: c.fechaPago,
      monto: 0,
    })),
  };
}
