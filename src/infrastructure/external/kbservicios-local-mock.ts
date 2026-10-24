import type { ApiEvent, ApiEventType } from "@/domain/ports/kbservicios-client";

/**
 * Snapshot de la API de eventos de produccion tomado el 2026-10-24.
 * Solo se usa cuando NEXT_PUBLIC_APP_ENV=local. No se carga en QA ni produccion.
 */
export const LOCAL_MOCK_EVENT_TYPES: ApiEventType[] = [
  { code: 1, event: "PROEXPLO" },
  { code: 2, event: "PERUMIN" },
  { code: 9, event: "EVENTOS" },
  { code: 13, event: "WORLD MINING CONGRESS" },
  { code: 14, event: "GESS" },
];

/** Versiones de evento que tienen metadata/evento local. */
export const LOCAL_MOCK_EVENTS: Record<number, ApiEvent[]> = {
  1: [
    {
      codeEvent: 28,
      event: "PROEXPLO 2026",
      inicio: "2026-05-04",
      fin: "2026-05-31",
      active: true,
    },
  ],
  2: [
    {
      codeEvent: 19,
      event: "PERUMIN 38 - CONVENCIÓN MINERA",
      inicio: "2027-09-20",
      fin: "2027-09-24",
      active: true,
    },
  ],
  9: [
    {
      codeEvent: 29,
      event: "cena de camaradería proEXPLO 2019",
      inicio: "2019-05-21",
      fin: "2019-05-21",
      active: true,
    },
  ],
  13: [
    {
      codeEvent: 1,
      event: "WORLD MINING CONGRESS 2026",
      inicio: "2026-06-24",
      fin: "2026-06-26",
      active: true,
    },
  ],
  14: [
    {
      codeEvent: 1,
      event: "I ENCUENTRO INTERNACIONAL DE GESTIÓN SOCIAL Y SOSTENIBILIDAD 2026",
      inicio: "2026-08-18",
      fin: "2026-08-20",
      active: true,
    },
  ],
};
