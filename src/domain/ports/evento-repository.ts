import type { EventoEntity, EventoPadreEntity, ModalInfoConfig } from "../models/entities";

export interface EventoMetadata {
  tipoEvento: number;
  codigoEvento: number;
  imagen: string | null;
  plano: string | null;
  anio: string;
  estado: string;
  flgVisible: boolean;
  modalInfo: ModalInfoConfig | null;
}

/** Campos de evento_metadata que se pueden actualizar por (tipoEvento, codigoEvento). */
export interface EventoMetadataUpdate {
  imagen?: string | null;
  flgVisible?: boolean;
  plano?: string | null;
  modalInfo?: ModalInfoConfig | null;
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
  upsertByTipoCodigo(tipoEvento: number, codigoEvento: number, data: EventoMetadataUpdate): Promise<EventoEntity>;

  /** Config del modal informativo de /mapa para una version de evento. */
  findModalInfo(tipoEvento: number, codigoEvento: number): Promise<ModalInfoConfig | null>;

  /** Un mapa 3D solo puede estar asignado a un evento a la vez */
  findEventoPorPlano(planoCodigo: string, exceptTipoEvento?: number, exceptCodigoEvento?: number): Promise<{ tipoEvento: number; codigoEvento: number } | null>;
}
