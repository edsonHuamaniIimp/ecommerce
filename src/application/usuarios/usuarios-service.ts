import { API_ERROR_CODES, IDIOMA_DEFAULT, REGEX_EMAIL, ROLES } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { hashPassword, generarPasswordTemporal } from "@/lib/server/utils/password";
import { validarDocumentoPersona } from "@/lib/shared/utils/documento-persona";
import { actualizarPersonaSiDifiere } from "@/lib/server/utils/persona-fuente";
import type { ActualizarUsuarioPortalData, IUsuarioRepository, UsuarioPortalRow, UsuariosPaginationParams } from "@/domain/ports/usuario-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IRoleRepository } from "@/domain/ports/role-repository";
import type { IPersonaClient } from "@/domain/ports/persona-client";

/** Empresa seleccionada desde la API de entidades (codigo SIE + razon social). */
export interface EmpresaAccesoInput {
  idEmpresa: string;
  nombreEmpresa: string;
  /** RUC opcional: si existe una empresa local con ese RUC se vincula tambien la FK. */
  ruc?: string | null;
}

/**
 * Datos de un usuario del Portal del Cliente. La persona (filiatorios) vive en
 * servicio-persona; aca solo se persiste su identificador (sie_code), el correo
 * del acceso local y la empresa (codigo SIE + nombre).
 */
export interface NuevoUsuarioPortalInput {
  email: string;
  tipoDocumento: string;
  documento: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  nombres: string;
  celular?: string | null;
  /** Direccion de la persona (la fuente la exige al crear/actualizar). */
  direccion?: string | null;
  /** Rol local a asignar; por defecto cliente. */
  rolId?: string | null;
}

/** Alta de cuenta local para una persona que ya existe en servicio-persona. */
export interface CrearCuentaPersonaInput extends EmpresaAccesoInput {
  sieCode: string;
  email: string;
  rolId?: string | null;
}

/** Cambios del acceso local desde la bandeja de Usuarios (empresa, correo y estado). */
export interface ActualizarAccesoInput {
  /** Empresa elegida de la API de entidades; omitida = no cambia. */
  empresa?: EmpresaAccesoInput;
  /** Correo del login; omitido/null = no cambia. */
  email?: string | null;
  /** Estado del acceso; omitido/null = no cambia. false = deshabilitado. */
  flgActivo?: boolean | null;
}

export interface ResultadoCreacionUsuario {
  email: string;
  creado: boolean;
  /** true = credenciales enviadas por correo; false = fallo el envio; null = no se creo. */
  emailEnviado: boolean | null;
  error: string | null;
}

/**
 * Alta de usuarios del Portal del Cliente (backoffice):
 *  1. La persona se busca/crea en servicio-persona (fuente) y se obtiene su `sie_code`.
 *  2. Localmente solo se persiste el acceso: sie_code + correo + empresa (SIE) + rol.
 */
export class UsuariosApplicationService {
  constructor(
    private readonly repo: IUsuarioRepository,
    private readonly authRepo: IAuthRepository,
    private readonly empresaRepo: IEmpresaRepository,
    private readonly roleRepo: IRoleRepository,
    private readonly personaClient: IPersonaClient,
  ) {}

  /** Bandeja paginada de usuarios (paginacion/busqueda/filtro server-side). */
  listar(params: UsuariosPaginationParams) {
    return this.repo.listarUsuariosPortal(params);
  }

  /** Busca personas en la fuente (servicio-persona) para reutilizarlas como cuenta local. */
  buscarPersonas(q: string) {
    return this.personaClient.buscarPersonas(q);
  }

  /** Rol solicitado (o cliente por defecto). */
  private async resolverRol(rolId?: string | null): Promise<{ id: string }> {
    const rol = rolId ? await this.roleRepo.findById(rolId) : await this.roleRepo.findByNombre(ROLES.CLIENTE);
    if (!rol) {
      if (rolId) throw new DomainError("Rol no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
      throw new DomainError(`No existe el rol ${ROLES.CLIENTE} en el sistema`, API_ERROR_CODES.INTERNAL, 500);
    }
    return rol;
  }

  /** Valida la empresa elegida de la API y resuelve la FK local por RUC si existe. */
  private async resolverEmpresa(empresa: EmpresaAccesoInput): Promise<{ idEmpresa: string; nombreEmpresa: string; empresaId: string | null }> {
    const idEmpresa = String(empresa.idEmpresa ?? "").trim();
    const nombreEmpresa = String(empresa.nombreEmpresa ?? "").trim();
    if (!idEmpresa || !nombreEmpresa) {
      throw new DomainError("Empresa requerida (codigo SIE y razon social)", API_ERROR_CODES.VALIDATION, 400);
    }
    const ruc = String(empresa.ruc ?? "").replace(/\D/g, "");
    const local = ruc ? await this.empresaRepo.findByRuc(ruc) : null;
    return { idEmpresa, nombreEmpresa, empresaId: local?.id ?? null };
  }

  async crear(empresa: EmpresaAccesoInput, input: NuevoUsuarioPortalInput): Promise<ResultadoCreacionUsuario> {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!REGEX_EMAIL.test(email)) {
      return { email, creado: false, emailEnviado: null, error: "Correo invalido" };
    }

    const apellidoPaterno = String(input.apellidoPaterno ?? "").trim();
    const nombres = String(input.nombres ?? "").trim();
    if (!apellidoPaterno || !nombres) {
      return { email, creado: false, emailEnviado: null, error: "Apellido paterno y nombres son requeridos" };
    }
    const errorDocumento = validarDocumentoPersona(input.tipoDocumento, input.documento ?? "");
    if (errorDocumento) {
      return { email, creado: false, emailEnviado: null, error: errorDocumento };
    }

    const empresaResuelta = await this.resolverEmpresa(empresa);

    if (await this.authRepo.existeEmail(email)) {
      return { email, creado: false, emailEnviado: null, error: "El correo ya tiene una cuenta habilitada" };
    }

    const documento = String(input.documento ?? "").trim();
    let persona = await this.personaClient.buscarPorDocumento(documento, input.tipoDocumento);
    if (persona?.sie_code) {
      /* Criterio: si ya existe en la fuente se reutiliza; solo se actualiza si difiere. */
      await actualizarPersonaSiDifiere(this.personaClient, persona, {
        tipoDocumento: input.tipoDocumento,
        documento,
        apellidoPaterno,
        apellidoMaterno: (input.apellidoMaterno ?? "").trim() || null,
        nombres,
        correo: email,
        celular: (input.celular ?? "").trim() || null,
        direccion: (input.direccion ?? "").trim() || null,
      });
    } else {
      persona = await this.personaClient.crearPersona({
        apellido_paterno: apellidoPaterno,
        apellido_materno: (input.apellidoMaterno ?? "").trim() || null,
        nombres,
        id_tipo_documento: input.tipoDocumento,
        documento,
        direccion: (input.direccion ?? "").trim() || null,
        correo: email,
        celular: (input.celular ?? "").trim() || null,
      });
    }
    const sieCode = persona.sie_code ?? null;
    if (!sieCode) {
      return { email, creado: false, emailEnviado: null, error: "El servicio de personas no devolvio el identificador (sie_code)" };
    }

    const rol = await this.resolverRol(input.rolId);
    const passwordTemporal = generarPasswordTemporal();
    await this.authRepo.crearUsuario({
      userId: `user|${email}`,
      email,
      password: hashPassword(passwordTemporal),
      /* Solo referencia: la persona vive en servicio-persona. */
      nombre: "",
      apellidos: "",
      telefono: null,
      nombreEmpresa: empresaResuelta.nombreEmpresa,
      roleId: rol.id,
      empresaId: empresaResuelta.empresaId,
      idEmpresa: empresaResuelta.idEmpresa,
      sieCode,
      ruc: String(empresa.ruc ?? "").replace(/\D/g, "") || null,
      debeCambiarPassword: true,
    });

    const emailEnviado = await this.enviarCredenciales(email, empresaResuelta.nombreEmpresa, [nombres, apellidoPaterno].filter(Boolean).join(" "), passwordTemporal);
    return { email, creado: true, emailEnviado, error: null };
  }

  /** Alta por lote: todos los usuarios se vinculan a la misma empresa y rol. */
  async crearLote(empresa: EmpresaAccesoInput, usuarios: NuevoUsuarioPortalInput[], rolId?: string | null): Promise<{ resultados: ResultadoCreacionUsuario[] }> {
    const resultados: ResultadoCreacionUsuario[] = [];
    for (const usuario of usuarios) {
      resultados.push(await this.crear(empresa, { ...usuario, rolId: usuario.rolId ?? rolId ?? null }));
    }
    return { resultados };
  }

  /**
   * Crea la cuenta local para una persona existente en servicio-persona:
   * se persiste su sie_code + correo + empresa (SIE) + rol (la persona no se duplica).
   */
  async crearCuentaDesdePersona(input: CrearCuentaPersonaInput): Promise<ResultadoCreacionUsuario> {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!REGEX_EMAIL.test(email)) {
      return { email, creado: false, emailEnviado: null, error: "Correo invalido" };
    }
    const sieCode = String(input.sieCode ?? "").trim();
    if (!sieCode) {
      return { email, creado: false, emailEnviado: null, error: "sieCode requerido" };
    }

    const empresaResuelta = await this.resolverEmpresa(input);

    if (await this.authRepo.existeEmail(email)) {
      return { email, creado: false, emailEnviado: null, error: "El correo ya tiene una cuenta habilitada" };
    }

    const rol = await this.resolverRol(input.rolId);
    const passwordTemporal = generarPasswordTemporal();
    await this.authRepo.crearUsuario({
      userId: `user|${email}`,
      email,
      password: hashPassword(passwordTemporal),
      nombre: "",
      apellidos: "",
      telefono: null,
      nombreEmpresa: empresaResuelta.nombreEmpresa,
      roleId: rol.id,
      empresaId: empresaResuelta.empresaId,
      idEmpresa: empresaResuelta.idEmpresa,
      sieCode,
      ruc: String(input.ruc ?? "").replace(/\D/g, "") || null,
      debeCambiarPassword: true,
    });

    const emailEnviado = await this.enviarCredenciales(email, empresaResuelta.nombreEmpresa, null, passwordTemporal);
    return { email, creado: true, emailEnviado, error: null };
  }

  /**
   * Actualiza el acceso local: empresa (API de entidades), correo del login y/o
   * estado. Deshabilitar corta la sesion activa (validacion en proxy/getSession)
   * y el login; un admin no puede deshabilitar su propia cuenta.
   */
  async actualizar(id: string, cambios: ActualizarAccesoInput, solicitanteEmail?: string | null): Promise<UsuarioPortalRow> {
    const usuario = await this.repo.findUsuarioPortalById(id);
    if (!usuario) throw new DomainError("Usuario no encontrado", API_ERROR_CODES.NOT_FOUND, 404);

    const data: ActualizarUsuarioPortalData = {};

    if (cambios.empresa) {
      const empresaResuelta = await this.resolverEmpresa(cambios.empresa);
      data.idEmpresa = empresaResuelta.idEmpresa;
      data.nombreEmpresa = empresaResuelta.nombreEmpresa;
      data.empresaId = empresaResuelta.empresaId ?? undefined;
    }

    if (cambios.email != null) {
      const email = String(cambios.email).trim().toLowerCase();
      if (!REGEX_EMAIL.test(email)) {
        throw new DomainError("Correo invalido", API_ERROR_CODES.VALIDATION, 400);
      }
      if (email !== usuario.email.trim().toLowerCase()) {
        if (await this.repo.existeEmailEnOtraCuenta(email, usuario.userId)) {
          throw new DomainError("El correo ya pertenece a otra cuenta", API_ERROR_CODES.CONFLICT, 409);
        }
        data.email = email;
      }
    }

    if (cambios.flgActivo != null) {
      const esMismaCuenta = solicitanteEmail != null
        && solicitanteEmail.trim().toLowerCase() === usuario.email.trim().toLowerCase();
      if (!cambios.flgActivo && esMismaCuenta) {
        throw new DomainError("No puedes deshabilitar tu propia cuenta", API_ERROR_CODES.VALIDATION, 400);
      }
      data.flgActivo = cambios.flgActivo;
    }

    if (Object.keys(data).length === 0) {
      throw new DomainError("No hay cambios por aplicar", API_ERROR_CODES.VALIDATION, 400);
    }

    return this.repo.actualizarUsuarioPortal(id, data);
  }

  /** Regenera la contrasena temporal y reenvia las credenciales al correo del usuario. */
  async enviarAccesos(id: string): Promise<{ email: string; emailEnviado: boolean }> {
    const usuario = await this.repo.findUsuarioPortalById(id);
    if (!usuario) throw new DomainError("Usuario no encontrado", API_ERROR_CODES.NOT_FOUND, 404);

    const passwordTemporal = generarPasswordTemporal();
    await this.repo.actualizarPasswordUsuarioPortal(id, hashPassword(passwordTemporal), true);

    const emailEnviado = await this.enviarCredenciales(usuario.email, usuario.empresa ?? "", usuario.nombre, passwordTemporal);
    return { email: usuario.email, emailEnviado };
  }

  private async enviarCredenciales(email: string, razonSocial: string, nombreContacto: string | null, passwordTemporal: string): Promise<boolean> {
    try {
      return await enviarEmailPlantilla({
        to: email,
        plantilla: "credenciales-empresa",
        idioma: IDIOMA_DEFAULT,
        datos: { razonSocial, nombreContacto, email, passwordTemporal },
      });
    } catch {
      return false;
    }
  }
}
