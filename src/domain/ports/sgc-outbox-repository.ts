import type { SgcOutboxEntity } from "@/domain/models/sgc";

export interface EncolarSgcOutboxData {
  operacion: string;
  idempotencyKey?: string | null;
  payload: Record<string, unknown>;
}

export interface ISgcOutboxRepository {
  encolar(data: EncolarSgcOutboxData): Promise<SgcOutboxEntity>;
  listarPendientes(limite: number, ahora: Date): Promise<SgcOutboxEntity[]>;
  marcarEnviado(id: string): Promise<void>;
  marcarError(id: string, error: string, programadoAt: Date, intentos: number): Promise<void>;
}
