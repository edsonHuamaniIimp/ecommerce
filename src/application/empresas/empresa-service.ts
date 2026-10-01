import { API_ERROR_CODES, CARGA_MASIVA_MAX_FILAS, ESTADOS_EMPRESA, ESTADOS_FILA_CARGA, IDIOMA_DEFAULT, PERMISSIONS, REGEX_EMAIL, REGEX_RUC, ROLES, TIPOS_COMPROBANTE } from "@/lib/shared/constants";
import type { TipoComprobante } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { hashPassword, generarPasswordTemporal } from "@/lib/server/utils/password";
import { enviarEmailPlantilla } from "@/lib/server/email";
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
  ) {}

  async listar(params: EmpresasListParams): Promise<EmpresasPaginatedResult> {
    return this.repo.listarPaginated(params);
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

  /** Alta de empresa (backoffice): valida y normaliza los datos contractuales. */
  async crear(input: EmpresaInput, creadoPor: string | null): Promise<EmpresaEntity> {
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

    const data: CrearEmpresaData = {
      ruc,
      razonSocial,
      nombreComercial: limpiar(input.nombreComercial),
      direccionFiscal: limpiar(input.direccionFiscal),
      telefono: limpiar(input.telefono),
      emailContacto: limpiar(input.emailContacto),
      emailFacturacion: limpiar(input.emailFacturacion),
      representanteLegalNombre: limpiar(input.representanteLegalNombre),
      representanteLegalDni: limpiar(input.representanteLegalDni),
      tipoComprobante,
      sitioWeb: limpiar(input.sitioWeb),
      creadoPor: limpiar(creadoPor),
    };
    return this.repo.create(data);
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

    for (const campo of ["nombreComercial", "direccionFiscal", "telefono", "representanteLegalNombre", "representanteLegalDni", "sitioWeb"] as const) {
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
  async crearCuenta(id: string): Promise<ResultadoCredencialesEmpresa> {
    const empresa = await this.obtener(id);
    if (empresa.cuentaCreada) {
      throw new DomainError("La empresa ya tiene cuenta creada. Usa 'Reenviar credenciales'.", API_ERROR_CODES.CONFLICT, 409);
    }

    const email = (empresa.emailContacto ?? empresa.emailFacturacion ?? "").trim().toLowerCase();
    if (!email) {
      throw new DomainError("La empresa no tiene correo de contacto ni de facturacion", API_ERROR_CODES.VALIDATION, 400);
    }
    if (await this.authRepo.existeEmail(email)) {
      throw new DomainError(`El correo ${email} ya tiene una cuenta habilitada`, API_ERROR_CODES.CONFLICT, 409);
    }

    const rol = await this.roleRepo.findByNombre(ROLES.CLIENTE);
    if (!rol) {
      throw new DomainError(`No existe el rol ${ROLES.CLIENTE} en el sistema`, API_ERROR_CODES.INTERNAL, 500);
    }

    const passwordTemporal = generarPasswordTemporal();
    await this.authRepo.crearUsuario({
      userId: `user|${email}`,
      email,
      password: hashPassword(passwordTemporal),
      nombre: empresa.representanteLegalNombre ?? empresa.razonSocial,
      apellidos: "",
      telefono: empresa.telefono,
      nombreEmpresa: empresa.razonSocial,
      roleId: rol.id,
      empresaId: empresa.id,
      debeCambiarPassword: true,
    });

    const emailEnviado = await this.enviarCredenciales(empresa, email, passwordTemporal);
    await this.repo.update(id, { cuentaCreada: true });
    return { email, emailEnviado };
  }

  /** Regenera la contrasena temporal y reenvia las credenciales por correo. */
  async reenviarCredenciales(id: string): Promise<ResultadoCredencialesEmpresa> {
    const empresa = await this.obtener(id);
    if (!empresa.cuentaCreada) {
      throw new DomainError("La empresa aun no tiene cuenta creada", API_ERROR_CODES.CONFLICT, 409);
    }

    const email = (empresa.emailContacto ?? empresa.emailFacturacion ?? "").trim().toLowerCase();
    if (!email) {
      throw new DomainError("La empresa no tiene correo de contacto ni de facturacion", API_ERROR_CODES.VALIDATION, 400);
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
  private async enviarCredenciales(empresa: EmpresaEntity, email: string, passwordTemporal: string): Promise<boolean> {
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
