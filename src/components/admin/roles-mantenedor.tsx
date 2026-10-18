"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Pagination } from "@/components/shared/pagination";
import {
  ALL_PERMISSIONS,
  PERMISSION_SECTION_LABELS,
  ROLES_USUARIOS_PER_PAGE_DEFAULT,
} from "@/lib/shared/constants";
import { rolesService, type RoleUserData } from "@/lib/client/api/services/roles-service";

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
  modulos: string[];
  usuarios: UsuarioRow[];
  count: number;
}

const MODULOS = Object.entries(PERMISSION_SECTION_LABELS).map(([key, label]) => ({ key, label }));
const USUARIOS_PER_PAGE = [10, 25, 50];
const SECCION_POR_PERMISO = new Map<string, string>(
  ALL_PERMISSIONS.map((permiso) => [permiso.key, permiso.section]),
);

export function RolesMantenedor({ initialRows }: { initialRows: RoleRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newRoleId, setNewRoleId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("todos");
  const [userPage, setUserPage] = useState(1);
  const [userPerPage, setUserPerPage] = useState(ROLES_USUARIOS_PER_PAGE_DEFAULT);
  const [usuarios, setUsuarios] = useState<RoleUserData[]>([]);
  const [usuariosTotal, setUsuariosTotal] = useState(() =>
    initialRows.reduce((total, role) => total + role.count, 0),
  );
  const [usuariosTotalPages, setUsuariosTotalPages] = useState(0);
  const [usuariosLoading, setUsuariosLoading] = useState(true);
  const [userRefresh, setUserRefresh] = useState(0);

  useEffect(() => {
    let activo = true;
    const timer = setTimeout(() => {
      rolesService
        .listarUsuarios({
          page: userPage,
          perPage: userPerPage,
          search: userSearch.trim() || undefined,
          roleId: userRoleFilter === "todos" ? undefined : userRoleFilter,
        })
        .then((resultado) => {
          if (!activo) return;
          setUsuarios(resultado.data);
          setUsuariosTotal(resultado.total);
          setUsuariosTotalPages(resultado.totalPages);
        })
        .catch(() => {
          if (!activo) return;
          setUsuarios([]);
          setUsuariosTotal(0);
          setUsuariosTotalPages(0);
        })
        .finally(() => {
          if (activo) setUsuariosLoading(false);
        });
    }, 250);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [userPage, userPerPage, userSearch, userRoleFilter, userRefresh]);

  const permissionSections = useMemo(() => {
    const sections: Record<string, { key: string; label: string; descripcion: string }[]> = {};
    for (const perm of ALL_PERMISSIONS) {
      const section = perm.section ?? "general";
      (sections[section] ??= []).push({
        key: perm.key,
        label: perm.label,
        descripcion: perm.descripcion,
      });
    }
    return sections;
  }, []);

  const toggleExpand = (id: string) => setExpandedRole((p) => (p === id ? null : id));

  const togglePerm = async (roleId: string, perm: string) => {
    const role = rows.find((r) => r.id === roleId);
    if (!role) return;
    const next = role.permisos.includes(perm)
      ? role.permisos.filter((p) => p !== perm)
      : [...role.permisos, perm];
    setRows((prev) => prev.map((r) => (r.id === roleId ? { ...r, permisos: next } : r)));
    try {
      await rolesService.updatePermisos(roleId, next);
    } catch {
      setRows((prev) => prev.map((r) => (r.id === roleId ? { ...r, permisos: role.permisos } : r)));
    }
  };

  const toggleModulo = async (roleId: string, modulo: string) => {
    const role = rows.find((r) => r.id === roleId);
    if (!role) return;
    const actuales = role.modulos ?? [];
    const modulos = actuales.includes(modulo)
      ? actuales.filter((m) => m !== modulo)
      : [...actuales, modulo];
    const secciones = new Set(modulos);
    const permisos = role.permisos.filter(
      (perm) => perm === "admin:full" || secciones.has(SECCION_POR_PERMISO.get(perm) ?? ""),
    );
    setRows((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, modulos, permisos } : r)),
    );
    try {
      await rolesService.updateModulos(roleId, modulos);
    } catch {
      setRows((prev) =>
        prev.map((r) =>
          r.id === roleId ? { ...r, modulos: actuales, permisos: role.permisos } : r,
        ),
      );
    }
  };

  const handleAddUser = async () => {
    if (!newEmail.trim() || !newRoleId) return;
    setSaving(true);
    try {
      await rolesService.addUser(newEmail.trim(), newRoleId);
      setRows((prev) =>
        prev.map((r) =>
          r.id === newRoleId ? { ...r, count: r.count + 1 } : r,
        ),
      );
      setNewEmail("");
      setUsuariosLoading(true);
      setUserRefresh((valor) => valor + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUser = async (userId: string, roleId: string) => {
    try {
      await rolesService.removeUser(userId, roleId);
      setRows((prev) =>
        prev.map((r) =>
          r.id === roleId ? { ...r, count: Math.max(0, r.count - 1) } : r,
        ),
      );
      setUserPage(1);
      setUsuariosLoading(true);
      setUserRefresh((valor) => valor + 1);
    } catch {
      /* noop */
    }
  };

  return (
    <Tabs defaultValue="roles" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 lg:w-auto">
        <TabsTrigger value="roles"><span>Roles y Permisos</span></TabsTrigger>
        <TabsTrigger value="modulos"><span>Módulos por rol</span></TabsTrigger>
        <TabsTrigger value="usuarios"><span>Usuarios ({usuariosTotal})</span></TabsTrigger>
      </TabsList>

      <TabsContent value="roles" className="space-y-3">
        {rows.map((role) => {
          const isOpen = expandedRole === role.id;
          const modulosRole = role.modulos ?? [];
          const secciones = Object.entries(permissionSections).filter(([section]) =>
            modulosRole.includes(section),
          );
          return (
            <Card key={role.id} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer flex-row items-center justify-between gap-3 space-y-0 p-4 hover:bg-secondary/30"
                onClick={() => toggleExpand(role.id)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                    {role.nombre.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm capitalize">{role.nombre}</CardTitle>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {role.descripcion ?? "Sin descripción"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <Badge variant="secondary" className="text-[9px]">
                    <span>{role.count} usuarios</span>
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">
                    <span>{role.permisos.length} permisos</span>
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">
                    <span>{modulosRole.length} módulos</span>
                  </Badge>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>

              {isOpen ? (
                <CardContent className="border-t border-border bg-secondary/10 p-4">
                  {modulosRole.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-5 text-center">
                      <p className="text-xs font-medium text-foreground">Sin módulos asignados</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Asigna módulos en la pestaña <strong>Módulos por rol</strong> para habilitar sus permisos.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {secciones.map(([section, perms]) => {
                        const seleccionados = perms.filter((perm) => role.permisos.includes(perm.key)).length;
                        return (
                          <Card key={section} className="border-border/80 shadow-none">
                            <CardHeader className="space-y-0 p-3 pb-2">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-xs font-semibold">
                                  {PERMISSION_SECTION_LABELS[section] ?? section}
                                </CardTitle>
                                <Badge
                                  variant={seleccionados > 0 ? "default" : "secondary"}
                                  className="text-[9px]"
                                >
                                  <span>{seleccionados}/{perms.length}</span>
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-1.5 p-3 pt-0">
                              {perms.map((perm) => {
                                const checked = role.permisos.includes(perm.key);
                                return (
                                  <label
                                    key={perm.key}
                                    title={perm.descripcion}
                                    className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition-colors ${
                                      checked
                                        ? "border-primary/40 bg-primary/10 font-medium text-primary"
                                        : "border-border text-muted-foreground hover:border-primary/30"
                                    }`}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() => void togglePerm(role.id, perm.key)}
                                      className="h-3 w-3"
                                    />
                                    <span>{perm.label}</span>
                                  </label>
                                );
                              })}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </TabsContent>

      <TabsContent value="modulos" className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Habilita los módulos que este rol podrá configurar. Al quitar un módulo se retiran sus permisos asociados.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((role) => {
            const modulosRole = role.modulos ?? [];
            return (
              <Card key={role.id}>
                <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 p-4">
                  <div>
                    <CardTitle className="text-sm capitalize">{role.nombre}</CardTitle>
                    <p className="text-[11px] text-muted-foreground">{role.descripcion ?? "Sin descripción"}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">
                    <span>{modulosRole.length}/{MODULOS.length} módulos</span>
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-2 p-4 pt-0 sm:grid-cols-2">
                  {MODULOS.map((modulo) => {
                    const checked = modulosRole.includes(modulo.key);
                    return (
                      <label
                        key={modulo.key}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-[11px] transition-colors ${
                          checked
                            ? "border-primary/40 bg-primary/10 font-medium text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => void toggleModulo(role.id, modulo.key)}
                          className="h-3.5 w-3.5"
                        />
                        <span>{modulo.label}</span>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="usuarios">
        <Card>
          <CardHeader>
            <CardTitle><span>Asignar rol</span></CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input
              placeholder="email@empresa.pe"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="max-w-xs"
            />
            <Select value={newRoleId} onValueChange={setNewRoleId}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {rows.map((r) => (
                  <SelectItem key={r.id} value={r.id}><span className="capitalize">{r.nombre}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => void handleAddUser()} disabled={saving || !newEmail.trim() || !newRoleId}>
              <span>Asignar</span>
            </Button>
          </CardContent>
        </Card>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setUserPage(1);
                setUsuariosLoading(true);
              }}
              placeholder="Buscar por email o rol"
              className="h-8 pl-9 text-xs"
            />
          </div>
          <Select
            value={userRoleFilter}
            onValueChange={(valor) => {
              setUserRoleFilter(valor);
              setUserPage(1);
              setUsuariosLoading(true);
            }}
          >
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los roles</SelectItem>
              {rows.map((r) => (
                <SelectItem key={r.id} value={r.id}><span className="capitalize">{r.nombre}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(userPerPage)}
            onValueChange={(valor) => {
              setUserPerPage(Number(valor));
              setUserPage(1);
              setUsuariosLoading(true);
            }}
          >
            <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {USUARIOS_PER_PAGE.map((valor) => (
                <SelectItem key={valor} value={String(valor)}><span>{valor} filas</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-[10px]">
            <span>{usuariosTotal} resultado(s)</span>
          </Badge>
        </div>

        {usuariosLoading && usuarios.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground"><span>Cargando usuarios...</span></p>
        ) : usuarios.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            <span>
              {userSearch.trim() || userRoleFilter !== "todos"
                ? "Sin resultados para los filtros seleccionados."
                : "Sin usuarios asignados."}
            </span>
          </p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><span>Email</span></TableHead>
                    <TableHead><span>Rol</span></TableHead>
                    <TableHead className="w-20 text-right"><span>Acción</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={`${u.roleId}-${u.id}`}>
                      <TableCell className="font-mono text-xs">{u.email}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]"><span className="capitalize">{u.roleNombre}</span></Badge></TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => void handleRemoveUser(u.id, u.roleId)}
                        >
                          <span>Quitar</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Página {userPage} de {Math.max(1, usuariosTotalPages)}
              </p>
              <Pagination
                page={userPage}
                totalPages={Math.max(1, usuariosTotalPages)}
                onPageChange={(pagina) => {
                  setUserPage(pagina);
                  setUsuariosLoading(true);
                }}
              />
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
