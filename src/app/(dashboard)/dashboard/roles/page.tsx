"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { RolesMantenedor } from "@/components/admin/roles-mantenedor";
import { SolicitudesCuentaBandeja } from "@/components/admin/solicitudes-cuenta-bandeja";
import { rolesService } from "@/lib/client/api/services/roles-service";
import { solicitudCuentaService } from "@/lib/client/api/services/solicitud-cuenta-service";
import type { Rol } from "@/lib/shared/constants";
import type { SolicitudCuentaDTO } from "@/types/dto/solicitud-cuenta/solicitud-cuenta.dto";

interface RoleRow {
  id: string;
  nombre: Rol;
  descripcion: string | null;
  permisos: string[];
  usuarios: { id: string; userId: string; email: string }[];
  count: number;
}

export default function RolesMantenedorPage() {
  const [rows, setRows] = useState<RoleRow[] | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudCuentaDTO[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [roles, solicitudesCuenta] = await Promise.all([
          rolesService.list(),
          solicitudCuentaService.listar(),
        ]);
        setRows(roles.map((r) => ({ ...r, nombre: r.nombre as Rol })));
        setSolicitudes(solicitudesCuenta.solicitudes);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Error desconocido");
        setRows([]);
      }
    })();
  }, []);

  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mantenedor de Roles</h1>
          <p className="text-sm text-muted-foreground">Gestion de roles y permisos del sistema.</p>
        </div>

        {errorMessage ? (
          <p className="text-sm text-destructive">Error al cargar roles: {errorMessage}</p>
        ) : rows === null ? (
          <>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </>
        ) : (
          <>
            <SolicitudesCuentaBandeja initialSolicitudes={solicitudes} />
            <RolesMantenedor initialRows={rows} />
          </>
        )}
      </div>
    </main>
  );
}
