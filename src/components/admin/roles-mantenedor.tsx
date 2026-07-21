"use client";

import { useState, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Checkbox } from "@nrivera-iimp/ui-kit-iimp";
import { ALL_PERMISSIONS } from "@/lib/constants";

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
    const next = role.permisos.includes(perm) ? role.permisos.filter((p) => p !== perm) : [...role.permisos, perm];
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

      {/* ===== ROLES ===== */}
      <TabsContent value="roles">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead><span>Rol</span></TableHead>
                <TableHead className="hidden sm:table-cell"><span>Descripcion</span></TableHead>
                <TableHead><span>Permisos</span></TableHead>
                <TableHead><span>Usuarios</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((role) => {
                const isOpen = expandedRole === role.id;
                return (
                  <Fragment key={role.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggleExpand(role.id)}>
                      <TableCell className="text-xs text-muted-foreground">{isOpen ? "▾" : "▸"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
                            {role.nombre.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium capitalize">{role.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell"><span className="text-xs text-muted-foreground">{role.descripcion ?? "—"}</span></TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{role.permisos.length} de {ALL_PERMISSIONS.length}</span></TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]"><span>{role.count}</span></Badge></TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30">
                          <div className="flex flex-wrap gap-1.5 py-1">
                            {ALL_PERMISSIONS.map((perm) => {
                              const checked = role.permisos.includes(perm.key);
                              return (
                                <label
                                  key={perm.key}
                                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                                    checked ? "border-primary/40 bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/30"
                                  }`}
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => togglePerm(role.id, perm.key)}
                                    className="h-3 w-3"
                                  />
                                  <span>{perm.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* ===== USUARIOS ===== */}
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
          <p className="py-8 text-center text-sm text-muted-foreground"><span>Sin usuarios asignados.</span></p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><span>Email</span></TableHead>
                  <TableHead><span>Rol</span></TableHead>
                  <TableHead className="w-20 text-right"><span>Accion</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsuarios.map((u) => (
                  <TableRow key={`${u.roleId}-${u.id}`}>
                    <TableCell className="font-mono text-xs">{u.email}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]"><span className="capitalize">{u.roleNombre}</span></Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleRemoveUser(u.id, u.roleId)}>
                        <span>Quitar</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
