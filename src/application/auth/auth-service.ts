import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IRoleRepository } from "@/domain/ports/role-repository";
import { signToken } from "@/lib/server/auth";
import { sendEmail } from "@/lib/server/email";
import { generarCodigoNumerico, generarTokenAleatorio } from "@/lib/server/utils/token";
import { esHash, hashPassword, verificarPassword } from "@/lib/server/utils/password";
import { buildRegistroCodigoEmail } from "@/lib/server/registro-email";
import { SESION, RESET_PASSWORD_MINUTOS_VIGENCIA, ROLES, REGISTRO_CODIGO, MS_POR_MINUTO } from "@/lib/shared/constants";
import type { Rol } from "@/lib/shared/constants";
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
import type { RegistroRequestDTO } from "@/types/dto/auth/registro-request.dto";
import type { RegistroResult } from "@/types/dto/auth/registro-result.dto";
import type { RegistroConfirmarRequestDTO } from "@/types/dto/auth/registro-confirmar-request.dto";
import type { RegistroConfirmarResult } from "@/types/dto/auth/registro-confirmar-result.dto";

const MENSAJE_CUENTA_EXISTENTE = "Este correo ya tiene una cuenta. Inicia sesion.";

export class AuthApplicationService {
  constructor(
    private readonly repo: IAuthRepository,
    private readonly roleRepo: IRoleRepository,
  ) {}

  /**
   * Inicia el registro de exhibidor: guarda los datos de forma temporal
   * (contrasena ya hasheada) y envia un codigo de verificacion al correo.
   */
  async registrar(dto: RegistroRequestDTO): Promise<RegistroResult> {
    const email = dto.email.trim().toLowerCase();

    if (await this.repo.existeEmail(email)) {
      return { error: MENSAJE_CUENTA_EXISTENTE, status: 409 } as const;
    }

    const codigo = generarCodigoNumerico(REGISTRO_CODIGO.LONGITUD);
    await this.repo.upsertRegistroPendiente({
      email,
      codigo,
      password: hashPassword(dto.password),
      nombre: dto.nombre.trim(),
      apellidos: dto.apellidos.trim(),
      razonSocial: dto.razonSocial.trim(),
      ruc: dto.ruc.trim(),
      telefono: dto.telefono?.trim() ?? null,
      expiraEn: new Date(Date.now() + REGISTRO_CODIGO.MINUTOS_VIGENCIA * MS_POR_MINUTO),
    });

    const enviado = await sendEmail({
      to: email,
      ...buildRegistroCodigoEmail({ codigo, nombre: dto.nombre.trim() }),
    });
    if (!enviado) {
      return { error: "No se pudo enviar el codigo al correo. Intenta nuevamente.", status: 502 } as const;
    }

    return { ok: true, message: `Enviamos un codigo de ${REGISTRO_CODIGO.LONGITUD} digitos a ${email}.` };
  }

  /**
   * Confirma el registro con el codigo recibido: crea la cuenta con rol cliente
   * y devuelve una sesion valida (auto-login) para continuar el flujo sin salir.
   */
  async confirmarRegistro(dto: RegistroConfirmarRequestDTO): Promise<RegistroConfirmarResult> {
    const email = dto.email.trim().toLowerCase();
    const pendiente = await this.repo.findRegistroPendiente(email);
    if (!pendiente) {
      return { error: "No hay un registro pendiente para este correo.", status: 400 } as const;
    }

    if (pendiente.expiraEn.getTime() < Date.now()) {
      await this.repo.eliminarRegistroPendiente(pendiente.id);
      return { error: "El codigo expiro. Solicita uno nuevo.", status: 400 } as const;
    }

    if (pendiente.codigo !== dto.codigo.trim()) {
      const intentos = pendiente.intentos + 1;
      if (intentos >= REGISTRO_CODIGO.MAX_INTENTOS) {
        await this.repo.eliminarRegistroPendiente(pendiente.id);
        return { error: "Demasiados intentos. Vuelve a iniciar el registro.", status: 400 } as const;
      }
      await this.repo.actualizarIntentosRegistro(pendiente.id, intentos);
      return { error: `Codigo incorrecto. Intentos restantes: ${REGISTRO_CODIGO.MAX_INTENTOS - intentos}.`, status: 400 } as const;
    }

    if (await this.repo.existeEmail(email)) {
      await this.repo.eliminarRegistroPendiente(pendiente.id);
      return { error: MENSAJE_CUENTA_EXISTENTE, status: 409 } as const;
    }

    const rol = await this.roleRepo.findByNombre(ROLES.CLIENTE);
    if (!rol) {
      return { error: `No existe el rol ${ROLES.CLIENTE} en el sistema`, status: 403 } as const;
    }

    await this.repo.crearUsuario({
      userId: `user|${email}`,
      email,
      password: pendiente.password,
      nombre: pendiente.nombre,
      apellidos: pendiente.apellidos,
      telefono: pendiente.telefono,
      nombreEmpresa: pendiente.razonSocial,
      roleId: rol.id,
    });
    await this.repo.eliminarRegistroPendiente(pendiente.id);

    const userRoles = await this.repo.findByEmail(email);
    const [principal] = userRoles;
    if (!principal) {
      return { error: "No se pudo iniciar la sesion", status: 400 } as const;
    }
    const roles = userRoles.map((ur) => ur.role.nombre as Rol);
    const token = await signToken(
      { sub: `user|${email}`, email, name: email.split("@")[0] ?? email, roles, permissions: principal.role.permisos },
      SESION.JWT_EXPIRACION_ESTANDAR,
    );
    return { token, roles, email, remember: false };
  }

  async login(dto: LoginRequestDTO): Promise<LoginResult> {
    const email = dto.email.trim().toLowerCase();
    const userRoles = await this.repo.findByEmail(email);
    const [principal] = userRoles;
    if (!principal) return { error: "Usuario sin roles asignados", status: 403 } as const;
    if (!verificarPassword(dto.password, principal.password)) {
      return { error: "Contrasena incorrecta", status: 401 } as const;
    }
    // Migracion transparente: si venia en texto plano, se guarda hasheada.
    if (!esHash(principal.password)) {
      await this.repo.updatePassword(principal.id, hashPassword(dto.password)).catch(() => {});
    }

    const roles = userRoles.map((ur) => ur.role.nombre as Rol);
    const permissions = principal.role.permisos;
    const expiracion = dto.remember ? SESION.JWT_EXPIRACION_RECORDADA : SESION.JWT_EXPIRACION_ESTANDAR;
    const token = await signToken({ sub: `user|${email}`, email, name: email.split("@")[0] ?? email, roles, permissions }, expiracion);
    return { token, roles, email, remember: dto.remember ?? false };
  }

  async getSession(): Promise<SessionResult> {
    const { getSession } = await import("@/lib/server/auth");
    const session = await getSession();
    if (!session) return { authenticated: false } as const;

    let eventoNombre: string | null = session.eventoNombre ?? null;
    if (!eventoNombre && session.eventoId) {
      const ev = await this.repo.findEventoById(session.eventoId);
      if (ev) eventoNombre = `${ev.eventoPadre.nombre} ${ev.anio}`;
    }

    return {
      authenticated: true, userId: session.sub, email: session.email, roles: session.roles,
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
    const tipoEvento = dto.tipoEvento ?? payload.tipoEvento as number | undefined;
    const codigoEvento = dto.codigoEvento ?? payload.codigoEvento as number | undefined;

    if (tipoEvento && codigoEvento) {
      const ev = await this.repo.findOrCreateEvento(tipoEvento, codigoEvento);
      eventoId = ev.id;
    }

    if (!eventoId) throw new Error("NOT_FOUND:Evento no encontrado");

    // jose interpreta un numero como marca de tiempo absoluta: se reusa la exp
    // del token anterior para conservar la vigencia, y la cookie usa los
    // segundos restantes (relativos).
    const expAbsoluto = typeof payload.exp === "number" ? payload.exp : undefined;
    const segundosRestantes = expAbsoluto
      ? Math.max(60, expAbsoluto - Math.floor(Date.now() / 1000))
      : SESION.MAX_AGE_ESTANDAR;

    const newToken = await signToken({
      sub: payload.sub as string, email: payload.email as string,
      name: payload.name as string, roles: payload.roles as Rol[],
      permissions: payload.permissions as string[],
      eventoId, tipoEvento, codigoEvento,
      eventoNombre: dto.eventoNombre,
      eventoPadreNombre: dto.eventoPadreNombre ?? payload.eventoPadreNombre as string | undefined,
    }, expAbsoluto ?? SESION.JWT_EXPIRACION_ESTANDAR);

    return { token: newToken, eventoId, tipoEvento, codigoEvento, maxAge: segundosRestantes };
  }

  async getPerfil(): Promise<PerfilResult | null> {
    const { getSession } = await import("@/lib/server/auth");
    const session = await getSession();
    if (!session) return null;
    const u = await this.repo.findPerfilByEmail(session.email);
    return u ?? { email: session.email, nombre: null, apellidos: null, telefono: null, tipoUsuarioId: null, idEmpresa: null, nombreEmpresa: null };
  }

  async updatePerfil(dto: PerfilUpdateRequestDTO): Promise<boolean> {
    const { getSession } = await import("@/lib/server/auth");
    const session = await getSession();
    if (!session) return false;
    await this.repo.updatePerfil(session.email, dto);
    return true;
  }

  async requestReset(dto: ResetPasswordRequestDTO): Promise<RequestResetResult> {
    const user = await this.repo.findForReset(dto.email);
    if (!user) return { ok: true, message: "Si el email existe, recibiras un enlace" };

    const token = generarTokenAleatorio();
    await this.repo.setResetToken(user.id, token, new Date(Date.now() + RESET_PASSWORD_MINUTOS_VIGENCIA * MS_POR_MINUTO));

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/recuperar/${token}`;
    await sendEmail({ to: user.email, subject: "Restablecer contrasena — IIMP", html: `<div style="font-family:Inter,Arial,sans-serif;padding:24px"><h2 style="color:#1B365D">Restablecer contrasena</h2><p>Haz clic para crear una nueva. Expira en 30 min.</p><a href="${resetUrl}" style="background:#1B365D;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Restablecer</a></div>` }).catch(() => {});
    return { ok: true, message: "Si el email existe, recibiras un enlace" };
  }

  async confirmReset(dto: ConfirmResetRequestDTO): Promise<ConfirmResetResult> {
    const user = await this.repo.findByResetToken(dto.token);
    if (!user) return { error: "Token invalido o expirado" } as const;
    await this.repo.updatePassword(user.id, hashPassword(dto.password));
    return { ok: true, message: "Contrasena actualizada" };
  }
}
