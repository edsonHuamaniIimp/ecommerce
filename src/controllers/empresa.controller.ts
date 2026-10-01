import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, CARGA_MASIVA_EXTENSIONES, CARGA_MASIVA_MAX_BYTES, PERMISSIONS } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { mapEmpresaToDTO, mapEmpresasPaginatedToDTO } from "@/lib/shared/mappers/empresa";
import { ParserTablaError, parsearArchivoEmpresas } from "@/lib/server/parsers/tabla-empresas";
import type {
  ActualizarEmpresaRequestDTO,
  CambiarEstadoEmpresaRequestDTO,
  CrearEmpresaRequestDTO,
} from "@/types/dto/empresas/empresa-request.dto";
import type { ImportarCargaEmpresasRequestDTO } from "@/types/dto/empresas/carga-masiva.dto";

const PER_PAGE_DEFAULT = 10;
const PER_PAGE_MAX = 100;

/** Sesion + permiso (admin:full implica todos los permisos). */
async function autorizar(permiso: string) {
  const session = await getSession();
  if (!session) return { session: null, ok: false as const };
  const ok =
    session.permissions.includes(PERMISSIONS.ADMIN_FULL) ||
    session.permissions.includes(permiso);
  return { session, ok };
}

export const empresaController = {
  /** Bandeja paginada de empresas (busqueda por razon social o RUC). */
  async listar(request: Request): Promise<NextResponse> {
    const { session, ok } = await autorizar(PERMISSIONS.EMPRESAS_VIEW);
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!ok) return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para ver empresas", 403);

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
    const { session, ok } = await autorizar(PERMISSIONS.EMPRESAS_VIEW);
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!ok) return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para ver empresas", 403);

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);

    const empresa = await services.empresas.obtener(id);
    return success(mapEmpresaToDTO(empresa));
  },

  /** Alta individual de empresa (backoffice). */
  async crear(request: Request): Promise<NextResponse> {
    const { session, ok } = await autorizar(PERMISSIONS.EMPRESAS_MANAGE);
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!ok) return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para registrar empresas", 403);

    const body = (await request.json()) as CrearEmpresaRequestDTO;
    const empresa = await services.empresas.crear(body, session.email);
    return success(mapEmpresaToDTO(empresa));
  },

  /** Edicion parcial de empresa. */
  async actualizar(request: Request): Promise<NextResponse> {
    const { session, ok } = await autorizar(PERMISSIONS.EMPRESAS_MANAGE);
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!ok) return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para editar empresas", 403);

    const body = (await request.json()) as ActualizarEmpresaRequestDTO;
    if (!body?.id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);

    const { id, ...cambios } = body;
    const empresa = await services.empresas.actualizar(id, cambios);
    return success(mapEmpresaToDTO(empresa));
  },

  /** Activa/desactiva una empresa (baja logica). */
  async estado(request: Request): Promise<NextResponse> {
    const { session, ok } = await autorizar(PERMISSIONS.EMPRESAS_MANAGE);
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!ok) return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para cambiar el estado", 403);

    const body = (await request.json()) as CambiarEstadoEmpresaRequestDTO;
    if (!body?.id || !body?.estado) {
      return error(API_ERROR_CODES.VALIDATION, "id y estado requeridos", 400);
    }

    const empresa = await services.empresas.cambiarEstado(body.id, body.estado);
    return success(mapEmpresaToDTO(empresa));
  },

  /** Carga masiva: parsea el archivo (Excel/CSV) y devuelve la validacion por fila. */
  async cargaMasivaPrevisualizar(request: Request): Promise<NextResponse> {
    const { session, ok } = await autorizar(PERMISSIONS.EMPRESAS_MANAGE);
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!ok) return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para registrar empresas", 403);

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
    const { session, ok } = await autorizar(PERMISSIONS.EMPRESAS_MANAGE);
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!ok) return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para registrar empresas", 403);

    const body = (await request.json()) as ImportarCargaEmpresasRequestDTO;
    if (!Array.isArray(body?.filas) || body.filas.length === 0) {
      return error(API_ERROR_CODES.VALIDATION, "filas requeridas", 400);
    }

    const resultado = await services.empresas.importarCarga(body.filas, session.email);
    return success(resultado);
  },

  /** Crea la cuenta del Portal del Cliente (credenciales por correo, cambio obligatorio). */
  async crearCuenta(request: Request): Promise<NextResponse> {
    const { session, ok } = await autorizar(PERMISSIONS.EMPRESAS_MANAGE);
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!ok) return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para gestionar cuentas", 403);

    const body = (await request.json()) as { id?: string };
    if (!body?.id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);

    const resultado = await services.empresas.crearCuenta(body.id);
    return success(resultado);
  },

  /** Regenera la contrasena temporal y reenvia las credenciales. */
  async reenviarCredenciales(request: Request): Promise<NextResponse> {
    const { session, ok } = await autorizar(PERMISSIONS.EMPRESAS_MANAGE);
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!ok) return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para gestionar cuentas", 403);

    const body = (await request.json()) as { id?: string };
    if (!body?.id) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);

    const resultado = await services.empresas.reenviarCredenciales(body.id);
    return success(resultado);
  },
};
