import { NextResponse } from "next/server";
import { services } from "@/lib/services";
import { success, error } from "@/lib/api-response";
import { API_ERROR_CODES } from "@/lib/constants";
import { setTokenCookie, clearTokenCookie, getTokenFromHeaders } from "@/lib/utils/cookie";
import type { ApiErrorCode } from "@/lib/constants";
import type { LoginRequestDTO } from "@/types/dto/auth/login-request.dto";
import type { LoginResponseDTO } from "@/types/dto/auth/login-response.dto";
import type { LoginResult } from "@/types/dto/auth/login-result.dto";
import type { SessionResult } from "@/types/dto/auth/session-result.dto";
import type { SeleccionarEventoRequestDTO } from "@/types/dto/auth/seleccionar-evento-request.dto";
import type { SeleccionarEventoResult } from "@/types/dto/auth/seleccionar-evento-result.dto";
import type { PerfilUpdateRequestDTO } from "@/types/dto/auth/perfil-update-request.dto";
import type { ResetPasswordRequestDTO } from "@/types/dto/auth/reset-password-request.dto";
import type { RequestResetResult } from "@/types/dto/auth/request-reset-result.dto";
import type { ConfirmResetRequestDTO } from "@/types/dto/auth/confirm-reset-request.dto";
import type { ConfirmResetResult } from "@/types/dto/auth/confirm-reset-result.dto";

export const authController = {
  /** @request LoginRequestDTO */
  async login(request: Request): Promise<NextResponse> {
    const dto: LoginRequestDTO = await request.json();
    const result: LoginResult = await services.auth.login(dto);
    if ("error" in result) {
      const code: ApiErrorCode = result.status === 403 ? API_ERROR_CODES.FORBIDDEN : API_ERROR_CODES.UNAUTHORIZED;
      return error(code, result.error as string, result.status as number);
    }
    const body: LoginResponseDTO = { token: result.token, roles: result.roles, email: result.email };
    const res = NextResponse.json(body);
    setTokenCookie(res, result.token);
    return res;
  },

  logout(): NextResponse {
    const res = NextResponse.json({ ok: true });
    clearTokenCookie(res);
    return res;
  },

  async session(): Promise<NextResponse<SessionResult>> {
    const result: SessionResult = await services.auth.getSession();
    return NextResponse.json(result);
  },

  /** @request SeleccionarEventoRequestDTO */
  async seleccionarEvento(request: Request): Promise<NextResponse> {
    const dto: SeleccionarEventoRequestDTO = await request.json();
    const tokenCookie = getTokenFromHeaders(request);
    if (!tokenCookie) return error(API_ERROR_CODES.UNAUTHORIZED, "No autenticado", 401);
      const result: SeleccionarEventoResult = await services.auth.seleccionarEvento(dto, tokenCookie);
      const res = NextResponse.json({ ok: true, eventoId: result.eventoId, tipoEvento: result.tipoEvento, codigoEvento: result.codigoEvento });
      setTokenCookie(res, result.token);
      return res;
  },

  async getPerfil(): Promise<NextResponse> {
    const result = await services.auth.getPerfil();
    if (!result) return error(API_ERROR_CODES.UNAUTHORIZED, "No autenticado", 401);
    return success(result);
  },

  /** @request PerfilUpdateRequestDTO */
  async updatePerfil(request: Request): Promise<NextResponse> {
    const dto: PerfilUpdateRequestDTO = await request.json();
    const ok = await services.auth.updatePerfil(dto);
    if (!ok) return error(API_ERROR_CODES.UNAUTHORIZED, "No autenticado", 401);
    return success({ ok: true });
  },

  /** @request ResetPasswordRequestDTO */
  async requestReset(request: Request): Promise<NextResponse> {
    const dto: ResetPasswordRequestDTO = await request.json();
    const result: RequestResetResult = await services.auth.requestReset(dto);
    return success(result);
  },

  /** @request ConfirmResetRequestDTO */
  async confirmReset(request: Request): Promise<NextResponse> {
    const dto: ConfirmResetRequestDTO = await request.json();
    const result: ConfirmResetResult = await services.auth.confirmReset(dto);
    if ("error" in result) return error(API_ERROR_CODES.VALIDATION, result.error as string, 400);
    return success(result);
  },
};
