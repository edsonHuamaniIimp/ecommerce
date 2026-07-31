import type { IEventoRepository } from "@/domain/ports/evento-repository";
import type { EventoEntity } from "@/domain/models/entities";

export class EventoApplicationService {
  constructor(private readonly repo: IEventoRepository) {}

  async listarPresala() {
    const now = new Date();
    return this.repo.findPadresConVersiones({ estado: "active", flgActivo: true, flgVisible: true, fechaVigente: now });
  }

  async listarTodas(activos?: boolean) {
    return this.repo.findAll(activos);
  }

  async obtenerPorId(id: string) {
    return this.repo.findById(id);
  }

  async crear(data: { eventoPadreId: string; anio: string; fechaInicio?: string; fechaFin?: string }) {
    return this.repo.create({
      eventoPadreId: data.eventoPadreId,
      anio: data.anio,
      fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : undefined,
      fechaFin: data.fechaFin ? new Date(data.fechaFin) : undefined,
    });
  }

  async actualizar(data: {
    id?: string;
    tipo_evento?: number;
    codigo_evento?: number;
    estado?: string;
    anio?: string;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    flg_activo?: boolean;
    flg_visible?: boolean;
    plano?: string;
    imagen?: string;
  }) {
    const mapped: Partial<Pick<EventoEntity, "estado" | "anio" | "fechaInicio" | "fechaFin" | "flgActivo" | "flgVisible" | "plano" | "imagen">> = {};
    if (data.estado !== undefined) mapped.estado = data.estado;
    if (data.anio !== undefined) mapped.anio = data.anio;
    if (data.fecha_inicio !== undefined) mapped.fechaInicio = data.fecha_inicio ? new Date(data.fecha_inicio) : null as unknown as undefined;
    if (data.fecha_fin !== undefined) mapped.fechaFin = data.fecha_fin ? new Date(data.fecha_fin) : null as unknown as undefined;
    if (data.flg_activo !== undefined) mapped.flgActivo = data.flg_activo;
    if (data.flg_visible !== undefined) mapped.flgVisible = data.flg_visible;
    if (data.plano !== undefined) mapped.plano = data.plano;
    if (data.imagen !== undefined) mapped.imagen = data.imagen;

    const tipoEvento = data.tipo_evento;
    const codigoEvento = data.codigo_evento;

    if (tipoEvento !== undefined && codigoEvento !== undefined) {
      return this.repo.upsertByTipoCodigo(tipoEvento, codigoEvento, mapped);
    }
    if (data.id) return this.repo.update(data.id, mapped);
    throw new Error("Se requiere id o (tipoEvento + codigoEvento)");
  }
}
