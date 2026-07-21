import type { EventosService, PlanoService, ReservasService, ReservaCreateInput } from "./types";
import type { EventoPadre, Evento, PlanoStand, Reserva } from "@/types/reserva";
import { mapEventoPadre, mapEvento, mapPlanoStand, mapReserva } from "@/lib/mappers/reserva";
import {
  eventoPadreDTO,
  eventoDTO,
  planoDTO,
  reservasDTO,
  todosEventosPadreDTO,
  todosEventosDTO,
} from "./mock-data";

/* eslint-disable @typescript-eslint/no-unused-vars */

function readStoredEventoId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("iimp-evento");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { eventoId?: string };
    return parsed.eventoId ?? null;
  } catch {
    return null;
  }
}

function findEventoById(id: string): { eventoDTO: typeof eventoDTO; padreDTO: typeof eventoPadreDTO } | null {
  const ev = todosEventosDTO.find((e) => e.id === id);
  if (!ev) return null;
  const padre = todosEventosPadreDTO.find((p) => p.id === ev.evento_padre_id);
  if (!padre) return null;
  return { eventoDTO: ev, padreDTO: padre };
}

export const eventosServiceMock: EventosService = {
  async listEventosPadre(): Promise<EventoPadre[]> {
    return todosEventosPadreDTO.map(mapEventoPadre);
  },
  async listEventos(eventoPadreId: string): Promise<Evento[]> {
    return todosEventosDTO
      .filter((e) => e.evento_padre_id === eventoPadreId)
      .map(mapEvento);
  },
  async getEventoActual(): Promise<{ evento: Evento; eventoPadre: EventoPadre }> {
    const storedId = readStoredEventoId();
    const match = storedId ? findEventoById(storedId) : null;
    const evDTO = match?.eventoDTO ?? eventoDTO;
    const padreDTO = match?.padreDTO ?? eventoPadreDTO;
    return {
      evento: mapEvento(evDTO),
      eventoPadre: mapEventoPadre(padreDTO),
    };
  },
};

export const planoServiceMock: PlanoService = {
  async getPlano(_eventoId: string): Promise<PlanoStand[]> {
    return planoDTO.map(mapPlanoStand);
  },
};

export const reservasServiceMock: ReservasService = {
  async list(_eventoId?: string): Promise<Reserva[]> {
    return reservasDTO.map(mapReserva);
  },

/* eslint-enable @typescript-eslint/no-unused-vars */
  async getById(id: string): Promise<Reserva> {
    const dto = reservasDTO.find((r) => r.id === id);
    if (!dto) throw new Error("Reserva no encontrada");
    return mapReserva(dto);
  },
  async create(input: ReservaCreateInput): Promise<Reserva> {
    const reserva: Reserva = {
      id: `res-${Date.now()}`,
      eventoId: input.eventoId,
      empresaRef: input.empresaRef,
      empresaNombre: input.empresaNombre,
      standIds: input.standIds,
      stands: input.standIds.map((sid) => {
        const s = planoDTO.find((p) => p.id === sid)!;
        return { id: s.id, numero: s.numero, tipoStand: s.tipo_stand, monto: s.monto, moneda: s.moneda };
      }),
      montoTotal: input.standIds.reduce((acc, sid) => acc + (planoDTO.find((p) => p.id === sid)?.monto ?? 0), 0),
      moneda: "USD",
      facturacion: input.facturacion,
      cuotas: input.cuotas.map((c, i, arr) => {
        const pctTotal = arr.reduce((s, cc) => s + cc.porcentaje, 0) || c.porcentaje;
        const total = input.standIds.reduce((acc, sid) => acc + (planoDTO.find((p) => p.id === sid)?.monto ?? 0), 0);
        return { ...c, monto: Math.round(total * c.porcentaje / pctTotal) };
      }),
      aprobaciones: [
        { area: "legal", estado: "pendiente", responsable: null, comentario: null, fecha: null },
        { area: "logistica", estado: "pendiente", responsable: null, comentario: null, fecha: null },
        { area: "comunicacion", estado: "pendiente", responsable: null, comentario: null, fecha: null },
      ],
      estado: "registrada",
      creadoEn: new Date().toISOString(),
    };
    return reserva;
  },
};
