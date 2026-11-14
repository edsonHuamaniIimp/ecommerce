"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Button, Input } from "@nrivera-iimp/ui-kit-iimp";
import { LayoutDashboard, Building2, Map as MapIcon, Wrench, Shield, Calendar, FileText, ClipboardList, ClipboardCheck, FolderOpen, X, Gem, CreditCard, FlaskConical, Wallet, Users, Bookmark, Settings, BarChart3, Megaphone, ShieldCheck, Scale, Table2, History, UserPlus, Search, ChevronDown, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@nrivera-iimp/ui-kit-iimp";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/shared/utils";
import { authService } from "@/lib/client/api/services/auth-service";
import { DD_RUTAS, PERMISSIONS, ROLES } from "@/lib/shared/constants";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  /** Alternativa: basta con tener UNO de estos permisos. */
  anyOf?: readonly string[];
  /** Agrupador visual para separar modulos dentro del sidebar. */
  section?: string;
  /** Solo se muestra al Portal del Cliente. */
  soloCliente?: boolean;
  /** La ruta debe coincidir exactamente para marcarse activa. */
  exact?: boolean;
}

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Panel de Control", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
  { href: "/dashboard/datos-evento", label: "Datos del Evento", icon: MapIcon, permission: PERMISSIONS.EVENTOS_DATOS },

  { href: "/dashboard/vinculacion", label: "Vinculación de Stands", icon: Wrench, permission: PERMISSIONS.STANDS_VINCULACION, section: "Gestión de Stands" },
  { href: "/dashboard/stands", label: "Gestión de Stands", icon: FileText, permission: PERMISSIONS.STANDS_MANAGE, section: "Gestión de Stands" },
  { href: "/dashboard/pre-reservas", label: "Pre-reservas", icon: Bookmark, permission: PERMISSIONS.STANDS_PRE_RESERVAR, section: "Gestión de Stands" },
  { href: "/mapa", label: "Plano de Stands", icon: Building2, permission: PERMISSIONS.STANDS_PLANO, section: "Gestión de Stands" },

  { href: "/dashboard/solicitudes", label: "Solicitudes de alquiler", icon: ClipboardCheck, permission: PERMISSIONS.SOLICITUDES_GESTION, section: "Solicitudes de alquiler", exact: true },
  { href: "/dashboard/solicitudes/reportes", label: "Reportes", icon: BarChart3, permission: PERMISSIONS.REPORTES_VIEW, section: "Solicitudes de alquiler" },

  { href: "/dashboard/mis-solicitudes", label: "Mis reservas", icon: FolderOpen, permission: PERMISSIONS.MIS_RESERVAS_VIEW, section: "Reservas" },
  { href: "/dashboard/reservas", label: "Reservas", icon: ClipboardList, permission: PERMISSIONS.READ_RESERVAS, section: "Reservas" },
  { href: "/dashboard/reservar-empresa", label: "Reservar para empresa", icon: UserPlus, permission: PERMISSIONS.RESERVAS_EMPRESA, section: "Reservas" },

  { href: "/dashboard/auspicios", label: "Auspicios", icon: Gem, permission: PERMISSIONS.AUSPICIOS_VIEW, section: "Auspicios" },
  { href: "/dashboard/laboratorio", label: "Laboratorio 3D", icon: FlaskConical, permission: PERMISSIONS.LABORATORIO_VIEW, section: "Laboratorio 3D" },

  { href: "/dashboard/facturacion", label: "Facturación", icon: CreditCard, permission: PERMISSIONS.FACTURACION_VIEW, section: "Facturación" },
  { href: "/dashboard/mis-pagos", label: "Mis documentos", icon: Wallet, anyOf: [PERMISSIONS.PAGOS_VIEW, PERMISSIONS.FACTURACION_VIEW], section: "Facturación" },

  { href: "/dashboard/empresas", label: "Empresas", icon: Building2, permission: PERMISSIONS.EMPRESAS_VIEW, section: "Empresas" },

  { href: "/dashboard/roles", label: "Roles y Permisos", icon: Shield, permission: PERMISSIONS.ROLES_MANAGE, section: "Administración" },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: Users, permission: PERMISSIONS.USUARIOS_MANAGE, section: "Administración" },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings, permission: PERMISSIONS.PORTAL_MANAGE, section: "Sistema" },

  { href: "/dashboard/eventos", label: "Gestión de Eventos", icon: Calendar, permission: PERMISSIONS.EVENTS_MANAGE, section: "Eventos" },

  /* Modulo Debida Diligencia: items y permisos propios (dd:*). */
  { href: DD_RUTAS.BASE, label: "Mi debida diligencia", icon: ShieldCheck, permission: PERMISSIONS.DD_FORMULARIO, section: "Debida Diligencia", soloCliente: true },
  { href: DD_RUTAS.MIS_DILIGENCIAS, label: "Mis debidas diligencias", icon: History, permission: PERMISSIONS.DD_FORMULARIO, section: "Debida Diligencia", soloCliente: true },
  { href: DD_RUTAS.BASE, label: "Panel DD", icon: BarChart3, permission: PERMISSIONS.DD_PANEL, section: "Debida Diligencia" },
  { href: DD_RUTAS.BANDEJA, label: "Bandeja DD", icon: ClipboardCheck, permission: PERMISSIONS.DD_REVISION, section: "Debida Diligencia" },
  { href: DD_RUTAS.MATRIZ, label: "Matriz DD", icon: Table2, permission: PERMISSIONS.DD_MATRIZ, section: "Debida Diligencia" },
  { href: DD_RUTAS.LEGAL, label: "Revisión legal", icon: Scale, permission: PERMISSIONS.DD_LEGAL, section: "Debida Diligencia" },
  { href: DD_RUTAS.REPUTACION, label: "Revisión reputacional", icon: Megaphone, permission: PERMISSIONS.DD_REPUTACION, section: "Debida Diligencia" },
];

interface Props {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
}

export function Sidebar({ open, collapsed, onClose }: Props) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    authService.getSession().then((s) => {
      setPermissions(s.permissions ?? []);
      setRoles(s.roles ?? []);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onCloseRef.current();
  }, [pathname]);

  const canSee = (item: NavItem) => {
    if (permissions.includes(PERMISSIONS.ADMIN_FULL)) return true;
    if (item.anyOf && item.anyOf.length > 0) return item.anyOf.some((perm) => permissions.includes(perm));
    return !item.permission || permissions.includes(item.permission);
  };

  /* Portal del Cliente: su inicio es "Mi Panel"; el panel de control queda para los demas roles. */
  const esCliente = roles.includes(ROLES.CLIENTE) && !roles.includes(ROLES.ADMIN);
  const items: NavItem[] = esCliente
    ? [{ href: "/dashboard", label: "Inicio", icon: LayoutDashboard }, ...navItems.filter((item) => item.href !== "/dashboard")]
    : navItems;

  const visibleItems = items.filter((item) => {
    if (item.permission && !loaded) return false;
    if (!canSee(item)) return false;
    if (item.soloCliente && !esCliente) return false;
    return true;
  });
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = normalizedQuery
    ? visibleItems.filter((item) =>
        [item.label, item.section ?? "", item.href]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : visibleItems;
  const groups: NavGroup[] = [];
  const groupIndex = new Map<string, number>();
  for (const item of filteredItems) {
    const key = item.section ?? "__general__";
    const index = groupIndex.get(key);
    if (index === undefined) {
      groupIndex.set(key, groups.length);
      groups.push({ key, label: item.section ?? "General", items: [item] });
    } else {
      groups[index]?.items.push(item);
    }
  }

  const toggleSection = (key: string) => {
    setClosedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const esActivo = (item: NavItem) =>
    item.exact || item.href === "/dashboard" || item.href === DD_RUTAS.BASE
      ? pathname === item.href
      : pathname.startsWith(item.href);
  const grupoActivo = groups.find((group) => group.items.some(esActivo));

  const renderItem = (item: NavItem) => {
    const active = esActivo(item);
    const btn = (
      <Button
        key={item.href}
        variant={active ? "default" : "ghost"}
        size="sm"
        className={cn(
          collapsed ? "w-10 h-10 p-0 justify-center" : "w-full justify-start gap-2.5 h-8 pl-3 pr-2",
          "text-xs font-normal",
          active ? "font-semibold shadow-sm" : "text-foreground/80 hover:text-foreground",
        )}
        asChild
      >
        <Link href={item.href} aria-current={active ? "page" : undefined}>
          <item.icon className={cn("h-3.5 w-3.5 shrink-0", !active && "opacity-75")} />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>
      </Button>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <span>{item.label}</span>
          </TooltipContent>
        </Tooltip>
      );
    }

    return btn;
  };

  const content = (
    <>
      <div className={cn("flex h-12 items-center border-b", collapsed ? "justify-center px-1" : "justify-between px-3")}>
        {!collapsed && (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <Image src="/iimp-logo.png" alt="IIMP" width={202} height={65} className="h-6 w-auto shrink-0" preload />
              <span className="truncate text-xs font-semibold text-foreground">ecommerce</span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 lg:hidden" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        {collapsed && (
          <Image src="/iimp-logo.png" alt="IIMP" width={202} height={65} className="h-3.5 w-auto" preload />
        )}
      </div>
      <nav className={cn("flex-1 overflow-y-auto p-2", collapsed ? "flex flex-col items-center gap-0.5" : "space-y-0.5")}>
        {!collapsed && (
          <div className="relative mb-3 px-1">
            <Search className="absolute left-1 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en el menu"
              className="h-7 rounded-none !border-0 !border-b !border-border/70 !bg-transparent pl-6 pr-1 text-xs !shadow-none focus-visible:!border-primary focus-visible:!ring-0"
              aria-label="Buscar opcion del menu"
            />
          </div>
        )}

        {!collapsed && filteredItems.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-[11px] text-muted-foreground">
            <span>Sin resultados.</span>
          </p>
        )}

        {collapsed
          ? filteredItems.map((item) => renderItem(item))
          : groups.map((group) => {
              const open = Boolean(normalizedQuery) || !closedSections.has(group.key);
              return (
                <Fragment key={group.key}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 w-full justify-start gap-1.5 px-1.5 text-muted-foreground/70 hover:text-foreground",
                      grupoActivo?.key === group.key && "text-foreground",
                      group.key !== "__general__" && "mt-2 border-t border-border/50 pt-2",
                    )}
                    onClick={() => toggleSection(group.key)}
                    aria-expanded={open}
                  >
                    <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", !open && "-rotate-90")} />
                    <span className="flex-1 text-left text-[10px] font-extrabold uppercase tracking-[0.18em]">{group.label}</span>
                  </Button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                      open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                    aria-hidden={!open}
                    inert={!open}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="space-y-0.5">
                        {group.items.map((item) => renderItem(item))}
                      </div>
                    </div>
                  </div>
                </Fragment>
              );
            })}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop: permanent */}
      <aside className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-card transition-all duration-300 lg:flex",
        collapsed ? "w-[56px]" : "w-60"
      )}>
        {content}
      </aside>

      {/* Mobile: overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${open ? "visible" : "invisible"}`}>
        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
        <aside className={`absolute top-0 bottom-0 left-0 z-10 flex w-64 flex-col bg-card shadow-xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}>
          {content}
        </aside>
      </div>
    </>
  );
}
