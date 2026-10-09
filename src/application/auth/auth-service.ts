import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IRoleRepository } from "@/domain/ports/role-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IPersonaClient } from "@/domain/ports/persona-client";
import { signToken } from "@/lib/server/auth";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { generarCodigoNumerico, generarTokenAleatorio } from "@/lib/server/utils/token";
import { esHash, hashPassword, verificarPassword } from "@/lib/server/utils/password";
import { leerImagenFuente, tipoImagen } from "@/lib/server/utils/imagen-fuente";
import { resolverIdiomaPeticion } from "@/lib/server/idioma";
import { resolverIdiomaDestinatario } from "@/application/idioma/resolver-idioma";
import { SESION, RESET_PASSWORD_MINUTOS_VIGENCIA, ROLES, REGISTRO_CODIGO, MS_POR_MINUTO, PASSWORD_MIN_LENGTH, TIPOS_DOCUMENTO_PERSONA, FOTO_PERSONA_MAX_BYTES, REGEX_RUC } from "@/lib/shared/constants";
import { getAppUrl } from "@/lib/server/app-url";
import type { Idioma, Rol } from "@/lib/shared/constants";import type { LoginRequestDTO } from "@/types/dto/auth/login-request.dto";
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
import type { CambiarPasswordRequestDTO } from "@/types/dto/auth/cambiar-password-request.dto";
import type { CambiarPasswordResult } from "@/types/dto/auth/cambiar-password-result.dto";
import type { CambiarIdiomaRequestDTO } from "@/types/dto/auth/cambiar-idioma-request.dto";
import type { CambiarIdiomaResult } from "@/types/dto/auth/cambiar-idioma-result.dto";
import { esIdioma, idiomaODefecto } from "@/lib/shared/utils/idioma";

const MENSAJE_CUENTA_EXISTENTE = "Este correo ya tiene una cuenta. Inicia sesion.";

export class AuthApplicationService {
  constructor(
    private readonly repo: IAuthRepository,
    private readonly roleRepo: IRoleRepository,
    private readonly empresas: IEmpresaRepository,
    private readonly personaClient: IPersonaClient,
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

    const enviado = await enviarEmailPlantilla({
      to: email,
      plantilla: "codigo-registro",
      idioma: await resolverIdiomaPeticion(),
      datos: { codigo, nombre: dto.nombre.trim() },
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
      /* Persiste el idioma elegido durante el registro (los correos siguientes lo respetan). */
      idioma: await resolverIdiomaPeticion(),
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
    /* El identificador puede ser correo o RUC (11 digitos): se busca por el que corresponda. */
    const identificador = dto.email.trim().toLowerCase();
    const esRuc = REGEX_RUC.test(identificador);
    const userRoles = esRuc ? await this.repo.findByRuc(identificador) : await this.repo.findByEmail(identificador);
    /*
     * Con RUC puede haber varias cuentas de la empresa (usuarios): se elige la que
     * valida la contrasena; si ninguna, se reporta la contrasena incorrecta.
     */
    const principal = esRuc
      ? userRoles.find((u) => verificarPassword(dto.password, u.password)) ?? userRoles[0]
      : userRoles[0];
    if (!principal) return { error: "Usuario sin roles asignados", status: 403 } as const;
    if (!verificarPassword(dto.password, principal.password)) {
      return { error: "Contrasena incorrecta", status: 401 } as const;
    }
    /* Cuenta deshabilitada por backoffice: sin login y con sesion activa cortada. */
    if (principal.flgActivo === false) {
      return { error: "Cuenta deshabilitada. Contacta al administrador.", status: 403 } as const;
    }
    /* La sesion y el resto del flujo usan el correo REAL de la cuenta (no el identificador). */
    const email = principal.email.trim().toLowerCase();
    // Migracion transparente: si venia en texto plano, se guarda hasheada.
    if (!esHash(principal.password)) {
      await this.repo.updatePassword(principal.id, hashPassword(dto.password)).catch(() => {});
    }

    const roles = userRoles.map((ur) => ur.role.nombre as Rol);
    const permissions = principal.role.permisos;
    const expiracion = dto.remember ? SESION.JWT_EXPIRACION_RECORDADA : SESION.JWT_EXPIRACION_ESTANDAR;
    /*
     * Reusa el ultimo evento elegido (persistido en `user_role.eventoId`) para que el
     * token nazca con `eventoId` y el usuario no tenga que volver a seleccionarlo.
     */
    const evento = principal.eventoId
      ? await this.repo.findEventoById(principal.eventoId).catch(() => null)
      : null;

    /* Credencial temporal (cuenta creada por backoffice): cambio obligatorio en el portal. */
    const debeCambiarPassword = principal.debeCambiarPassword === true;
    /* Idioma preferido del usuario (para plantillas de correo y selector ES/EN). */
    const perfilIdioma = await this.repo.findPerfilByEmail(email).catch(() => null);
    const idioma = idiomaODefecto(perfilIdioma?.idioma ?? null);
    /* Primer ingreso de la empresa: debe validar sus datos contractuales. */
    const estadoEmpresa = debeCambiarPassword
      ? null
      : await this.repo.estadoEmpresaPortal(email).catch(() => null);
    const requiereValidarDatos = Boolean(estadoEmpresa && !estadoEmpresa.primerAccesoCompletado);

    const token = await signToken(
      {
        sub: `user|${email}`,
        email,
        name: email.split("@")[0] ?? email,
        roles,
        permissions,
        ...(debeCambiarPassword ? { debeCambiarPassword: true } : {}),
        ...(evento
          ? {
              eventoId: evento.id,
              eventoPadreId: evento.eventoPadreId,
              tipoEvento: evento.tipoEvento,
              codigoEvento: evento.codigoEvento,
              /* Prioriza el nombre elegido en presala (persistido); cae al nombre de la BD. */
              eventoNombre: principal.eventoNombre ?? `${evento.eventoPadre.nombre} ${evento.anio}`,
              eventoPadreNombre: principal.eventoPadreNombre ?? evento.eventoPadre.nombre,
            }
          : {}),
      },
      expiracion,
    );
    return { token, roles, email, remember: dto.remember ?? false, debeCambiarPassword, requiereValidarDatos, idioma };
  }

  /**
   * Credencial temporal -> contrasena definitiva (primer ingreso de una cuenta
   * creada por backoffice). Valida la actual, exige minimo de longitud, guarda el
   * hash, limpia la exigencia y reemite el token sin el flag.
   */
  async cambiarPassword(dto: CambiarPasswordRequestDTO): Promise<CambiarPasswordResult> {
    const { getSession } = await import("@/lib/server/auth");
    const session = await getSession();
    if (!session) return { ok: false, error: "No autorizado", status: 401 };

    const email = session.email;
    const userRoles = await this.repo.findByEmail(email);
    const principal = userRoles[0];
    if (!principal) return { ok: false, error: "Usuario no encontrado", status: 404 };

    if (!verificarPassword(dto.passwordActual ?? "", principal.password)) {
      return { ok: false, error: "La contrasena actual no es correcta", status: 400 };
    }
    const nueva = (dto.passwordNueva ?? "").trim();
    if (nueva.length < PASSWORD_MIN_LENGTH) {
      return { ok: false, error: `La nueva contrasena debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`, status: 400 };
    }
    if (verificarPassword(nueva, principal.password)) {
      return { ok: false, error: "La nueva contrasena debe ser distinta a la actual", status: 400 };
    }

    await this.repo.updatePassword(principal.id, hashPassword(nueva));
    await this.repo.marcarCambioPasswordRequerido(email, false);

    /* Reemite el token (sin el flag) conservando roles, permisos y evento elegido. */
    const roles = userRoles.map((ur) => ur.role.nombre as Rol);
    const permissions = principal.role.permisos;
    const evento = principal.eventoId
      ? await this.repo.findEventoById(principal.eventoId).catch(() => null)
      : null;
    const token = await signToken(
      {
        sub: `user|${email}`,
        email,
        name: session.name ?? email.split("@")[0] ?? email,
        roles,
        permissions,
        ...(evento
          ? {
              eventoId: evento.id,
              eventoPadreId: evento.eventoPadreId,
              tipoEvento: evento.tipoEvento,
              codigoEvento: evento.codigoEvento,
              eventoNombre: principal.eventoNombre ?? `${evento.eventoPadre.nombre} ${evento.anio}`,
              eventoPadreNombre: principal.eventoPadreNombre ?? evento.eventoPadre.nombre,
            }
          : {}),
      },
      SESION.JWT_EXPIRACION_ESTANDAR,
    );

    const estadoEmpresa = await this.repo.estadoEmpresaPortal(email).catch(() => null);
    return { ok: true, token, requiereValidarDatos: Boolean(estadoEmpresa && !estadoEmpresa.primerAccesoCompletado) };
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

    /* Idioma preferido (selector ES/EN del dashboard). */
    const perfil = await this.repo.findPerfilByEmail(session.email).catch(() => null);
    const idioma = idiomaODefecto(perfil?.idioma ?? null);

    return {
      authenticated: true, userId: session.sub, email: session.email, roles: session.roles,
      permissions: session.permissions, eventoId: session.eventoId ?? null,
      eventoPadreId: session.eventoPadreId ?? null, eventoNombre,
      eventoPadreNombre: session.eventoPadreNombre ?? null,
      tipoEvento: session.tipoEvento, codigoEvento: session.codigoEvento,
      idioma,
    };
  }

  async seleccionarEvento(dto: SeleccionarEventoRequestDTO, tokenCookie: string): Promise<SeleccionarEventoResult> {
    const { jwtVerify } = await import("jose");
    const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret");
    const { payload } = await jwtVerify(tokenCookie, SECRET);

    let eventoId = dto.eventoId;
    const tipoEvento = dto.tipoEvento ?? payload.tipoEvento as number | undefined;
    const codigoEvento = dto.codigoEvento ?? payload.codigoEvento as number | undefined;

    /* El `eventoId` explicito manda; los codigos resuelven solo cuando no viene id
       (si no, se re-resolvia el evento viejo del JWT y la seleccion no cambiaba). */
    if (!eventoId && tipoEvento && codigoEvento) {
      const ev = await this.repo.findOrCreateEvento(tipoEvento, codigoEvento);
      eventoId = ev.id;
    }

    if (!eventoId) throw new Error("NOT_FOUND:Evento no encontrado");

    /* Persiste el evento elegido (y su nombre visible) para reusarlo en el proximo login (best-effort). */
    await this.repo
      .setEventoSeleccionado(payload.email as string, eventoId, dto.eventoNombre ?? null, dto.eventoPadreNombre ?? null)
      .catch(() => undefined);

    /* El nombre local del evento nace como placeholder ("Evento N"/anio actual):
       se corrige con el nombre visible de KB (padre y anio de la version). */
    const anio = dto.eventoNombre?.match(/\b(19|20)\d{2}\b/)?.[0] ?? null;
    await this.repo.renombrarEvento(eventoId, dto.eventoPadreNombre?.trim() || null, anio).catch(() => undefined);

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
    if (!u) {
      return { email: session.email, nombre: null, apellidos: null, telefono: null, tipoUsuarioId: null, idEmpresa: null, nombreEmpresa: null, empresa: null, representanteIncompleto: false, logoUrl: null, firmaUrl: null, idioma: null };
    }
    /* Portal del Cliente: el representante legal debe tener DNI, correo, celular y direccion completos. */
    const ficha = u.empresa ?? (u.idEmpresa ? await this.empresas.findBySieCode(u.idEmpresa).catch(() => null) : null);
    const empresa = ficha ? {
      ruc: ficha.ruc,
      razonSocial: ficha.razonSocial,
      direccionFiscal: ficha.direccionFiscal,
      telefono: ficha.telefono,
      emailContacto: ficha.emailContacto,
      representanteLegalNombre: ficha.representanteLegalNombre,
      representanteLegalDni: ficha.representanteLegalDni,
      representanteCorreo: ficha.representanteCorreo,
      representanteCelular: ficha.representanteCelular,
      representanteDireccion: ficha.representanteDireccion,
      representantePartida: ficha.partidaElectronica,
    } : null;
    const representanteIncompleto = Boolean(
      empresa && (!empresa.representanteLegalDni || !empresa.representanteCorreo || !empresa.representanteCelular || !empresa.representanteDireccion),
    );
    return { ...u, empresa, representanteIncompleto };
  }

  /** Guarda el idioma preferido del usuario (selector ES/EN del dashboard). */
  async cambiarIdioma(dto: CambiarIdiomaRequestDTO): Promise<CambiarIdiomaResult> {
    const { getSession } = await import("@/lib/server/auth");
    const session = await getSession();
    if (!session) return { ok: false, error: "No autorizado", status: 401 };
    if (!esIdioma(dto?.idioma)) {
      return { ok: false, error: "Idioma no soportado (usa es o en)", status: 400 };
    }
    await this.repo.setIdioma(session.email, dto.idioma);
    return { ok: true, idioma: dto.idioma };
  }

  /**
   * Idioma preferido del usuario para correos/documentos (BD -> cookie -> español).
   * Expuesto a los controladores para no saltar capas.
   */
  async resolverIdiomaUsuario(email?: string | null): Promise<Idioma> {
    return resolverIdiomaDestinatario(this.repo, email ?? null);
  }

  async updatePerfil(dto: PerfilUpdateRequestDTO): Promise<boolean> {
    const { getSession } = await import("@/lib/server/auth");
    const session = await getSession();
    if (!session) return false;
    /*
     * El RUC de la empresa elegida (codigo SIE de entidades) resuelve la empresa
     * fiscal local por RUC para dejar la FK `empresa_id`; sin registro local queda
     * solo el vinculo legacy (codigo + nombre). Al desvincular se limpia la FK.
     */
    /* Los campos `representante*` no pertenecen a user_role: se guardan en la ficha de la empresa. */
    const { ruc, representanteNombre, representanteDni, representanteCorreo, representanteCelular, representanteDireccion, representantePartida, ...resto } = dto;
    let empresaId: string | null | undefined;
    if (ruc) {
      const limpio = ruc.replace(/\D/g, "");
      const empresa = limpio ? await this.empresas.findByRuc(limpio) : null;
      empresaId = empresa?.id ?? null;
    } else if (dto.idEmpresa === null) {
      empresaId = null;
    }
    await this.repo.updatePerfil(session.email, { ...resto, ...(empresaId !== undefined ? { empresaId } : {}) });

    /* Datos del representante legal: se guardan en la ficha de la empresa del usuario
     * (FK local o, si solo hay vinculo SIE, la ficha que tenga ese sie_code). */
    if (representanteNombre !== undefined || representanteDni !== undefined || representanteCorreo !== undefined || representanteCelular !== undefined || representanteDireccion !== undefined || representantePartida !== undefined) {
      let fichaId = await this.repo.findEmpresaIdDeUsuario(session.email).catch(() => null);
      if (!fichaId) {
        const info = await this.repo.findPerfilByEmail(session.email).catch(() => null);
        if (info?.idEmpresa) {
          fichaId = (await this.empresas.findBySieCode(info.idEmpresa).catch(() => null))?.id ?? null;
        }
      }
      if (fichaId) {
        await this.empresas.update(fichaId, {
          ...(representanteNombre !== undefined ? { representanteLegalNombre: (representanteNombre ?? "").trim() || null } : {}),
          ...(representanteDni !== undefined ? { representanteLegalDni: (representanteDni ?? "").trim() || null } : {}),
          ...(representanteCorreo !== undefined ? { representanteCorreo: (representanteCorreo ?? "").trim() || null } : {}),
          ...(representanteCelular !== undefined ? { representanteCelular: (representanteCelular ?? "").trim() || null } : {}),
          ...(representanteDireccion !== undefined ? { representanteDireccion: (representanteDireccion ?? "").trim() || null } : {}),
          ...(representantePartida !== undefined ? { partidaElectronica: (representantePartida ?? "").trim() || null } : {}),
        }).catch(() => {});
      }
    }

    /* Refleja en servicio-persona lo editable del perfil (telefono/correo -> celular/correo, logo -> foto). */
    await this.sincronizarPersonaFuente(session.email, dto).catch(() => {});
    return true;
  }

  /**
   * Sincroniza en servicio-persona lo editable del perfil cuando la cuenta tiene
   * `sie_code`: celular del representante (o telefono personal) -> celular,
   * correo del representante -> correo, direccion -> direccion (PUT con el
   * cuerpo completo que trae el GET) y logoUrl -> foto (subida binaria; null la elimina).
   * El correo no se cambia desde Perfil sin validacion previa. Best-effort.
   */
  private async sincronizarPersonaFuente(email: string, dto: PerfilUpdateRequestDTO): Promise<void> {
    if (dto.telefono === undefined && dto.representanteCelular === undefined && dto.logoUrl === undefined && dto.representanteCorreo === undefined && dto.representanteDireccion === undefined) return;
    const sieCode = await this.repo.findSieCodePorEmail(email);
    if (!sieCode) return;
    const persona = await this.personaClient.obtenerPersona(sieCode);
    if (!persona) return;

    const celularDestino = dto.representanteCelular !== undefined
      ? ((dto.representanteCelular ?? "").trim() || null)
      : dto.telefono !== undefined
        ? ((dto.telefono ?? "").trim() || null)
        : (persona.celular ?? null);
    const cambioTelefono = (dto.representanteCelular !== undefined || dto.telefono !== undefined) && (persona.celular ?? "").trim() !== (celularDestino ?? "");
    const cambioCorreo = dto.representanteCorreo !== undefined && (persona.correo ?? "").trim() !== ((dto.representanteCorreo ?? "").trim() || "");
    const cambioDireccion = dto.representanteDireccion !== undefined && (persona.direccion ?? "").trim() !== ((dto.representanteDireccion ?? "").trim() || "");
    if ((cambioTelefono || cambioCorreo || cambioDireccion) && persona.apellido_paterno && persona.nombres && persona.documento) {
      await this.personaClient.actualizarPersona(sieCode, {
        apellido_paterno: persona.apellido_paterno,
        apellido_materno: persona.apellido_materno ?? null,
        nombres: persona.nombres,
        id_tipo_documento: persona.id_tipo_documento ?? TIPOS_DOCUMENTO_PERSONA.DNI,
        documento: persona.documento,
        direccion: dto.representanteDireccion !== undefined ? ((dto.representanteDireccion ?? "").trim() || null) : (persona.direccion ?? null),
        correo: dto.representanteCorreo !== undefined ? ((dto.representanteCorreo ?? "").trim() || null) : (persona.correo ?? null),
        celular: celularDestino,
      });
    }

    if (dto.logoUrl !== undefined) {
      if (dto.logoUrl) {
        const imagen = await leerImagenFuente(dto.logoUrl);
        const tipo = imagen ? tipoImagen(imagen) : null;
        if (imagen && tipo && imagen.length <= FOTO_PERSONA_MAX_BYTES) {
          await this.personaClient.subirFoto(sieCode, imagen, tipo);
        }
      } else {
        await this.personaClient.borrarFoto(sieCode);
      }
    }
  }

  async requestReset(dto: ResetPasswordRequestDTO): Promise<RequestResetResult> {
    const user = await this.repo.findForReset(dto.email);
    /* Cuenta deshabilitada: misma respuesta generica, sin generar enlace. */
    if (!user || user.flgActivo === false) return { ok: true, message: "Si el email existe, recibiras un enlace" };

    const token = generarTokenAleatorio();
    await this.repo.setResetToken(user.id, token, new Date(Date.now() + RESET_PASSWORD_MINUTOS_VIGENCIA * MS_POR_MINUTO));

    const resetUrl = `${getAppUrl()}/auth/recuperar/${token}`;
    await enviarEmailPlantilla({
      to: user.email,
      plantilla: "reset-password",
      idioma: await resolverIdiomaDestinatario(this.repo, user.email),
      datos: { nombre: user.nombre, url: resetUrl, minutos: RESET_PASSWORD_MINUTOS_VIGENCIA },
    }).catch(() => {});
    return { ok: true, message: "Si el email existe, recibiras un enlace" };
  }

  async confirmReset(dto: ConfirmResetRequestDTO): Promise<ConfirmResetResult> {
    const user = await this.repo.findByResetToken(dto.token);
    if (!user) return { error: "Token invalido o expirado" } as const;
    await this.repo.updatePassword(user.id, hashPassword(dto.password));
    return { ok: true, message: "Contrasena actualizada" };
  }
}
