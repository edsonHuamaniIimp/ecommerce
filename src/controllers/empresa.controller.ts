import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, CARGA_MASIVA_EXTENSIONES, CARGA_MASIVA_MAX_BYTES } from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { getSession } from "@/lib/server/auth";
import { mapEmpresaToDTO, mapEmpresasPaginatedToDTO, mapEmpresaFuenteToDTO, mapPersonaFuenteToDTO } from "@/lib/shared/mappers/empresa";
import { ParserTablaError, parsearArchivoEmpresas } from "@/lib/server/parsers/tabla-empresas";
import {
  actualizarEmpresaSchema,
  buscarEmpresaFuenteSchema,
  buscarPersonaFuenteSchema,
  cambiarEstadoEmpresaSchema,
  crearCuentaEmpresaSchema,
  crearEmpresaSchema,
  idEmpresaSchema,
  importarCargaEmpresasSchema,
  registrarCuentaEmpresaSchema,
} from "@/validators/empresas.validator";
import { TIPOS_DOCUMENTO_PERSONA } from "@/lib/shared/constants";
import type { CrearEmpresaRequestDTO } from "@/types/dto/empresas";

const PER_PAGE_DEFAULT = 10;
const PER_PAGE_MAX = 100;

/**
 * Sesion requerida. El `DomainError` lo convierte `createRouter()` en la respuesta
 * HTTP correspondiente (el controlador no maneja try/catch ni permisos).
 */
async function sesionRequerida() {
  const session = await getSession();
  if (!session) throw new DomainError("No autorizado", API_ERROR_CODES.UNAUTHORIZED, 401);
  return session;
}

export const empresaController = {
  /** Bandeja paginada de empresas (busqueda por razon social o RUC). */
  async listar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarLectura(session.permissions);

    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
    const perPageRaw = Number(params.get("perPage") ?? PER_PAGE_DEFAULT) || PER_PAGE_DEFAULT;
    const perPage = Math.min(PER_PAGE_MAX, Math.max(1, perPageRaw));
    const search = params.get("search")?.trim() || undefined;
    const estado = params.get("estado")?.trim() || undefined;

    const resultado = await services.empresas.listar({ page, perPage, search, estado });
    return success(mapEmpresasPaginatedToDTO(resultado));
  },

  /** Detalle de una empresa. */
  async detalle(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarLectura(session.permissions);

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);

    const empresa = await services.empresas.obtener(id);
    return success(mapEmpresaToDTO(empresa));
  },

  /** Alta individual de empresa (backoffice). */
  async crear(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarGestion(session.permissions);

    const parsed = crearEmpresaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const body: CrearEmpresaRequestDTO = parsed.data;
    const empresa = await services.empresas.crear(body, session.email);
    return success(mapEmpresaToDTO(empresa));
  },

  /** Edicion parcial de empresa. */
  async actualizar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarGestion(session.permissions);

    const parsed = actualizarEmpresaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }
    const { id, ...cambios } = parsed.data;
    const empresa = await services.empresas.actualizar(id, cambios);
    return success(mapEmpresaToDTO(empresa));
  },

  /** Activa/desactiva una empresa (baja logica). */
  async estado(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarGestion(session.permissions);

    const parsed = cambiarEstadoEmpresaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const empresa = await services.empresas.cambiarEstado(parsed.data.id, parsed.data.estado);
    return success(mapEmpresaToDTO(empresa));
  },

  /** Carga masiva: parsea el archivo (Excel/CSV) y devuelve la validacion por fila. */
  async cargaMasivaPrevisualizar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarGestion(session.permissions);

    let archivo: File | null = null;
    try {
      const form = await request.formData();
      const valor = form.get("archivo");
      archivo = valor instanceof File ? valor : null;
    } catch {
      return error(API_ERROR_CODES.VALIDATION, "Adjunta el archivo en el campo 'archivo'", 400);
    }
    if (!archivo) return error(API_ERROR_CODES.VALIDATION, "Archivo requerido", 400);

    const extension = (archivo.name.split(".").pop() ?? "").toLowerCase();
    if (!(CARGA_MASIVA_EXTENSIONES as readonly string[]).includes(extension)) {
      return error(
        API_ERROR_CODES.VALIDATION,
        `Formato no permitido (.${extension || "?"}). Admitidos: ${CARGA_MASIVA_EXTENSIONES.join(", ")}.`,
        400,
      );
    }
    if (archivo.size > CARGA_MASIVA_MAX_BYTES) {
      return error(API_ERROR_CODES.VALIDATION, `El archivo supera el maximo de ${CARGA_MASIVA_MAX_BYTES / 1024 / 1024} MB`, 400);
    }

    try {
      const leidas = await parsearArchivoEmpresas(archivo.name, await archivo.arrayBuffer());
      const filas = leidas.map((f) => ({
        numero: f.numero,
        ruc: f.valores.ruc ?? "",
        razonSocial: f.valores.razonSocial ?? "",
        nombreComercial: f.valores.nombreComercial ?? "",
        direccionFiscal: f.valores.direccionFiscal ?? "",
        telefono: f.valores.telefono ?? "",
        emailContacto: f.valores.emailContacto ?? "",
        emailFacturacion: f.valores.emailFacturacion ?? "",
        representanteLegalNombre: f.valores.representanteLegalNombre ?? "",
        representanteLegalDni: f.valores.representanteLegalDni ?? "",
        tipoComprobante: f.valores.tipoComprobante ?? "",
        sitioWeb: f.valores.sitioWeb ?? "",
      }));
      const previsualizacion = await services.empresas.previsualizarCarga(filas);
      return success(previsualizacion);
    } catch (err) {
      if (err instanceof ParserTablaError) {
        return error(API_ERROR_CODES.VALIDATION, err.message, 400);
      }
      throw err;
    }
  },

  /** Carga masiva: importa las filas validas (omite las que tienen error). */
  async cargaMasivaImportar(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarGestion(session.permissions);

    const parsed = importarCargaEmpresasSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const resultado = await services.empresas.importarCarga(parsed.data.filas, session.email);
    return success(resultado);
  },

  /** Crea la cuenta del Portal del Cliente (credenciales por correo, cambio obligatorio). */
  async crearCuenta(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarGestion(session.permissions);

    const parsed = crearCuentaEmpresaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const resultado = await services.empresas.crearCuenta(parsed.data.id, parsed.data.email ?? null);
    return success(resultado);
  },

  /** Regenera la contrasena temporal y reenvia las credenciales. */
  async reenviarCredenciales(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarGestion(session.permissions);

    const parsed = idEmpresaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const resultado = await services.empresas.reenviarCredenciales(parsed.data.id);
    return success(resultado);
  },

  /** Busca empresas en servicio-persona (fuente) por razon social o RUC. */
  async buscarFuente(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarGestion(session.permissions);

    const parsed = buscarEmpresaFuenteSchema.safeParse({
      q: new URL(request.url).searchParams.get("q") ?? "",
    });
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const empresas = await services.empresas.buscarEmpresasFuente(parsed.data.q);
    return success(empresas.map(mapEmpresaFuenteToDTO));
  },

  /** Busca una persona en el padron interno (servicio-persona) por documento exacto. */
  async buscarPersonaFuente(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarGestion(session.permissions);

    const params = new URL(request.url).searchParams;
    const parsed = buscarPersonaFuenteSchema.safeParse({
      tipoDocumento: params.get("tipoDocumento") ?? TIPOS_DOCUMENTO_PERSONA.DNI,
      numeroDocumento: params.get("numeroDocumento") ?? "",
    });
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const persona = await services.empresas.buscarPersonaEnFuente(parsed.data.numeroDocumento, parsed.data.tipoDocumento);
    return success(persona ? mapPersonaFuenteToDTO(persona) : null);
  },

  /**
   * Registra la relacion usuario (persona) - empresa: asegura ambos en
   * servicio-persona (crea si no existen) y crea la cuenta local con sus
   * identificadores. La ficha contractual local por RUC se mantiene minima.
   */
  async registrarCuentaEmpresa(request: Request): Promise<NextResponse> {
    const session = await sesionRequerida();
    services.empresas.autorizarGestion(session.permissions);

    const parsed = registrarCuentaEmpresaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION, parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const resultado = await services.empresas.registrarCuentaEmpresa({
      ...parsed.data,
      creadoPor: session.email,
    });
    return success(resultado, { status: 201 });
  },
};
