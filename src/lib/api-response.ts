export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    detail?: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function err(code: string, message: string, detail?: string): ApiErrorResponse {
  return { success: false, error: { code, message, detail } };
}

export function apiError(code: string, message: string, status: number, detail?: string) {
  return Response.json(err(code, message, detail), { status });
}
