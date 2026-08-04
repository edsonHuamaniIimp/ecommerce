import type { IAuthRepository } from "@/domain/ports/auth-repository";
import { signToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import type { Rol } from "@/lib/constants";
import type { LoginRequestDTO } from "@/types/dto/auth/login-request.dto";
import type { LoginResult } from "@/types/dto/auth/login-result.dto";
import type { SessionResult } from "@/types/dto/auth/session-result.dto";
import type { SeleccionarEventoRequestDTO } from "@/types/dto/auth/seleccionar-evento-request.dto";
import type { SeleccionarEventoResult } from "@/types/dto/auth/seleccionar-evento-result.dto";
import type { PerfilUpdateRequestDTO } from "@/types/dto/auth/perfil-update-request.dto";
import type { PerfilResult } from "@/types/dto/auth/perfil-result.dto";
import type { ResetPasswordRequestDTO } from "@/types/dto/auth/reset-password-request.dto";
import type { RequestResetResult } from "@/types/dto/auth/request-reset-result.dto";
import type { ConfirmResetRequestDTO } from "@/types/dto/auth/confirm-reset-request.dto";
import type { ConfirmResetResult } from "@/types/dto/auth/confirm-reset-result.dto";

export class AuthApplicationService {
  constructor(private readonly repo: IAuthRepository) {}

  async login(dto: LoginRequestDTO): Promise<LoginResult> {
    const userRoles = await this.repo.findByEmail(dto.email);
    if (userRoles.length === 0) return { error: "Usuario sin roles asignados", status: 403 } as const;
    if (userRoles[0].password !== dto.password) return { error: "Contrasena incorrecta", status: 401 } as const;

    const roles = userRoles.map((ur) => ur.role.nombre as Rol);
    const token = await signToken({ sub: `user|${dto.email}`, email: dto.email, name: dto.email.split("@")[0] ?? dto.email, roles });
    return { token, roles, email: dto.email };
  }

  async getSession(): Promise<SessionResult> {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return { authenticated: false } as const;

    let eventoNombre: string | null = session.eventoNombre ?? null;
    if (!eventoNombre && session.eventoId) {
      const ev = await this.repo.findEventoById(session.eventoId);
      if (ev) eventoNombre = `${ev.eventoPadre.nombre} ${ev.anio}`;
    }

    return {
      authenticated: true, email: session.email, roles: session.roles,
      permissions: session.permissions, eventoId: session.eventoId ?? null,
      eventoPadreId: session.eventoPadreId ?? null, eventoNombre,
      eventoPadreNombre: session.eventoPadreNombre ?? null,
      tipoEvento: session.tipoEvento, codigoEvento: session.codigoEvento,
    };
  }

  async seleccionarEvento(dto: SeleccionarEventoRequestDTO, tokenCookie: string): Promise<SeleccionarEventoResult> {
    const { jwtVerify } = await import("jose");
    const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret");
    const { payload } = await jwtVerify(tokenCookie, SECRET);

    let eventoId = dto.eventoId;
    let tipoEvento = dto.tipoEvento ?? payload.tipoEvento as number | undefined;
    let codigoEvento = dto.codigoEvento ?? payload.codigoEvento as number | undefined;

    if (tipoEvento && codigoEvento) {
      const ev = await this.repo.findOrCreateEvento(tipoEvento, codigoEvento);
      eventoId = ev.id;
    }

    if (!eventoId) throw new Error("NOT_FOUND:Evento no encontrado");

    const newToken = await signToken({
      sub: payload.sub as string, email: payload.email as string,
      name: payload.name as string, roles: payload.roles as Rol[],
      eventoId, tipoEvento, codigoEvento,
      eventoNombre: dto.eventoNombre,
      eventoPadreNombre: dto.eventoPadreNombre ?? payload.eventoPadreNombre as string | undefined,
    });

    return { token: newToken, eventoId, tipoEvento, codigoEvento };
  }

  async getPerfil(): Promise<PerfilResult | null> {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return null;
    const u = await this.repo.findPerfilByEmail(session.email);
    return u ?? { email: session.email, nombre: null, apellidos: null, telefono: null, tipoUsuarioId: null };
  }

  async updatePerfil(dto: PerfilUpdateRequestDTO): Promise<boolean> {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return false;
    await this.repo.updatePerfil(session.email, dto);
    return true;
  }

  async requestReset(dto: ResetPasswordRequestDTO): Promise<RequestResetResult> {
    const user = await this.repo.findForReset(dto.email);
    if (!user) return { ok: true, message: "Si el email existe, recibiras un enlace" };

    const token = [...Array(32)].map(() => Math.random().toString(36)[2]).join("");
    await this.repo.setResetToken(user.id, token, new Date(Date.now() + 30 * 60 * 1000));

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/perfil?reset=${token}`;
    await sendEmail({ to: user.email, subject: "Restablecer contrasena — IIMP", html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2 style="color:#059669">Restablecer contrasena</h2><p>Haz clic para crear una nueva. Expira en 30 min.</p><a href="${resetUrl}" style="background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Restablecer</a></div>` }).catch(() => {});
    return { ok: true, message: "Si el email existe, recibiras un enlace" };
  }

  async confirmReset(dto: ConfirmResetRequestDTO): Promise<ConfirmResetResult> {
    const user = await this.repo.findByResetToken(dto.token);
    if (!user) return { error: "Token invalido o expirado" } as const;
    await this.repo.updatePassword(user.id, dto.password);
    return { ok: true, message: "Contrasena actualizada" };
  }
}
