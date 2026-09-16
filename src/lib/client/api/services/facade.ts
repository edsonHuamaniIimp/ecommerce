import 'client-only';

/**
 * Fachada de servicios API.
 *
 * Centraliza TODAS las llamadas HTTP del sistema. Ningún componente
 * debe hacer `fetch`/`axios` directo; siempre se consume desde aquí.
 *
 * Modo de mock controlado por variable de entorno:
 *   NEXT_PUBLIC_API_MOCK=1  → servicios de mock (no dependen de backend)
 *   (default)               → servicios HTTP reales hacia NEXT_PUBLIC_API_URL
 */

import { eventosServiceMock, planoServiceMock, reservasServiceMock } from "./mock";
import { createEventosHttpService, createPlanoHttpService, createReservasHttpService } from "./http";
import type { EventosService, PlanoService, ReservasService } from "./types";

const USE_MOCK = process.env.NEXT_PUBLIC_API_MOCK === "1" || typeof window === "undefined";

let _eventos: EventosService | undefined;
let _plano: PlanoService | undefined;
let _reservas: ReservasService | undefined;

function getEventosService(): EventosService {
  if (!_eventos) _eventos = USE_MOCK ? eventosServiceMock : createEventosHttpService();
  return _eventos;
}

function getPlanoService(): PlanoService {
  if (!_plano) _plano = USE_MOCK ? planoServiceMock : createPlanoHttpService();
  return _plano;
}

function getReservasService(): ReservasService {
  if (!_reservas) _reservas = USE_MOCK ? reservasServiceMock : createReservasHttpService();
  return _reservas;
}

export const eventosService = new Proxy<EventosService>({} as EventosService, {
  get(_t, prop: keyof EventosService) {
    return getEventosService()[prop];
  },
});

export const planoService = new Proxy<PlanoService>({} as PlanoService, {
  get(_t, prop: keyof PlanoService) {
    return getPlanoService()[prop];
  },
});

export const reservasService = new Proxy<ReservasService>({} as ReservasService, {
  get(_t, prop: keyof ReservasService) {
    return getReservasService()[prop];
  },
});
