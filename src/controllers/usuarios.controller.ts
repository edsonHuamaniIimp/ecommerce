import { NextResponse } from "next/server";
import { services } from "@/lib/server/services";
import { success, error } from "@/lib/server/api-response";
import { API_ERROR_CODES, PERMISSIONS } from "@/lib/shared/constants";
import { getSession } from "@/lib/server/auth";
import { crearUsuarioSchema, crearUsuariosLoteSchema, crearCuentaUsuarioSchema, actualizarUsuarioSchema, enviarAccesosUsuarioSchema } from "@/validators/usuarios.validator";

/** Solo admin (o rol con el permiso dedicado de usuarios) puede gestionar usuarios del portal. */
async function autorizarGestionUsuarios(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
  if (!session.permissions.includes(PERMISSIONS.USUARIOS_MANAGE) && !session.permissions.includes(PERMISSIONS.ADMIN_FULL)) {
    return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos para gestionar usuarios", 403);
  }
  return null;
}

export const usuariosController = {
  /** GET /api/usuarios/listar — usuarios del Portal del Cliente con su empresa. */
  async listar(): Promise<NextResponse> {
    const noAutorizado = await autorizarGestionUsuarios();
    if (noAutorizado) return noAutorizado;
    return success(await services.usuarios.listar());
  },

  /** POST /api/usuarios/crear — { email, tipoDocumento, ..., idEmpresa, nombreEmpresa, ruc?, rolId? }. */
  async crear(request: Request): Promise<NextResponse> {
    const noAutorizado = await autorizarGestionUsuarios();
    if (noAutorizado) return noAutorizado;
    const body = crearUsuarioSchema.parse(await request.json());
    const { idEmpresa, nombreEmpresa, ruc, ...input } = body;
    return success(await services.usuarios.crear({ idEmpresa, nombreEmpresa, ruc }, input), { status: 201 });
  },

  /** POST /api/usuarios/crear-lote — { idEmpresa, nombreEmpresa, ruc?, rolId?, usuarios: [...] }. */
  async crearLote(request: Request): Promise<NextResponse> {
    const noAutorizado = await autorizarGestionUsuarios();
    if (noAutorizado) return noAutorizado;
    const body = crearUsuariosLoteSchema.parse(await request.json());
    const { idEmpresa, nombreEmpresa, ruc, rolId, usuarios } = body;
    return success(await services.usuarios.crearLote({ idEmpresa, nombreEmpresa, ruc }, usuarios, rolId), { status: 201 });
  },

  /** GET /api/usuarios/personas?q= — busca personas en servicio-persona (fuente). */
  async buscarPersonas(request: Request): Promise<NextResponse> {
    const noAutorizado = await autorizarGestionUsuarios();
    if (noAutorizado) return noAutorizado;
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
    if (q.length < 3) {
      return error(API_ERROR_CODES.VALIDATION, "q requerido (minimo 3 caracteres)", 400);
    }
    return success(await services.usuarios.buscarPersonas(q));
  },

  /** POST /api/usuarios/crear-cuenta — { sieCode, email, idEmpresa, nombreEmpresa, ruc?, rolId? }. */
  async crearCuenta(request: Request): Promise<NextResponse> {
    const noAutorizado = await autorizarGestionUsuarios();
    if (noAutorizado) return noAutorizado;
    const body = crearCuentaUsuarioSchema.parse(await request.json());
    return success(await services.usuarios.crearCuentaDesdePersona(body), { status: 201 });
  },

  /** POST /api/usuarios/actualizar — { id, idEmpresa, nombreEmpresa, ruc? }. */
  async actualizar(request: Request): Promise<NextResponse> {
    const noAutorizado = await autorizarGestionUsuarios();
    if (noAutorizado) return noAutorizado;
    const body = actualizarUsuarioSchema.parse(await request.json());
    const { id, idEmpresa, nombreEmpresa, ruc } = body;
    return success(await services.usuarios.actualizar(id, { idEmpresa, nombreEmpresa, ruc }));
  },

  /** POST /api/usuarios/enviar-accesos — { id }: regenera la credencial y la envia por correo. */
  async enviarAccesos(request: Request): Promise<NextResponse> {
    const noAutorizado = await autorizarGestionUsuarios();
    if (noAutorizado) return noAutorizado;
    const body = enviarAccesosUsuarioSchema.parse(await request.json());
    return success(await services.usuarios.enviarAccesos(body.id));
  },
};
