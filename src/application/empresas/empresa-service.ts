import { API_ERROR_CODES, CARGA_MASIVA_MAX_FILAS, ESTADOS_EMPRESA, ESTADOS_FILA_CARGA, FOTO_PERSONA_MAX_BYTES, IDIOMA_DEFAULT, PERMISSIONS, REGEX_DNI, REGEX_EMAIL, REGEX_RUC, ROLES, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_PERSONA, UBIGEO_PAIS_PERU } from "@/lib/shared/constants";
import type { TipoComprobante } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { hashPassword, generarPasswordTemporal } from "@/lib/server/utils/password";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { validarDocumentoPersona } from "@/lib/shared/utils/documento-persona";
import { actualizarPersonaSiDifiere } from "@/lib/server/utils/persona-fuente";
import { leerImagenFuente, tipoImagen } from "@/lib/server/utils/imagen-fuente";
import type { IConsultaDocumentoClient } from "@/domain/ports/consulta-documento-client";
import type { EmpresaApi, IEmpresaClient } from "@/domain/ports/empresa-client";
import type { IPersonaClient } from "@/domain/ports/persona-client";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IRoleRepository } from "@/domain/ports/role-repository";
import type {
  CrearEmpresaData,
  EmpresaEntity,
  EmpresaInput,
  EmpresasListParams,
  EmpresasPaginatedResult,
  FilaCargaEmpresa,
  FilaCargaValidada,
  PrevisualizacionCargaEmpresas,
  ResultadoCredencialesEmpresa,
  ResultadoImportacionEmpresas,
} from "@/domain/models/empresa";

const LARGO_MIN_RAZON_SOCIAL = 2;

/** Datos de la empresa a registrar en servicio-persona (si no existe en la fuente). */
export interface RegistrarEmpresaFuenteInput {
  nombre: string;
  /** Codigo de tipo de documento de empresa (6 = RUC, 0 = no domiciliado). */
  idTipoDocumento: string;
  documento: string;
  direccion: string;
  correo: string;
  telefono: string;
  /** Codigo de pais del catalogo de ubigeo (75 = PERU). */
  pais: number;
  linkLogo?: string | null;
}

/** Persona de contacto que se reutiliza (por documento) o se crea en la fuente. */
export interface RegistrarPersonaContactoInput {
  tipoDocumento: string;
  documento: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  nombres: string;
  celular?: string | null;
  direccion?: string | null;
}

/** Registro de la relacion usuario (persona) - empresa (fuente: servicio-persona). */
export interface RegistrarCuentaEmpresaInput {
  /** sie_code de la empresa ya elegida en la busqueda (null = crearla en la fuente). */
  sieCodeEmpresa?: string | null;
  empresa: RegistrarEmpresaFuenteInput;
  persona: RegistrarPersonaContactoInput;
  email: string;
  rolId?: string | null;
  /** Usuario del backoffice que registra la relacion. */
  creadoPor?: string | null;
}

export interface ResultadoRegistroEmpresa {
  email: string;
  emailEnviado: boolean;
  sieCodeEmpresa: string;
  sieCodePersona: string;
  empresaCreadaEnFuente: boolean;
  /** true = la empresa ya existia en la fuente con datos distintos y se actualizo (PUT). */
  empresaActualizadaEnFuente: boolean;
  personaCreadaEnFuente: boolean;
  /** FK de la ficha contractual local por RUC (null si no aplica). */
  empresaId: string | null;
}

/** Texto limpio (trim) o null si queda vacio. */
function limpiar(valor?: string | null): string | null {
  const texto = (valor ?? "").trim();
  return texto.length > 0 ? texto : null;
}

/** Valida tipo de comprobante (default factura). */
function validarTipoComprobante(tipo?: string | null): TipoComprobante {
  const valores = Object.values(TIPOS_COMPROBANTE) as string[];
  if (!tipo) return TIPOS_COMPROBANTE.FACTURA;
  if (!valores.includes(tipo)) {
    throw new DomainError(
      `Tipo de comprobante invalido: ${tipo}. Valores: ${valores.join(", ")}`,
      API_ERROR_CODES.VALIDATION,
      400,
    );
  }
  return tipo as TipoComprobante;
}

/** Valida los correos informados (contacto / facturacion). */
function validarEmails(emailContacto?: string | null, emailFacturacion?: string | null): void {
  for (const email of [emailContacto, emailFacturacion]) {
    const limpio = limpiar(email);
    if (limpio && !REGEX_EMAIL.test(limpio)) {
      throw new DomainError(`Correo invalido: ${limpio}`, API_ERROR_CODES.VALIDATION, 400);
    }
  }
}

/**
 * Empresas exhibidoras del Portal del Cliente: alta (individual/masiva), edicion y
 * validaciones de datos contractuales (RUC, razon social, correos, comprobante).
 */
export class EmpresaApplicationService {
  constructor(
    private readonly repo: IEmpresaRepository,
    private readonly authRepo: IAuthRepository,
    private readonly roleRepo: IRoleRepository,
    private readonly personaClient: IPersonaClient,
    private readonly empresaClient: IEmpresaClient,
    private readonly consultaDocumento: IConsultaDocumentoClient,
  ) {}

  async listar(params: EmpresasListParams): Promise<EmpresasPaginatedResult> {
    return this.repo.listarPaginated(params);
  }

  /** Busca empresas en la fuente (servicio-persona) por razon social o RUC. */
  buscarEmpresasFuente(q: string) {
    return this.empresaClient.buscarEmpresas(q);
  }

  /** Busca una persona en la fuente (servicio-persona) por documento exacto (padron interno). */
  buscarPersonaEnFuente(numeroDocumento: string, tipoDocumento: string) {
    return this.personaClient.buscarPorDocumento(numeroDocumento, tipoDocumento);
  }

  /**
   * Asegura al representante legal como persona en la fuente (misma logica que las
   * empresas): con RENIEC se obtienen nombres/apellidos oficiales; si ya existe por
   * documento se reutiliza (y se actualiza si difiere); si no, se crea. Direccion,
   * correo, celular y foto viajan a servicio-persona. Best-effort.
   */
  private async asegurarRepresentanteEnFuente(
    dni: string,
    email: string | null,
    telefono: string | null,
    direccion: string | null,
    fotoUrl: string | null,
  ): Promise<string | null> {
    try {
      const datos = await this.consultaDocumento.consultarDni(dni).catch(() => null);
      if (!datos?.apellidoPaterno || !datos.nombres) return null;
      const deseada = {
        tipoDocumento: TIPOS_DOCUMENTO_PERSONA.DNI,
        documento: dni,
        apellidoPaterno: datos.apellidoPaterno,
        apellidoMaterno: datos.apellidoMaterno ?? null,
        nombres: datos.nombres,
        correo: email,
        celular: telefono,
        direccion,
      };
      const existente = await this.personaClient.buscarPorDocumento(dni, TIPOS_DOCUMENTO_PERSONA.DNI);
      let sieCode = existente?.sie_code ?? null;
      if (sieCode) {
        await actualizarPersonaSiDifiere(this.personaClient, existente ?? {}, deseada);
      } else {
        const creada = await this.personaClient.crearPersona({
          apellido_paterno: deseada.apellidoPaterno,
          apellido_materno: deseada.apellidoMaterno,
          nombres: deseada.nombres,
          id_tipo_documento: deseada.tipoDocumento,
          documento: dni,
          direccion,
          correo: email,
          celular: telefono,
        });
        sieCode = creada.sie_code ?? null;
      }
      /* Foto: se sube a la fuente (Post /personas/{codigo}/foto) cuando hay imagen valida. */
      if (sieCode && fotoUrl) {
        const imagen = await leerImagenFuente(fotoUrl);
        const tipo = imagen ? tipoImagen(imagen) : null;
        if (imagen && tipo && imagen.length <= FOTO_PERSONA_MAX_BYTES) {
          await this.personaClient.subirFoto(sieCode, imagen, tipo);
        }
      }
      return sieCode;
    } catch {
      /* best-effort: la ficha contractual local no depende de la fuente */
      return null;
    }
  }

  /** Valida y normaliza los datos de la empresa segun la guia de servicio-persona. */
  private validarEmpresaFuente(empresa: RegistrarEmpresaFuenteInput): RegistrarEmpresaFuenteInput {
    const tipos = Object.values(TIPOS_DOCUMENTO_EMPRESA) as string[];
    const nombre = String(empresa.nombre ?? "").trim();
    if (nombre.length < LARGO_MIN_RAZON_SOCIAL) {
      throw new DomainError("La razon social es obligatoria", API_ERROR_CODES.VALIDATION, 400);
    }
    if (!tipos.includes(empresa.idTipoDocumento)) {
      throw new DomainError(`Tipo de documento de empresa invalido: ${empresa.idTipoDocumento}. Valores: ${tipos.join(", ")}`, API_ERROR_CODES.VALIDATION, 400);
    }
    const documento = String(empresa.documento ?? "").trim();
    if (empresa.idTipoDocumento === TIPOS_DOCUMENTO_EMPRESA.RUC && !REGEX_RUC.test(documento)) {
      throw new DomainError("El RUC debe tener 11 digitos", API_ERROR_CODES.VALIDATION, 400);
    }
    if (!documento || documento.length > 20) {
      throw new DomainError("El documento de la empresa es obligatorio (maximo 20 caracteres)", API_ERROR_CODES.VALIDATION, 400);
    }
    const direccion = String(empresa.direccion ?? "").trim();
    if (!direccion || direccion.length > 200) {
      throw new DomainError("La direccion es obligatoria (maximo 200 caracteres)", API_ERROR_CODES.VALIDATION, 400);
    }
    const correo = String(empresa.correo ?? "").trim();
    if (!REGEX_EMAIL.test(correo) || correo.length > 101) {
      throw new DomainError("El correo de la empresa es invalido", API_ERROR_CODES.VALIDATION, 400);
    }
    const telefono = String(empresa.telefono ?? "").trim();
    if (!telefono || telefono.length > 35) {
      throw new DomainError("El telefono de la empresa es obligatorio (maximo 35 caracteres)", API_ERROR_CODES.VALIDATION, 400);
    }
    const pais = Number.isInteger(empresa.pais) && empresa.pais > 0 ? empresa.pais : UBIGEO_PAIS_PERU;
    return { nombre, idTipoDocumento: empresa.idTipoDocumento, documento, direccion, correo, telefono, pais, linkLogo: limpiar(empresa.linkLogo) };
  }

  /**
   * Criterio de deduplicacion en la fuente: si la empresa ya existe alli se
   * reutiliza (nunca se crea de nuevo); solo se actualiza (PUT) cuando los datos
   * difieren y hay minimos completos (direccion, correo y telefono).
   */
  private async resolverEmpresaFuente(sieCodeElegido: string | null | undefined, empresa: RegistrarEmpresaFuenteInput): Promise<{ sieCode: string; creada: boolean; actualizada: boolean }> {
    const elegido = String(sieCodeElegido ?? "").trim();
    const existente = elegido ? null : await this.empresaClient.buscarPorDocumento(empresa.idTipoDocumento, empresa.documento);
    const sieCode = elegido || existente?.sie_code || "";
    if (sieCode) {
      const actualizada = await this.actualizarFuenteSiDifiere(sieCode, existente, empresa);
      return { sieCode, creada: false, actualizada };
    }
    const creada = await this.empresaClient.crearEmpresa({
      nombre: empresa.nombre,
      id_tipo_documento: empresa.idTipoDocumento,
      documento: empresa.documento,
      direccion: empresa.direccion,
      correo: empresa.correo,
      telefono: empresa.telefono,
      pais: empresa.pais,
      link_logo: empresa.linkLogo ?? null,
    });
    if (!creada.sie_code) {
      throw new DomainError("servicio-persona no devolvio el identificador (sie_code) de la empresa", API_ERROR_CODES.INTERNAL, 502);
    }
    return { sieCode: creada.sie_code, creada: true, actualizada: false };
  }

  /** Actualiza (PUT) la empresa de la fuente solo si sus datos difieren de los locales. */
  private async actualizarFuenteSiDifiere(sieCode: string, actual: EmpresaApi | null, empresa: RegistrarEmpresaFuenteInput): Promise<boolean> {
    if (!empresa.direccion || !empresa.correo || !empresa.telefono) return false;
    const enFuente = actual ?? (await this.empresaClient.buscarPorDocumento(empresa.idTipoDocumento, empresa.documento));
    if (!enFuente) return false;
    const igual = (a?: string | null, b?: string | null) => (a ?? "").trim() === (b ?? "").trim();
    const sinCambios =
      igual(enFuente.nombre, empresa.nombre) &&
      igual(enFuente.direccion, empresa.direccion) &&
      igual(enFuente.correo, empresa.correo) &&
      igual(enFuente.telefono, empresa.telefono);
    if (sinCambios) return false;
    await this.empresaClient.actualizarEmpresa(sieCode, {
      nombre: empresa.nombre,
      id_tipo_documento: empresa.idTipoDocumento,
      documento: empresa.documento,
      direccion: empresa.direccion,
      correo: empresa.correo,
      telefono: empresa.telefono,
      pais: empresa.pais,
      link_logo: empresa.linkLogo ?? null,
    });
    return true;
  }

  /**
   * Best-effort: asegura la empresa en servicio-persona (fuente) al registrarla en el
   * backoffice. Sin los datos minimos que exige la fuente (direccion, correo y
   * telefono) o si la fuente falla, la ficha local se crea igual y el `sie_code`
   * queda pendiente (se completa al usar el flujo "Registrar desde servicio-persona").
   */
  private async asegurarEmpresaEnFuenteBestEffort(empresa: RegistrarEmpresaFuenteInput): Promise<string | null> {
    if (!empresa.direccion || !empresa.correo || !empresa.telefono) return null;
    try {
      return (await this.resolverEmpresaFuente(null, empresa)).sieCode;
    } catch {
      return null;
    }
  }

  /** Asegura la persona de contacto en la fuente: reutiliza (y actualiza si difiere) o la crea. */
  private async resolverPersonaFuente(persona: RegistrarPersonaContactoInput, email: string): Promise<{ sieCode: string; creada: boolean }> {
    const documento = String(persona.documento ?? "").trim();
    const existente = await this.personaClient.buscarPorDocumento(documento, persona.tipoDocumento);
    if (existente?.sie_code) {
      await actualizarPersonaSiDifiere(this.personaClient, existente, {
        tipoDocumento: persona.tipoDocumento,
        documento,
        apellidoPaterno: String(persona.apellidoPaterno ?? "").trim(),
        apellidoMaterno: (persona.apellidoMaterno ?? "").trim() || null,
        nombres: String(persona.nombres ?? "").trim(),
        correo: email,
        celular: (persona.celular ?? "").trim() || null,
        direccion: (persona.direccion ?? "").trim() || null,
      });
      return { sieCode: existente.sie_code, creada: false };
    }
    const creada = await this.personaClient.crearPersona({
      apellido_paterno: String(persona.apellidoPaterno ?? "").trim(),
      apellido_materno: (persona.apellidoMaterno ?? "").trim() || null,
      nombres: String(persona.nombres ?? "").trim(),
      id_tipo_documento: persona.tipoDocumento,
      documento,
      direccion: (persona.direccion ?? "").trim() || null,
      correo: email,
      celular: (persona.celular ?? "").trim() || null,
    });
    if (!creada.sie_code) {
      throw new DomainError("servicio-persona no devolvio el identificador (sie_code) de la persona", API_ERROR_CODES.INTERNAL, 502);
    }
    return { sieCode: creada.sie_code, creada: true };
  }

  /**
   * Ficha contractual local por RUC (contratos / facturacion / portal): reutiliza la
   * existente (solo agrega `sie_code` si falta) o la crea minima desde la fuente.
   * Para empresas no domiciliadas (sin RUC) no aplica.
   */
  private async asegurarFichaLocal(empresa: RegistrarEmpresaFuenteInput, sieCode: string, creadoPor: string | null): Promise<{ empresaId: string | null; ficha: EmpresaEntity | null }> {
    if (empresa.idTipoDocumento !== TIPOS_DOCUMENTO_EMPRESA.RUC) {
      return { empresaId: null, ficha: null };
    }
    const ruc = empresa.documento.replace(/\D/g, "");
    let ficha = await this.repo.findByRuc(ruc);
    if (ficha) {
      if (!ficha.sieCode) ficha = await this.repo.update(ficha.id, { sieCode });
      return { empresaId: ficha.id, ficha };
    }
    ficha = await this.repo.create({
      ruc,
      sieCode,
      razonSocial: empresa.nombre,
      logoUrl: empresa.linkLogo ?? null,
      nombreComercial: null,
      direccionFiscal: empresa.direccion,
      telefono: empresa.telefono,
      emailContacto: empresa.correo,
      emailFacturacion: null,
      representanteLegalNombre: null,
      representanteLegalDni: null,
      representanteCorreo: null,
      representanteCelular: null,
      representanteDireccion: null,
      partidaElectronica: null,
      tipoComprobante: TIPOS_COMPROBANTE.FACTURA,
      sitioWeb: null,
      creadoPor,
    });
    return { empresaId: ficha.id, ficha };
  }

  /**
   * Registra la relacion usuario (persona) - empresa: asegura empresa y persona en
   * servicio-persona (crea si no existen) y crea la cuenta local con sus
   * identificadores (sie_code / id_empresa). Si la empresa es RUC, mantiene la
   * ficha contractual local minima (contratos/facturacion) ligada por RUC.
   */
  async registrarCuentaEmpresa(input: RegistrarCuentaEmpresaInput): Promise<ResultadoRegistroEmpresa> {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!REGEX_EMAIL.test(email)) {
      throw new DomainError("Correo invalido", API_ERROR_CODES.VALIDATION, 400);
    }
    const empresa = this.validarEmpresaFuente(input.empresa);
    const errorPersona = validarDocumentoPersona(input.persona.tipoDocumento, input.persona.documento ?? "");
    if (errorPersona) {
      throw new DomainError(errorPersona, API_ERROR_CODES.VALIDATION, 400);
    }
    if (!String(input.persona.apellidoPaterno ?? "").trim() || !String(input.persona.nombres ?? "").trim()) {
      throw new DomainError("Apellido paterno y nombres del contacto son requeridos", API_ERROR_CODES.VALIDATION, 400);
    }

    if (await this.authRepo.existeEmail(email)) {
      throw new DomainError(`El correo ${email} ya tiene una cuenta habilitada`, API_ERROR_CODES.CONFLICT, 409);
    }

    const empresaFuente = await this.resolverEmpresaFuente(input.sieCodeEmpresa, empresa);
    const personaFuente = await this.resolverPersonaFuente(input.persona, email);

    const { empresaId, ficha } = await this.asegurarFichaLocal(empresa, empresaFuente.sieCode, limpiar(input.creadoPor));

    const rol = input.rolId
      ? await this.roleRepo.findById(input.rolId)
      : await this.roleRepo.findByNombre(ROLES.CLIENTE);
    if (!rol) {
      throw new DomainError(
        input.rolId ? "Rol no encontrado" : `No existe el rol ${ROLES.CLIENTE} en el sistema`,
        input.rolId ? API_ERROR_CODES.NOT_FOUND : API_ERROR_CODES.INTERNAL,
        input.rolId ? 404 : 500,
      );
    }

    const passwordTemporal = generarPasswordTemporal();
    await this.authRepo.crearUsuario({
      userId: `user|${email}`,
      email,
      password: hashPassword(passwordTemporal),
      /* Solo referencia: la persona y la empresa viven en servicio-persona. */
      nombre: "",
      apellidos: "",
      telefono: empresa.telefono,
      nombreEmpresa: empresa.nombre,
      roleId: rol.id,
      empresaId,
      idEmpresa: empresaFuente.sieCode,
      sieCode: personaFuente.sieCode,
      ruc: empresa.idTipoDocumento === TIPOS_DOCUMENTO_EMPRESA.RUC ? empresa.documento : null,
      debeCambiarPassword: true,
    });
    if (ficha && !ficha.cuentaCreada) {
      await this.repo.update(ficha.id, { cuentaCreada: true });
    }

    const emailEnviado = await this.enviarCredenciales(
      {
        razonSocial: empresa.nombre,
        representanteLegalNombre: [String(input.persona.nombres ?? "").trim(), String(input.persona.apellidoPaterno ?? "").trim()].filter(Boolean).join(" "),
      },
      email,
      passwordTemporal,
    );
    return {
      email,
      emailEnviado,
      sieCodeEmpresa: empresaFuente.sieCode,
      sieCodePersona: personaFuente.sieCode,
      empresaCreadaEnFuente: empresaFuente.creada,
      empresaActualizadaEnFuente: empresaFuente.actualizada,
      personaCreadaEnFuente: personaFuente.creada,
      empresaId,
    };
  }

  /**
   * Autorizacion (la decide la capa de aplicacion, no el controlador):
   * lectura de empresas (empresas:view).
   */
  autorizarLectura(userPermissions: string[]): void {
    if (!userPermissions.includes(PERMISSIONS.ADMIN_FULL) && !userPermissions.includes(PERMISSIONS.EMPRESAS_VIEW)) {
      throw new DomainError("Sin permiso para ver empresas", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  /** Autorizacion de gestion de empresas y cuentas (empresas:manage). */
  autorizarGestion(userPermissions: string[]): void {
    if (!userPermissions.includes(PERMISSIONS.ADMIN_FULL) && !userPermissions.includes(PERMISSIONS.EMPRESAS_MANAGE)) {
      throw new DomainError("Sin permiso para gestionar empresas", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  async obtener(id: string): Promise<EmpresaEntity> {
    const empresa = await this.repo.findById(id);
    if (!empresa) throw new DomainError("Empresa no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    return empresa;
  }

  /**
   * Alta de empresa (backoffice): valida y normaliza los datos contractuales.
   * Con `sincronizarFuente` (default) asegura la empresa y al representante en
   * servicio-persona; la carga masiva lo desactiva (se sincroniza despues 1x1).
   */
  async crear(input: EmpresaInput, creadoPor: string | null, opciones: { sincronizarFuente?: boolean } = {}): Promise<EmpresaEntity> {
    const sincronizarFuente = opciones.sincronizarFuente ?? true;
    const razonSocial = limpiar(input.razonSocial);
    if (!razonSocial || razonSocial.length < LARGO_MIN_RAZON_SOCIAL) {
      throw new DomainError("La razon social es obligatoria", API_ERROR_CODES.VALIDATION, 400);
    }
    const ruc = limpiar(input.ruc) ?? "";
    if (!REGEX_RUC.test(ruc)) {
      throw new DomainError("El RUC debe tener 11 digitos", API_ERROR_CODES.VALIDATION, 400);
    }
    validarEmails(input.emailContacto, input.emailFacturacion);
    const tipoComprobante = validarTipoComprobante(input.tipoComprobante);

    const existente = await this.repo.findByRuc(ruc);
    if (existente) {
      throw new DomainError(`Ya existe una empresa con el RUC ${ruc}`, API_ERROR_CODES.CONFLICT, 409);
    }

    /* Criterio: si el padron ya dio el codigo SIE se usa; si no, se asegura en la fuente. */
    const sieCode = limpiar(input.sieCode) ?? (sincronizarFuente ? await this.asegurarEmpresaEnFuenteBestEffort({
      nombre: razonSocial,
      idTipoDocumento: TIPOS_DOCUMENTO_EMPRESA.RUC,
      documento: ruc,
      direccion: limpiar(input.direccionFiscal) ?? "",
      correo: limpiar(input.emailContacto) ?? limpiar(input.emailFacturacion) ?? "",
      telefono: limpiar(input.telefono) ?? "",
      pais: UBIGEO_PAIS_PERU,
    }) : null);

    /* Misma logica para el representante legal: reutilizar/actualizar o crear en la fuente. */
    const dniRepresentante = limpiar(input.representanteLegalDni);
    if (sincronizarFuente && dniRepresentante && REGEX_DNI.test(dniRepresentante)) {
      await this.asegurarRepresentanteEnFuente(
        dniRepresentante,
        limpiar(input.representanteCorreo) ?? limpiar(input.emailContacto) ?? limpiar(input.emailFacturacion),
        limpiar(input.representanteCelular) ?? limpiar(input.telefono),
        limpiar(input.representanteDireccion) ?? limpiar(input.direccionFiscal),
        limpiar(input.representanteFotoUrl),
      );
    }

    const data: CrearEmpresaData = {
      ruc,
      sieCode,
      razonSocial,
      logoUrl: limpiar(input.logoUrl),
      nombreComercial: limpiar(input.nombreComercial),
      direccionFiscal: limpiar(input.direccionFiscal),
      telefono: limpiar(input.telefono),
      emailContacto: limpiar(input.emailContacto),
      emailFacturacion: limpiar(input.emailFacturacion),
      representanteLegalNombre: limpiar(input.representanteLegalNombre),
      representanteLegalDni: limpiar(input.representanteLegalDni),
      representanteCorreo: limpiar(input.representanteCorreo),
      representanteCelular: limpiar(input.representanteCelular),
      representanteDireccion: limpiar(input.representanteDireccion),
      partidaElectronica: limpiar(input.partidaElectronica),
      tipoComprobante,
      sitioWeb: limpiar(input.sitioWeb),
      creadoPor: limpiar(creadoPor),
    };
    const empresa = await this.repo.create(data);

    /*
     * Relacion usuario(representante) - empresa: MISMA logica que /dashboard/perfil
     * (user_role.id_empresa + nombre_empresa + FK local por RUC). Solo si el correo
     * del representante ya tiene una cuenta local; el resto de relaciones se crean
     * en los flujos de Usuarios / Registro desde servicio-persona.
     */
    const emailRepresentante = limpiar(input.representanteCorreo);
    if (sincronizarFuente && emailRepresentante) {
      const correo = emailRepresentante.toLowerCase();
      const cuentas = await this.authRepo.findByEmail(correo).catch(() => []);
      if (cuentas.length > 0) {
        await this.authRepo
          .updatePerfil(correo, { idEmpresa: sieCode, nombreEmpresa: razonSocial, empresaId: empresa.id })
          .catch(() => {});
      }
    }
    return empresa;
  }

  /** Edicion parcial: solo actualiza los campos enviados (undefined = sin cambio). */
  async actualizar(id: string, input: Partial<EmpresaInput>): Promise<EmpresaEntity> {
    const actual = await this.obtener(id);

    const cambios: Record<string, unknown> = {};

    if (input.razonSocial !== undefined) {
      const razonSocial = limpiar(input.razonSocial);
      if (!razonSocial || razonSocial.length < LARGO_MIN_RAZON_SOCIAL) {
        throw new DomainError("La razon social es obligatoria", API_ERROR_CODES.VALIDATION, 400);
      }
      cambios.razonSocial = razonSocial;
    }

    if (input.ruc !== undefined) {
      const ruc = limpiar(input.ruc) ?? "";
      if (!REGEX_RUC.test(ruc)) {
        throw new DomainError("El RUC debe tener 11 digitos", API_ERROR_CODES.VALIDATION, 400);
      }
      if (ruc !== actual.ruc) {
        const existente = await this.repo.findByRuc(ruc);
        if (existente && existente.id !== id) {
          throw new DomainError(`Ya existe una empresa con el RUC ${ruc}`, API_ERROR_CODES.CONFLICT, 409);
        }
      }
      cambios.ruc = ruc;
    }

    if (input.emailContacto !== undefined || input.emailFacturacion !== undefined) {
      validarEmails(
        input.emailContacto !== undefined ? input.emailContacto : actual.emailContacto,
        input.emailFacturacion !== undefined ? input.emailFacturacion : actual.emailFacturacion,
      );
      if (input.emailContacto !== undefined) cambios.emailContacto = limpiar(input.emailContacto);
      if (input.emailFacturacion !== undefined) cambios.emailFacturacion = limpiar(input.emailFacturacion);
    }

    if (input.tipoComprobante !== undefined) {
      cambios.tipoComprobante = validarTipoComprobante(input.tipoComprobante);
    }

    for (const campo of ["logoUrl", "nombreComercial", "direccionFiscal", "telefono", "representanteLegalNombre", "representanteLegalDni", "representanteCorreo", "representanteCelular", "representanteDireccion", "partidaElectronica", "sitioWeb"] as const) {
      if (input[campo] !== undefined) cambios[campo] = limpiar(input[campo]);
    }

    return this.repo.update(id, cambios);
  }

  /** Activa o desactiva la empresa (baja logica). */
  async cambiarEstado(id: string, estado: string): Promise<EmpresaEntity> {
    const valores = Object.values(ESTADOS_EMPRESA) as string[];
    if (!valores.includes(estado)) {
      throw new DomainError(`Estado invalido: ${estado}. Valores: ${valores.join(", ")}`, API_ERROR_CODES.VALIDATION, 400);
    }
    await this.obtener(id);
    return this.repo.update(id, { estado });
  }

  /** Marca que la cuenta del Portal fue creada y las credenciales enviadas. */
  async marcarCuentaCreada(id: string, cuentaCreada = true): Promise<EmpresaEntity> {
    await this.obtener(id);
    return this.repo.update(id, { cuentaCreada });
  }

  /** Primer login: la empresa valido/actualizo sus datos contractuales. */
  async marcarDatosValidados(id: string): Promise<EmpresaEntity> {
    await this.obtener(id);
    return this.repo.update(id, { primerAccesoCompletado: true, datosValidadosEn: new Date() });
  }

  /* ================================================================
     Portal del Cliente (primer ingreso de la empresa)
     ================================================================ */

  /** Empresa vinculada al usuario del Portal (null si el usuario no tiene empresa). */
  async obtenerDatosPortal(email: string): Promise<EmpresaEntity> {
    const estado = await this.authRepo.estadoEmpresaPortal(email).catch(() => null);
    if (!estado) {
      throw new DomainError("El usuario no tiene una empresa vinculada", API_ERROR_CODES.NOT_FOUND, 404);
    }
    return this.obtener(estado.empresaId);
  }

  /**
   * Valida/actualiza los datos contractuales de la empresa del usuario y marca el
   * primer acceso completado (el contrato usara estos datos).
   */
  async validarDatosPortal(email: string, input: EmpresaInput): Promise<EmpresaEntity> {
    const empresa = await this.obtenerDatosPortal(email);
    await this.actualizar(empresa.id, {
      ruc: input.ruc,
      razonSocial: input.razonSocial,
      nombreComercial: input.nombreComercial,
      direccionFiscal: input.direccionFiscal,
      telefono: input.telefono,
      emailFacturacion: input.emailFacturacion,
      representanteLegalNombre: input.representanteLegalNombre,
      representanteLegalDni: input.representanteLegalDni,
      tipoComprobante: input.tipoComprobante,
      sitioWeb: input.sitioWeb,
    });
    return this.repo.update(empresa.id, { primerAccesoCompletado: true, datosValidadosEn: new Date() });
  }

  /* ================================================================
     Carga masiva (Excel / CSV)
     ================================================================ */

  /**
   * Valida las filas del archivo (sin persistir): formato de RUC, correos,
   * comprobante, duplicados en el archivo y contra la BD, y datos contractuales
   * faltantes (advertencia). Devuelve la previsualizacion por fila.
   */
  async previsualizarCarga(filas: FilaCargaEmpresa[]): Promise<PrevisualizacionCargaEmpresas> {
    if (filas.length === 0) {
      throw new DomainError("El archivo no tiene filas con datos", API_ERROR_CODES.VALIDATION, 400);
    }
    if (filas.length > CARGA_MASIVA_MAX_FILAS) {
      throw new DomainError(`El archivo supera el maximo de ${CARGA_MASIVA_MAX_FILAS} filas`, API_ERROR_CODES.VALIDATION, 400);
    }

    const tiposValidos = Object.values(TIPOS_COMPROBANTE) as string[];
    const rucsVistos = new Map<string, number>();
    const validadas: FilaCargaValidada[] = [];

    for (const cruda of filas) {
      const fila = normalizarFilaCarga(cruda);
      const mensajes: string[] = [];
      let conError = false;
      let conAdvertencia = false;

      if (!fila.razonSocial) {
        mensajes.push("Razon social obligatoria");
        conError = true;
      }
      if (!REGEX_RUC.test(fila.ruc)) {
        mensajes.push("RUC invalido (debe tener 11 digitos)");
        conError = true;
      }
      if (fila.emailContacto && !REGEX_EMAIL.test(fila.emailContacto)) {
        mensajes.push("Correo de contacto invalido");
        conError = true;
      }
      if (fila.emailFacturacion && !REGEX_EMAIL.test(fila.emailFacturacion)) {
        mensajes.push("Correo de facturacion invalido");
        conError = true;
      }
      if (!tiposValidos.includes(fila.tipoComprobante)) {
        mensajes.push(`Tipo de comprobante invalido: ${cruda.tipoComprobante || "(vacio)"}`);
        conError = true;
      }

      if (REGEX_RUC.test(fila.ruc)) {
        const filaPrevia = rucsVistos.get(fila.ruc);
        if (filaPrevia) {
          mensajes.push(`Duplicado en el archivo (fila ${filaPrevia})`);
          conError = true;
        } else {
          rucsVistos.set(fila.ruc, fila.numero);
          const existente = await this.repo.findByRuc(fila.ruc);
          if (existente) {
            mensajes.push(`RUC ya registrado: ${existente.razonSocial}`);
            conError = true;
          }
        }
      }

      if (!conError) {
        const faltantes: string[] = [];
        if (!fila.direccionFiscal) faltantes.push("direccion fiscal");
        if (!fila.representanteLegalNombre) faltantes.push("representante legal");
        if (!fila.representanteLegalDni) faltantes.push("DNI del representante");
        if (faltantes.length > 0) {
          mensajes.push(`Faltan datos contractuales (${faltantes.join(", ")}): se completan en el primer acceso`);
          conAdvertencia = true;
        }
      }

      validadas.push({
        ...fila,
        estado: conError ? ESTADOS_FILA_CARGA.ERROR : conAdvertencia ? ESTADOS_FILA_CARGA.ADVERTENCIA : ESTADOS_FILA_CARGA.LISTA,
        mensajes,
      });
    }

    const resumen = {
      listas: validadas.filter((f) => f.estado === ESTADOS_FILA_CARGA.LISTA).length,
      advertencias: validadas.filter((f) => f.estado === ESTADOS_FILA_CARGA.ADVERTENCIA).length,
      errores: validadas.filter((f) => f.estado === ESTADOS_FILA_CARGA.ERROR).length,
    };
    return { filas: validadas, resumen };
  }

  /** Importa las filas validas (lista/advertencia); revalida por seguridad. */
  async importarCarga(filas: FilaCargaEmpresa[], creadoPor: string | null): Promise<ResultadoImportacionEmpresas> {
    const { filas: validadas } = await this.previsualizarCarga(filas);
    let creadas = 0;
    let omitidas = 0;

    for (const fila of validadas) {
      if (fila.estado === ESTADOS_FILA_CARGA.ERROR) {
        omitidas++;
        continue;
      }
      try {
        await this.crear(
          {
            ruc: fila.ruc,
            razonSocial: fila.razonSocial,
            nombreComercial: fila.nombreComercial || null,
            direccionFiscal: fila.direccionFiscal || null,
            telefono: fila.telefono || null,
            emailContacto: fila.emailContacto || null,
            emailFacturacion: fila.emailFacturacion || null,
            representanteLegalNombre: fila.representanteLegalNombre || null,
            representanteLegalDni: fila.representanteLegalDni || null,
            tipoComprobante: fila.tipoComprobante,
            sitioWeb: fila.sitioWeb || null,
          },
          creadoPor,
          /* Carga masiva: solo crea empresas; la fuente/representante se asigna luego 1x1. */
          { sincronizarFuente: false },
        );
        creadas++;
      } catch {
        omitidas++;
      }
    }
    return { creadas, omitidas };
  }
  /* ================================================================
     Cuenta del Portal del Cliente (credenciales)
     ================================================================ */

  /**
   * Crea la cuenta del Portal del Cliente (1 por empresa): usuario + contrasena
   * temporal, rol cliente y vinculo a la empresa. Envia las credenciales por correo
   * y exige el cambio de contrasena en el primer ingreso.
   */
  async crearCuenta(id: string, emailPortal?: string | null): Promise<ResultadoCredencialesEmpresa> {
    const empresa = await this.obtener(id);
    if (empresa.cuentaCreada) {
      throw new DomainError("La empresa ya tiene cuenta creada. Usa 'Reenviar credenciales'.", API_ERROR_CODES.CONFLICT, 409);
    }

    /* La cuenta es del representante legal: su correo manda sobre los de la empresa. */
    const emailOverride = limpiar(emailPortal)?.toLowerCase() ?? null;
    const email = (emailOverride ?? limpiar(empresa.representanteCorreo) ?? empresa.emailContacto ?? empresa.emailFacturacion ?? "").trim().toLowerCase();
    if (!email) {
      throw new DomainError("La empresa no tiene correo del representante ni de contacto/facturacion", API_ERROR_CODES.VALIDATION, 400);
    }
    if (emailOverride && !REGEX_EMAIL.test(emailOverride)) {
      throw new DomainError("Correo del representante invalido", API_ERROR_CODES.VALIDATION, 400);
    }
    if (await this.authRepo.existeEmail(email)) {
      throw new DomainError(`El correo ${email} ya tiene una cuenta habilitada`, API_ERROR_CODES.CONFLICT, 409);
    }
    /* Evita recrear cuentas: mismo RUC ya habilitado (rol cliente, 1 cuenta por empresa). */
    if (empresa.ruc && await this.authRepo.existeCuentaConRuc(empresa.ruc)) {
      throw new DomainError(`El RUC ${empresa.ruc} ya tiene una cuenta habilitada`, API_ERROR_CODES.CONFLICT, 409);
    }

    const rol = await this.roleRepo.findByNombre(ROLES.CLIENTE);
    if (!rol) {
      throw new DomainError(`No existe el rol ${ROLES.CLIENTE} en el sistema`, API_ERROR_CODES.INTERNAL, 500);
    }

    /*
     * La cuenta es del REPRESENTANTE LEGAL: se asegura en la fuente (sie_code) y se
     * vincula a la empresa con los mismos identificadores que usan Usuarios/perfil
     * (id_empresa SIE + FK local por RUC). Best-effort: sin fuente, la cuenta se crea igual.
     */
    let idEmpresa = empresa.sieCode;
    if (!idEmpresa) {
      idEmpresa = await this.asegurarEmpresaEnFuenteBestEffort({
        nombre: empresa.razonSocial,
        idTipoDocumento: TIPOS_DOCUMENTO_EMPRESA.RUC,
        documento: empresa.ruc,
        direccion: limpiar(empresa.direccionFiscal) ?? "",
        correo: limpiar(empresa.emailContacto) ?? limpiar(empresa.emailFacturacion) ?? "",
        telefono: limpiar(empresa.telefono) ?? "",
        pais: UBIGEO_PAIS_PERU,
      });
      if (idEmpresa) await this.repo.update(empresa.id, { sieCode: idEmpresa });
    }
    const dniRepresentante = limpiar(empresa.representanteLegalDni);
    const sieCode = dniRepresentante && REGEX_DNI.test(dniRepresentante)
      ? await this.asegurarRepresentanteEnFuente(
          dniRepresentante,
          email,
          limpiar(empresa.representanteCelular),
          null,
          null,
        )
      : null;

    const passwordTemporal = generarPasswordTemporal();
    await this.authRepo.crearUsuario({
      userId: `user|${email}`,
      email,
      password: hashPassword(passwordTemporal),
      nombre: empresa.representanteLegalNombre ?? empresa.razonSocial,
      apellidos: "",
      telefono: empresa.representanteCelular ?? empresa.telefono,
      nombreEmpresa: empresa.razonSocial,
      roleId: rol.id,
      empresaId: empresa.id,
      idEmpresa: idEmpresa ?? null,
      sieCode: sieCode ?? null,
      ruc: empresa.ruc,
      debeCambiarPassword: true,
    });

    const emailEnviado = await this.enviarCredenciales(empresa, email, passwordTemporal);
    await this.repo.update(id, {
      cuentaCreada: true,
      /* Si el correo del representante no estaba en la ficha, se guarda para futuros envios. */
      ...(!limpiar(empresa.representanteCorreo) && emailOverride ? { representanteCorreo: emailOverride } : {}),
    });
    return { email, emailEnviado };
  }

  /** Regenera la contrasena temporal y reenvia las credenciales por correo. */
  async reenviarCredenciales(id: string): Promise<ResultadoCredencialesEmpresa> {
    const empresa = await this.obtener(id);
    if (!empresa.cuentaCreada) {
      throw new DomainError("La empresa aun no tiene cuenta creada", API_ERROR_CODES.CONFLICT, 409);
    }

    const email = (limpiar(empresa.representanteCorreo) ?? empresa.emailContacto ?? empresa.emailFacturacion ?? "").trim().toLowerCase();
    if (!email) {
      throw new DomainError("La empresa no tiene correo del representante ni de contacto/facturacion", API_ERROR_CODES.VALIDATION, 400);
    }
    const usuarios = await this.authRepo.findByEmail(email);
    const principal = usuarios[0];
    if (!principal) {
      throw new DomainError(`No se encontro la cuenta ${email}`, API_ERROR_CODES.NOT_FOUND, 404);
    }

    const passwordTemporal = generarPasswordTemporal();
    await this.authRepo.updatePassword(principal.id, hashPassword(passwordTemporal));
    await this.authRepo.marcarCambioPasswordRequerido(email, true);
    await this.repo.update(id, { cuentaCreada: true, primerAccesoCompletado: false });

    const emailEnviado = await this.enviarCredenciales(empresa, email, passwordTemporal);
    return { email, emailEnviado };
  }

  /** Envio best-effort del correo con las credenciales (no revierte la cuenta). */
  private async enviarCredenciales(empresa: Pick<EmpresaEntity, "razonSocial" | "representanteLegalNombre">, email: string, passwordTemporal: string): Promise<boolean> {
    try {
      /* Nota: la empresa aun no tiene idioma propio; se envia en español (default). */
      return await enviarEmailPlantilla({
        to: email,
        plantilla: "credenciales-empresa",
        idioma: IDIOMA_DEFAULT,
        datos: {
          razonSocial: empresa.razonSocial,
          nombreContacto: empresa.representanteLegalNombre,
          email,
          passwordTemporal,
        },
      });
    } catch {
      return false;
    }
  }
}

/** Normaliza una fila cruda del archivo (RUC sin separadores, textos recortados). */
function normalizarFilaCarga(fila: FilaCargaEmpresa): FilaCargaEmpresa {
  const tipo = (fila.tipoComprobante ?? "").trim().toLowerCase() || TIPOS_COMPROBANTE.FACTURA;
  return {
    numero: fila.numero,
    ruc: (fila.ruc ?? "").replace(/\D/g, ""),
    razonSocial: (fila.razonSocial ?? "").trim(),
    nombreComercial: (fila.nombreComercial ?? "").trim(),
    direccionFiscal: (fila.direccionFiscal ?? "").trim(),
    telefono: (fila.telefono ?? "").trim(),
    emailContacto: (fila.emailContacto ?? "").trim(),
    emailFacturacion: (fila.emailFacturacion ?? "").trim(),
    representanteLegalNombre: (fila.representanteLegalNombre ?? "").trim(),
    representanteLegalDni: (fila.representanteLegalDni ?? "").trim(),
    tipoComprobante: tipo,
    sitioWeb: (fila.sitioWeb ?? "").trim(),
  };
}
