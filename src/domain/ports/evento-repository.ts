import type { EventoEntity, EventoPadreEntity } from "../models/entities";

export interface EventoMetadata {
  tipoEvento: number;
  codigoEvento: number;
  imagen: string | null;
  plano: string | null;
  anio: string;
  estado: string;
  flgVisible: boolean;
}

export interface EventoCriteria {
  estado?: string;
  flgActivo?: boolean;
  flgVisible?: boolean;
  fechaVigente?: Date;
}

export interface IEventoRepository {
  findPadresConVersiones(criteria?: EventoCriteria): Promise<(EventoPadreEntity & { versiones: EventoEntity[] })[]>;
  findAll(activos?: boolean): Promise<EventoEntity[]>;
  findById(id: string): Promise<EventoEntity | null>;
  findAllMetadata(): Promise<EventoMetadata[]>;
  create(data: {
    eventoPadreId: string;
    anio: string;
    tipoEvento?: number;
    codigoEvento?: number;
    fechaInicio?: Date;
    fechaFin?: Date;
  }): Promise<EventoEntity>;
  update(id: string, data: Partial<Pick<EventoEntity, "estado" | "anio" | "fechaInicio" | "fechaFin" | "imagen" | "flgActivo" | "flgVisible" | "plano">>): Promise<EventoEntity>;
  upsertByTipoCodigo(tipoEvento: number, codigoEvento: number, data: Partial<Pick<EventoEntity, "estado" | "anio" | "fechaInicio" | "fechaFin" | "imagen" | "flgActivo" | "flgVisible" | "plano">>): Promise<EventoEntity>;
}
