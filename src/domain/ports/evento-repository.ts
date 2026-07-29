import type { EventoEntity, EventoPadreEntity } from "../models/entities";

export interface EventoCriteria {
  estado?: string;
  flgActivo?: boolean;
  fechaVigente?: Date;
}

export interface IEventoRepository {
  findPadresConVersiones(criteria?: EventoCriteria): Promise<(EventoPadreEntity & { versiones: EventoEntity[] })[]>;
  findAll(): Promise<EventoEntity[]>;
  findById(id: string): Promise<EventoEntity | null>;
  create(data: {
    eventoPadreId: string;
    anio: string;
    tipoEvento?: number;
    codigoEvento?: number;
    fechaInicio?: Date;
    fechaFin?: Date;
  }): Promise<EventoEntity>;
  update(id: string, data: Partial<Pick<EventoEntity, "estado" | "anio" | "fechaInicio" | "fechaFin" | "imagen" | "flgActivo">>): Promise<EventoEntity>;
}
