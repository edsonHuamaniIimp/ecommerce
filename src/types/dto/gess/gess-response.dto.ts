import type { ApiResponse } from "@/lib/api-response";
import type { GessStandDTO } from "./gess-stand.dto";
import type { GessSyncResultDTO } from "./sync-result.dto";

/** GET /api/gess */
export type GessListResponse = ApiResponse<{ data: GessStandDTO[]; pagination: { page: number; per_page: number; total: number; total_pages: number } }>;

/** GET /api/gess?bloqueId=X */
export type GessFindByBloqueResponse = ApiResponse<GessStandDTO | null>;

/** PATCH /api/gess */
export type GessUpdateResponse = ApiResponse<GessStandDTO>;

/** POST /api/gess/sync */
export type GessSyncResponse = ApiResponse<GessSyncResultDTO>;
