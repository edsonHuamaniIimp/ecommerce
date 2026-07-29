import { RolesMantenedor } from "@/components/admin/roles-mantenedor";
import { prisma } from "@/lib/db";
import type { Rol } from "@/lib/constants";

type RoleWithUsuarios = { id: string; nombre: string; descripcion: string | null; permisos: string[]; usuarios: { id: string; userId: string; email: string }[] };

interface RoleRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  usuarios: { id: string; userId: string; email: string }[];
  count: number;
}

export default async function RolesMantenedorPage() {
  try {
    const roles = await prisma.role.findMany({
      include: { usuarios: { select: { id: true, userId: true, email: true } } },
      orderBy: { nombre: "asc" },
    }) as RoleWithUsuarios[];

    const rows: RoleRow[] = roles.map((r) => ({
      id: r.id,
      nombre: r.nombre as Rol,
      descripcion: r.descripcion,
      permisos: r.permisos,
      usuarios: r.usuarios.map((u) => ({ id: u.id, userId: u.userId, email: u.email })),
      count: r.usuarios.length,
    }));

    return (
      <main className="flex-1 px-6 py-6 lg:px-10">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Mantenedor de Roles
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestion de roles y permisos del sistema.
            </p>
          </div>
          <RolesMantenedor initialRows={rows} />
        </div>
      </main>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return (
      <main className="flex-1 px-6 py-6 lg:px-10">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">Mantenedor de Roles</h1>
          <p className="text-sm text-red-600">Error al cargar roles: {message}</p>
        </div>
      </main>
    );
  }
}
