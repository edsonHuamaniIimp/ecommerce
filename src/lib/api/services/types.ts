import type { EventoPadre, Evento, PlanoStand, Reserva, DatosFacturacion, Cuota } from "@/types/reserva";

export type ReservaCreateInput = {
  eventoId: string;
  standIds: string[];
  empresaRef: string;
  empresaNombre: string;
  facturacion: DatosFacturacion;
  cuotas: Omit<Cuota, "monto">[];
};

export interface EventosService {
  listEventosPadre(): Promise<EventoPadre[]>;
  listEventos(eventoPadreId: string): Promise<Evento[]>;
  getEventoActual(): Promise<{ evento: Evento; eventoPadre: EventoPadre }>;
}

export interface PlanoService {
  getPlano(eventoId: string): Promise<PlanoStand[]>;
}

export interface ReservasService {
  list(eventoId?: string): Promise<Reserva[]>;
  getById(id: string): Promise<Reserva>;
  create(input: ReservaCreateInput): Promise<Reserva>;
}
