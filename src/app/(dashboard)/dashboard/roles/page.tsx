import { RolesMantenedor } from "@/components/admin/roles-mantenedor";
import { prisma } from "@/lib/server/db";
import type { Rol } from "@/lib/shared/constants";

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
  let rows: RoleRow[] = [];
  let errorMessage: string | null = null;

  try {
    const roles = await prisma.role.findMany({
      include: { usuarios: { select: { id: true, userId: true, email: true } } },
      orderBy: { nombre: "asc" },
    }) as RoleWithUsuarios[];

    rows = roles.map((r) => ({
      id: r.id,
      nombre: r.nombre as Rol,
      descripcion: r.descripcion,
      permisos: r.permisos,
      usuarios: r.usuarios.map((u) => ({ id: u.id, userId: u.userId, email: u.email })),
      count: r.usuarios.length,
    }));
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Error desconocido";
  }

  if (errorMessage) {
    return (
      <main className="flex-1 py-6">
        <div className="mx-auto w-full max-w-7xl space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">Mantenedor de Roles</h1>
          <p className="text-sm text-red-600">Error al cargar roles: {errorMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
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
}
