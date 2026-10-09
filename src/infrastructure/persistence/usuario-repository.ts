import { prisma } from "@/lib/server/db";
import { FILTROS_USUARIO_EMPRESA } from "@/lib/shared/constants";
import type { ActualizarUsuarioPortalData, IUsuarioRepository, UsuarioPortalRow, UsuariosPaginatedResult, UsuariosPaginationParams, VinculacionUsuario } from "@/domain/ports/usuario-repository";

/** Include comun para mapear la fila con rol y empresa local. */
const includeUsuario = {
  role: { select: { nombre: true } },
  empresa: { select: { razonSocial: true } },
} as const;

type FilaUsuario = {
  id: string;
  userId: string;
  email: string;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
  ruc: string | null;
  empresaId: string | null;
  idEmpresa: string | null;
  nombreEmpresa: string | null;
  sieCode: string | null;
  debeCambiarPassword: boolean;
  flgActivo: boolean;
  role: { nombre: string };
  empresa: { razonSocial: string } | null;
};

function aFila(r: FilaUsuario): UsuarioPortalRow {
  return {
    id: r.id,
    userId: r.userId,
    email: r.email,
    nombre: r.nombre,
    apellidos: r.apellidos,
    telefono: r.telefono,
    ruc: r.ruc,
    rol: r.role.nombre,
    empresaId: r.empresaId,
    idEmpresa: r.idEmpresa,
    /* Prioriza la empresa local (FK) y cae al nombre guardado al vincular por la API. */
    empresa: r.empresa?.razonSocial ?? r.nombreEmpresa ?? null,
    esPortal: Boolean(r.empresaId || r.idEmpresa),
    sieCode: r.sieCode,
    debeCambiarPassword: r.debeCambiarPassword,
    flgActivo: r.flgActivo,
  };
}

export class UsuarioPrismaRepository implements IUsuarioRepository {
  async listarUsuariosPortal(params: UsuariosPaginationParams): Promise<UsuariosPaginatedResult> {
    const condiciones: Record<string, unknown>[] = [];

    const search = params.search?.trim();
    if (search) {
      condiciones.push({
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { nombre: { contains: search, mode: "insensitive" } },
          { apellidos: { contains: search, mode: "insensitive" } },
          { nombreEmpresa: { contains: search, mode: "insensitive" } },
          { sieCode: { contains: search, mode: "insensitive" } },
          { idEmpresa: { contains: search, mode: "insensitive" } },
          { role: { nombre: { contains: search, mode: "insensitive" } } },
          { empresa: { razonSocial: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    if (params.filtro === FILTROS_USUARIO_EMPRESA.PORTAL) {
      condiciones.push({ OR: [{ empresaId: { not: null } }, { idEmpresa: { not: null } }] });
    } else if (params.filtro === FILTROS_USUARIO_EMPRESA.SIN_EMPRESA) {
      condiciones.push({ empresaId: null, idEmpresa: null });
    }

    const where: Record<string, unknown> = condiciones.length > 0 ? { AND: condiciones } : {};

    const [rows, total] = await Promise.all([
      prisma.userRole.findMany({
        where: where as never,
        include: includeUsuario,
        orderBy: [{ email: "asc" }],
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      prisma.userRole.count({ where: where as never }),
    ]);

    return {
      data: rows.map(aFila),
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.max(1, Math.ceil(total / params.perPage)),
    };
  }

  async findUsuarioPortalById(id: string): Promise<UsuarioPortalRow | null> {
    const row = await prisma.userRole.findUnique({ where: { id }, include: includeUsuario });
    return row ? aFila(row) : null;
  }

  async actualizarUsuarioPortal(id: string, data: ActualizarUsuarioPortalData): Promise<UsuarioPortalRow> {
    const actual = await prisma.userRole.findUnique({ where: { id }, select: { userId: true } });
    if (!actual) throw new Error("Usuario no encontrado");

    /*
     * Correo y estado pertenecen a la cuenta completa (no a una fila de rol):
     * se propagan a todas las filas con el mismo userId. El userId se reescribe
     * como `user|<email>` para que la sesion (sub del JWT) siga resolviendo.
     */
    if (data.email !== undefined || data.flgActivo !== undefined) {
      await prisma.userRole.updateMany({
        where: { userId: actual.userId },
        data: {
          ...(data.email !== undefined ? { email: data.email, userId: `user|${data.email}` } : {}),
          ...(data.flgActivo !== undefined ? { flgActivo: data.flgActivo } : {}),
        },
      });
    }

    const row = await prisma.userRole.update({
      where: { id },
      data: {
        ...(data.empresaId !== undefined ? { empresaId: data.empresaId } : {}),
        ...(data.idEmpresa !== undefined ? { idEmpresa: data.idEmpresa } : {}),
        ...(data.nombreEmpresa !== undefined ? { nombreEmpresa: data.nombreEmpresa } : {}),
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.apellidos !== undefined ? { apellidos: data.apellidos } : {}),
        ...(data.telefono !== undefined ? { telefono: data.telefono } : {}),
      },
      include: includeUsuario,
    });
    return aFila(row);
  }

  async actualizarPasswordUsuarioPortal(id: string, passwordHash: string, debeCambiarPassword: boolean): Promise<void> {
    await prisma.userRole.update({ where: { id }, data: { password: passwordHash, debeCambiarPassword } });
  }

  async findVinculacionPorEmail(email: string): Promise<VinculacionUsuario | null> {
    const row = await prisma.userRole.findFirst({
      where: { email },
      select: { sieCode: true, idEmpresa: true },
    });
    return row ? { sieCode: row.sieCode, idEmpresa: row.idEmpresa } : null;
  }

  async existeEmailEnOtraCuenta(email: string, userId: string): Promise<boolean> {
    const total = await prisma.userRole.count({ where: { email, NOT: { userId } } });
    return total > 0;
  }
}
