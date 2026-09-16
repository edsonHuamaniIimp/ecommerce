import 'client-only';

import { api } from "../client";
import { mapEventoPadre, mapEvento, mapPlanoStand, mapReserva, mapReservaInput } from "@/lib/shared/mappers/reserva";
import type { EventosService, PlanoService, ReservasService, ReservaCreateInput } from "./types";
import type { EventoPadre, Evento, PlanoStand, Reserva } from "@/types/reserva";
import type { EventoPadreDTO, EventoDTO, PlanoStandDTO, ReservaDTO, ReservaCreateDTO } from "@/types/dto/models";

export function createEventosHttpService(): EventosService {
  return {
    async listEventosPadre(): Promise<EventoPadre[]> {
      const dtos = await api.get<EventoPadreDTO[]>("/eventos-padre");
      return dtos.map(mapEventoPadre);
    },
    async listEventos(eventoPadreId: string): Promise<Evento[]> {
      const dtos = await api.get<EventoDTO[]>("/eventos", { eventoPadreId });
      return dtos.map(mapEvento);
    },
    async getEventoActual(): Promise<{ evento: Evento; eventoPadre: EventoPadre }> {
      const [padres, eventos] = await Promise.all([
        api.get<EventoPadreDTO[]>("/eventos-padre"),
        api.get<EventoDTO[]>("/eventos", { eventoPadreId: "1" }),
      ]);
      const activo = eventos.find((e) => e.estado === "active") ?? eventos[0];
      const padre = padres.find((p) => p.id === activo?.evento_padre_id);
      if (!activo || !padre) throw new Error("No hay evento activo");
      return { evento: mapEvento(activo), eventoPadre: mapEventoPadre(padre) };
    },
  };
}

export function createPlanoHttpService(): PlanoService {
  return {
    async getPlano(eventoId: string): Promise<PlanoStand[]> {
      const dtos = await api.get<PlanoStandDTO[]>(`/eventos/${eventoId}/plano`);
      return dtos.map(mapPlanoStand);
    },
  };
}

export function createReservasHttpService(): ReservasService {
  return {
    async list(eventoId?: string): Promise<Reserva[]> {
      const dtos = await api.get<ReservaDTO[]>("/reservas", { eventoId });
      return dtos.map(mapReserva);
    },
    async getById(id: string): Promise<Reserva> {
      const dto = await api.get<ReservaDTO>(`/reservas/${id}`);
      return mapReserva(dto);
    },
    async create(input: ReservaCreateInput): Promise<Reserva> {
      const body = mapReservaInput(input) as ReservaCreateDTO;
      const dto = await api.post<ReservaDTO>("/reservas", body);
      return mapReserva(dto);
    },
  };
}
