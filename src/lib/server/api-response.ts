import 'server-only';

import { NextResponse } from "next/server";
import { API_ERROR_CODES } from "../shared/constants";
import type { ApiErrorCode } from "../shared/constants";

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

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function err(code: ApiErrorCode, message: string, detail?: string): ApiErrorResponse {
  return { success: false, error: { code, message, detail } };
}

/** Retorna un ApiResponse envuelto en NextResponse. */
export function success<T>(data: T, init?: ResponseInit): NextResponse<ApiResponse<T>> {
  return NextResponse.json(ok(data), init);
}

/** Retorna un ApiErrorResponse envuelto en NextResponse con el status adecuado. */
export function error(code: ApiErrorCode, message: string, status: number, detail?: string): NextResponse<ApiErrorResponse> {
  return NextResponse.json(err(code, message, detail), { status });
}
