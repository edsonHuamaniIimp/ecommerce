import type { ApiResponse } from "@/lib/server/api-response";
import type { EventoPadrePresalaDTO } from "./presala.dto";
import type { EventoEntity } from "@/domain/models/entities";

/** GET /api/eventos */
export type EventosListResponse = ApiResponse<EventoEntity[]>;

/** GET /api/eventos?presala=1 */
export type EventosPresalaResponse = ApiResponse<EventoPadrePresalaDTO[]>;

/** GET /api/eventos?id=X */
export type EventoDetalleResponse = ApiResponse<EventoEntity | null>;

/** POST /api/eventos */
export type EventoCreateResponse = ApiResponse<EventoEntity>;

/** PATCH /api/eventos */
export type EventoUpdateResponse = ApiResponse<EventoEntity>;
