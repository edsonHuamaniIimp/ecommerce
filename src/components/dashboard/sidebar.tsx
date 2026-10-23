"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { LayoutDashboard, Building2, Map, Wrench, Shield, Calendar, FileText, ClipboardList, ClipboardCheck, FolderOpen, X, Gem, CreditCard, FlaskConical, Wallet, Users, Bookmark, Settings, BarChart3, Megaphone, ShieldCheck, Scale, Table2, History, type LucideIcon } from "lucide-react";
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
  /** Agrupador visual para separar modulos dentro del sidebar. */
  section?: string;
  /** Solo se muestra al Portal del Cliente. */
  soloCliente?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Panel de Control", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
  { href: "/dashboard/datos-evento", label: "Datos del Evento", icon: Map, permission: PERMISSIONS.EVENTOS_DATOS },

  { href: "/dashboard/vinculacion", label: "Vinculación de Stands", icon: Wrench, permission: PERMISSIONS.STANDS_VINCULACION, section: "Gestión de Stands" },
  { href: "/dashboard/stands", label: "Gestión de Stands", icon: FileText, permission: PERMISSIONS.STANDS_MANAGE, section: "Gestión de Stands" },
  { href: "/dashboard/pre-reservas", label: "Pre-reservas", icon: Bookmark, permission: PERMISSIONS.STANDS_PRE_RESERVAR, section: "Gestión de Stands" },
  { href: "/mapa", label: "Plano de Stands", icon: Building2, permission: PERMISSIONS.STANDS_PLANO, section: "Gestión de Stands" },

  { href: "/dashboard/solicitudes", label: "Solicitudes de alquiler", icon: ClipboardCheck, permission: PERMISSIONS.SOLICITUDES_GESTION, section: "Solicitudes de alquiler" },

  { href: "/dashboard/mis-solicitudes", label: "Mis reservas", icon: FolderOpen, permission: PERMISSIONS.MIS_RESERVAS_VIEW, section: "Reservas" },
  { href: "/dashboard/reservas", label: "Reservas", icon: ClipboardList, permission: PERMISSIONS.READ_RESERVAS, section: "Reservas" },

  { href: "/dashboard/auspicios", label: "Auspicios", icon: Gem, permission: PERMISSIONS.AUSPICIOS_VIEW, section: "Auspicios" },
  { href: "/dashboard/laboratorio", label: "Laboratorio 3D", icon: FlaskConical, permission: PERMISSIONS.LABORATORIO_VIEW, section: "Laboratorio 3D" },

  { href: "/dashboard/facturacion", label: "Facturación", icon: CreditCard, permission: PERMISSIONS.FACTURACION_VIEW, section: "Facturación" },
  { href: "/dashboard/mis-pagos", label: "Mis pagos", icon: Wallet, permission: PERMISSIONS.PAGOS_VIEW, section: "Facturación" },

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

  const canSee = (perm: string | null) => {
    if (!perm) return true;
    return permissions.includes(perm) || permissions.includes(PERMISSIONS.ADMIN_FULL);
  };

  /* Portal del Cliente: su inicio es "Mi Panel"; el panel de control queda para los demas roles. */
  const esCliente = roles.includes(ROLES.CLIENTE) && !roles.includes(ROLES.ADMIN);
  const items: NavItem[] = esCliente
    ? [{ href: "/dashboard", label: "Inicio", icon: LayoutDashboard }, ...navItems.filter((item) => item.href !== "/dashboard")]
    : navItems;

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
        {!collapsed && <p className="px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">General</p>}
        {items.map((item, index) => {
          if (item.permission && !loaded) return null;
          if (item.permission && !canSee(item.permission)) return null;
          if (item.soloCliente && !esCliente) return null;
          const inicioSeccion = Boolean(item.section) && items[index - 1]?.section !== item.section;
          const active = item.href === "/dashboard" || item.href === DD_RUTAS.BASE
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const btn = (
            <Button
              key={item.href}
              variant={active ? "default" : "ghost"}
              size="sm"
              className={cn(
                collapsed ? "w-10 h-10 p-0 justify-center" : "w-full justify-start gap-2.5 h-8",
                "text-xs",
                active ? "shadow-sm" : "text-muted-foreground"
              )}
              asChild
            >
              <Link href={item.href}>
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
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

          if (!item.section) return btn;
          return (
            <Fragment key={`seccion-${item.section}-${item.href}`}>
              {inicioSeccion ? (
                <p className="px-3 pt-3 pb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {item.section}
                </p>
              ) : null}
              {btn}
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
        collapsed ? "w-[56px]" : "w-56"
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
