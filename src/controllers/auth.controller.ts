import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, SESION } from "@/lib/shared/constants";
import { setTokenCookie, clearTokenCookie, getTokenFromHeaders } from "@/lib/server/utils/cookie";
import { registroSchema, registroConfirmarSchema } from "@/validators/auth.validator";
import type { ApiErrorCode } from "@/lib/shared/constants";
import type { RegistroRequestDTO } from "@/types/dto/auth/registro-request.dto";
import type { RegistroResult } from "@/types/dto/auth/registro-result.dto";
import type { RegistroConfirmarRequestDTO } from "@/types/dto/auth/registro-confirmar-request.dto";
import type { RegistroConfirmarResult } from "@/types/dto/auth/registro-confirmar-result.dto";

/** Mapeo del status de negocio del servicio al codigo de error de la API. */
const CODIGO_ERROR_POR_STATUS: Record<number, ApiErrorCode> = {
  400: API_ERROR_CODES.VALIDATION,
  401: API_ERROR_CODES.UNAUTHORIZED,
  403: API_ERROR_CODES.FORBIDDEN,
  409: API_ERROR_CODES.CONFLICT,
  502: API_ERROR_CODES.BAD_GATEWAY,
};
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
      const code: ApiErrorCode = CODIGO_ERROR_POR_STATUS[result.status] ?? API_ERROR_CODES.UNAUTHORIZED;
      return error(code, result.error, result.status);
    }
    const body: LoginResponseDTO = { token: result.token, roles: result.roles, email: result.email };
    const res = NextResponse.json(body);
    setTokenCookie(res, result.token, result.remember ? SESION.MAX_AGE_RECORDADA : SESION.MAX_AGE_ESTANDAR);
    return res;
  },

  /** @request RegistroRequestDTO */
  async registro(request: Request): Promise<NextResponse> {
    const parsed = registroSchema.safeParse(await request.json());
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join("; ");
      return error(API_ERROR_CODES.VALIDATION, message, 400);
    }

    const dto: RegistroRequestDTO = parsed.data;
    const result: RegistroResult = await services.auth.registrar(dto);
    if ("error" in result) {
      const code: ApiErrorCode = CODIGO_ERROR_POR_STATUS[result.status] ?? API_ERROR_CODES.VALIDATION;
      return error(code, result.error, result.status);
    }
    return success(result);
  },

  /** @request RegistroConfirmarRequestDTO */
  async confirmarRegistro(request: Request): Promise<NextResponse> {
    const parsed = registroConfirmarSchema.safeParse(await request.json());
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join("; ");
      return error(API_ERROR_CODES.VALIDATION, message, 400);
    }

    const dto: RegistroConfirmarRequestDTO = parsed.data;
    const result: RegistroConfirmarResult = await services.auth.confirmarRegistro(dto);
    if ("error" in result) {
      const code: ApiErrorCode = CODIGO_ERROR_POR_STATUS[result.status] ?? API_ERROR_CODES.VALIDATION;
      return error(code, result.error, result.status);
    }
    const body: LoginResponseDTO = { token: result.token, roles: result.roles, email: result.email };
    const res = NextResponse.json(body);
    setTokenCookie(res, result.token, result.remember ? SESION.MAX_AGE_RECORDADA : SESION.MAX_AGE_ESTANDAR);
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
      setTokenCookie(res, result.token, result.maxAge);
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
