import { prisma } from "@/lib/server/db";
import type { ActualizarUsuarioPortalData, IUsuarioRepository, UsuarioPortalRow, VinculacionUsuario } from "@/domain/ports/usuario-repository";

/** Include comun para mapear la fila con rol y empresa local. */
const includeUsuario = {
  role: { select: { nombre: true } },
  empresa: { select: { razonSocial: true } },
} as const;

type FilaUsuario = {
  id: string;
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
  role: { nombre: string };
  empresa: { razonSocial: string } | null;
};

function aFila(r: FilaUsuario): UsuarioPortalRow {
  return {
    id: r.id,
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
  };
}

export class UsuarioPrismaRepository implements IUsuarioRepository {
  async listarUsuariosPortal(): Promise<UsuarioPortalRow[]> {
    /* Todos los usuarios: el front filtra por empresa (Portal / Sin empresa). */
    const rows = await prisma.userRole.findMany({
      include: includeUsuario,
      orderBy: [{ email: "asc" }],
    });
    return rows.map(aFila);
  }

  async findUsuarioPortalById(id: string): Promise<UsuarioPortalRow | null> {
    const row = await prisma.userRole.findUnique({ where: { id }, include: includeUsuario });
    return row ? aFila(row) : null;
  }

  async actualizarUsuarioPortal(id: string, data: ActualizarUsuarioPortalData): Promise<UsuarioPortalRow> {
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
}
