"use client";

import { useState, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { ROLES, ALL_PERMISSIONS } from "@/lib/constants";

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
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newRoleId, setNewRoleId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const allUsuarios = rows.flatMap((r) => r.usuarios.map((u) => ({ ...u, roleId: r.id, roleNombre: r.nombre })));

  const toggleExpand = (id: string) => setExpandedRole((p) => (p === id ? null : id));

  const togglePerm = async (roleId: string, perm: string) => {
    const role = rows.find((r) => r.id === roleId);
    if (!role) return;
    const next = role.permisos.includes(perm)
      ? role.permisos.filter((p) => p !== perm)
      : [...role.permisos, perm];
    setRows((prev) => prev.map((r) => (r.id === roleId ? { ...r, permisos: next } : r)));
    try {
      await fetch("/api/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: roleId, permisos: next }) });
    } catch {
      setRows((prev) => prev.map((r) => (r.id === roleId ? { ...r, permisos: role.permisos } : r)));
    }
  };

  const handleAddUser = async () => {
    if (!newEmail.trim() || !newRoleId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/roles/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), roleId: newRoleId }),
      });
      if (!res.ok) throw new Error("Error");
      const created = await res.json();
      const role = rows.find((r) => r.id === newRoleId);
      const newU: UsuarioRow = { id: created.id, userId: created.userId, email: created.email };
      setRows((prev) => prev.map((r) => (r.id === newRoleId ? { ...r, usuarios: [...r.usuarios, newU], count: r.count + 1 } : r)));
      setNewEmail("");
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
        prev.map((r) => (r.id === roleId ? { ...r, usuarios: r.usuarios.filter((u) => u.id !== userId), count: r.count - 1 } : r)),
      );
    } catch {
      // ignore
    }
  };

  return (
    <Tabs defaultValue="roles" className="space-y-4">
      <TabsList>
        <TabsTrigger value="roles"><span>Roles y Permisos</span></TabsTrigger>
        <TabsTrigger value="usuarios"><span>Usuarios ({allUsuarios.length})</span></TabsTrigger>
      </TabsList>

      {/* ===== TAB: ROLES ===== */}
      <TabsContent value="roles">
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="w-8 p-3"></th>
                <th className="p-3">Rol</th>
                <th className="p-3 hidden sm:table-cell">Descripcion</th>
                <th className="p-3">Permisos</th>
                <th className="p-3">Usuarios</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((role) => {
                const isOpen = expandedRole === role.id;
                return (
                  <Fragment key={role.id}>
                    <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => toggleExpand(role.id)}>
                      <td className="p-3 text-xs text-muted-foreground">{isOpen ? "▾" : "▸"}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">{role.nombre.charAt(0).toUpperCase()}</span>
                          <span className="font-medium capitalize">{role.nombre}</span>
                        </div>
                      </td>
                      <td className="p-3 hidden sm:table-cell"><span className="text-xs text-muted-foreground">{role.descripcion ?? "—"}</span></td>
                      <td className="p-3"><span className="text-xs text-muted-foreground">{role.permisos.length} de {ALL_PERMISSIONS.length}</span></td>
                      <td className="p-3"><Badge variant="secondary" className="text-[10px]"><span>{role.count}</span></Badge></td>
                    </tr>
                    {isOpen && (
                      <tr key={`${role.id}-p`}>
                        <td colSpan={5} className="border-b bg-slate-50/50 p-4">
                          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Permisos del rol</p>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_PERMISSIONS.map((perm) => {
                              const checked = role.permisos.includes(perm);
                              return (
                                <button
                                  key={perm}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); togglePerm(role.id, perm); }}
                                  className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${checked ? "border-primary/40 bg-primary/10 text-primary font-medium" : "border-slate-200 text-muted-foreground hover:border-slate-300"}`}
                                >
                                  {perm}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </TabsContent>

      {/* ===== TAB: USUARIOS ===== */}
      <TabsContent value="usuarios">
        <Card>
          <CardHeader>
            <CardTitle><span>Asignar rol</span></CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Input placeholder="email@empresa.pe" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="max-w-xs" />
            <Select value={newRoleId} onValueChange={setNewRoleId}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {rows.map((r) => (
                  <SelectItem key={r.id} value={r.id}><span className="capitalize">{r.nombre}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddUser} disabled={saving || !newEmail.trim() || !newRoleId}>
              <span>Asignar</span>
            </Button>
          </CardContent>
        </Card>

        {allUsuarios.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin usuarios asignados.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="p-3">Email</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3 w-20 text-right">Accion</th>
                </tr>
              </thead>
              <tbody>
                {allUsuarios.map((u) => (
                  <tr key={`${u.roleId}-${u.id}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{u.email}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]"><span className="capitalize">{u.roleNombre}</span></Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-700" onClick={() => handleRemoveUser(u.id, u.roleId)}>
                        <span>Quitar</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
