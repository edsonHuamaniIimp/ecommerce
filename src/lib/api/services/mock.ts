import type { EventosService, PlanoService, ReservasService, ReservaCreateInput } from "./types";
import type { EventoPadre, Evento, PlanoStand, Reserva } from "@/types/reserva";
import { mapEventoPadre, mapEvento, mapPlanoStand, mapReserva } from "@/lib/mappers/reserva";
import { eventoPadreDTO, eventoDTO, planoDTO, reservasDTO } from "./mock-data";

/* eslint-disable @typescript-eslint/no-unused-vars */

export const eventosServiceMock: EventosService = {
  async listEventosPadre(): Promise<EventoPadre[]> {
    return [mapEventoPadre(eventoPadreDTO)];
  },
  async listEventos(_eventoPadreId: string): Promise<Evento[]> {
    return [mapEvento(eventoDTO)];
  },
  async getEventoActual(): Promise<{ evento: Evento; eventoPadre: EventoPadre }> {
    return {
      evento: mapEvento(eventoDTO),
      eventoPadre: mapEventoPadre(eventoPadreDTO),
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
        { area: "eventos", estado: "pendiente", responsable: null, comentario: null, fecha: null },
      ],
      estado: "registrada",
      creadoEn: new Date().toISOString(),
    };
    return reserva;
  },
};
