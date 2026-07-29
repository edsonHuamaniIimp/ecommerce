import type { IEventoRepository } from "@/domain/ports/evento-repository";
import type { EventoEntity } from "@/domain/models/entities";

export class EventoApplicationService {
  constructor(private readonly repo: IEventoRepository) {}

  async listarPresala() {
    const now = new Date();
    return this.repo.findPadresConVersiones({ estado: "active", flgActivo: true, flgVisible: true, fechaVigente: now });
  }

  async listarTodas() {
    return this.repo.findAll();
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

  async actualizar(id: string, data: Partial<Pick<EventoEntity, "estado" | "anio" | "fechaInicio" | "fechaFin" | "flgActivo" | "flgVisible">>) {
    return this.repo.update(id, data);
  }
}
