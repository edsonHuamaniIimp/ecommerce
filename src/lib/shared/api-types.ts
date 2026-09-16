import type { ApiErrorCode } from "./constants";

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    detail?: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;
