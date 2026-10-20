/** Eventos de disponibilidad de stands para actualizar los planos en tiempo real. */
export interface StandEventPublisher {
  standReservado(data: {
    eventoId: string;
    standIds: string[];
    standCodes: string[];
  }): Promise<void>;
  standHold(data: {
    eventoId: string;
    holdId: string;
    standIds: string[];
    standCodes: string[];
    expiresAt: string;
  }): Promise<void>;
  standReleased(data: {
    eventoId: string;
    holdId: string;
    standIds: string[];
    standCodes: string[];
  }): Promise<void>;
  /** Cambio de pre-reserva: los clientes deben recargar su vista efectiva. */
  standPreReservaChanged?(data: {
    eventoId: string;
    standIds: string[];
    standCodes: string[];
  }): Promise<void>;
}
