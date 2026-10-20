import "server-only";

import type { StandEventPublisher } from "@/domain/ports/stand-events";
import { canalStandEventos, getPusher } from "@/lib/server/pusher";

export class PusherStandEventPublisher implements StandEventPublisher {
  async standReservado(data: { eventoId: string; standIds: string[]; standCodes: string[] }): Promise<void> {
    const pusher = getPusher();
    if (!pusher) return;
    await pusher.trigger(canalStandEventos(data.eventoId), "stand-reserved", {
      standIds: data.standIds,
      standCodes: data.standCodes,
    });
  }

  async standHold(data: { eventoId: string; holdId: string; standIds: string[]; standCodes: string[]; expiresAt: string }): Promise<void> {
    const pusher = getPusher();
    if (!pusher) return;
    await pusher.trigger(canalStandEventos(data.eventoId), "stand-held", {
      holdId: data.holdId,
      standIds: data.standIds,
      standCodes: data.standCodes,
      expiresAt: data.expiresAt,
    });
  }

  async standReleased(data: { eventoId: string; holdId: string; standIds: string[]; standCodes: string[] }): Promise<void> {
    const pusher = getPusher();
    if (!pusher) return;
    await pusher.trigger(canalStandEventos(data.eventoId), "stand-released", {
      holdId: data.holdId,
      standIds: data.standIds,
      standCodes: data.standCodes,
    });
  }

  async standPreReservaChanged(data: { eventoId: string; standIds: string[]; standCodes: string[] }): Promise<void> {
    const pusher = getPusher();
    if (!pusher) return;
    await pusher.trigger(canalStandEventos(data.eventoId), "stand-pre-reserva-changed", {
      standIds: data.standIds,
      standCodes: data.standCodes,
    });
  }
}
