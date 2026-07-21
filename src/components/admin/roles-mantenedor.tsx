"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { ROLES, ROLES_PERMISSIONS } from "@/lib/constants";
import type { Rol } from "@/lib/constants";

interface UsuarioRow {
  id: string;
  userId: string;
  email: string;
}

interface RoleRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  usuarios: UsuarioRow[];
  count: number;
}

export function RolesMantenedor({ initialRows }: { initialRows: RoleRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>(ROLES.ADMIN);
  const [saving, setSaving] = useState(false);

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/roles/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newUserEmail.trim(), roleId: newUserRole }),
      });
      if (!res.ok) throw new Error("Error");
      const updated = await res.json();
      setRows((prev) =>
        prev.map((r) => (r.id === newUserRole ? { ...r, usuarios: [...r.usuarios, updated], count: r.count + 1 } : r)),
      );
      setNewUserEmail("");
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUser = async (userId: string, roleId: string) => {
    try {
      const res = await fetch(`/api/roles/usuarios?userId=${encodeURIComponent(userId)}&roleId=${encodeURIComponent(roleId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      setRows((prev) =>
        prev.map((r) =>
          r.id === roleId
            ? { ...r, usuarios: r.usuarios.filter((u) => u.id !== userId), count: r.count - 1 }
            : r,
        ),
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle><span>Asignar rol a usuario</span></CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input
            placeholder="email@empresa.pe"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            className="max-w-xs"
          />
          <Select value={newUserRole} onValueChange={setNewUserRole}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ROLES).map((r) => (
                <SelectItem key={r} value={rows.find((row) => row.nombre === r)?.id ?? r}>
                  <span>{r}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddUser} disabled={saving || !newUserEmail.trim()}>
            <span>Asignar</span>
          </Button>
        </CardContent>
      </Card>

      {rows.map((role) => (
        <Card key={role.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                <span className="capitalize">{role.nombre}</span>
              </CardTitle>
              <Badge variant="secondary"><span>{role.count} usuarios</span></Badge>
            </div>
            <p className="text-xs text-muted-foreground">{role.descripcion ?? "Sin descripcion"}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Permisos</p>
              <div className="flex flex-wrap gap-1">
                {role.permisos.map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px]"><span>{p}</span></Badge>
                ))}
              </div>
            </div>
            {role.usuarios.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Usuarios asignados</p>
                <div className="space-y-1">
                  {role.usuarios.map((u) => (
                    <div key={u.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">{u.email}</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-red-500 hover:text-red-700" onClick={() => handleRemoveUser(u.id, role.id)}>
                        <span>Quitar</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
