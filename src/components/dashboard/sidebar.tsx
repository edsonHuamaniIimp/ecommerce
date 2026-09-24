"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { LayoutDashboard, Building2, Map, Wrench, Shield, Calendar, FileText, ClipboardList, ClipboardCheck, FolderOpen, X, Gem, CreditCard, FlaskConical } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@nrivera-iimp/ui-kit-iimp";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/shared/utils";
import { authService } from "@/lib/client/api/services/auth-service";
import { PERMISSIONS } from "@/lib/shared/constants";

const navItems = [
  { href: "/dashboard", label: "Panel de Control", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
  { href: "/dashboard/datos-evento", label: "Datos del Evento", icon: Map, permission: PERMISSIONS.EVENTOS_DATOS },
  { href: "/dashboard/vinculacion", label: "Vinculacion de Stands", icon: Wrench, permission: PERMISSIONS.STANDS_VINCULACION },
  { href: "/dashboard/solicitudes", label: "Solicitudes de alquiler", icon: ClipboardCheck, permission: PERMISSIONS.SOLICITUDES_VIEW },
  { href: "/dashboard/mis-solicitudes", label: "Mis solicitudes", icon: FolderOpen, permission: PERMISSIONS.SOLICITUDES_VIEW },
  { href: "/dashboard/stands", label: "Gestion de Stands", icon: FileText, permission: PERMISSIONS.STANDS_MANAGE },
  { href: "/dashboard/reservas", label: "Gestion de Reservas", icon: ClipboardList, permission: PERMISSIONS.READ_RESERVAS },
  { href: "/dashboard/auspicios", label: "Auspicios", icon: Gem, permission: PERMISSIONS.AUSPICIOS_VIEW },
  { href: "/dashboard/laboratorio", label: "Laboratorio 3D", icon: FlaskConical, permission: PERMISSIONS.LABORATORIO_VIEW },
  { href: "/dashboard/facturacion", label: "Facturacion", icon: CreditCard, permission: PERMISSIONS.FACTURACION_VIEW },
  { href: "/dashboard/roles", label: "Roles y Permisos", icon: Shield, permission: PERMISSIONS.ROLES_MANAGE },
  { href: "/dashboard/eventos", label: "Gestion de Eventos", icon: Calendar, permission: PERMISSIONS.EVENTS_MANAGE },
  { href: "/mapa", label: "Plano de Stands", icon: Building2, permission: PERMISSIONS.STANDS_PLANO },
] as const;

interface Props {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
}

export function Sidebar({ open, collapsed, onClose }: Props) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    authService.getSession().then((s) => {
      setPermissions(s.permissions ?? []);
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

  const content = (
    <>
      <div className={cn("flex h-12 items-center border-b px-3", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">IIMP</span>
              <span className="text-xs font-semibold text-foreground">Contratos Stands</span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 lg:hidden" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        {collapsed && (
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">IIMP</span>
        )}
      </div>
      <nav className={cn("flex-1 overflow-y-auto p-2", collapsed ? "flex flex-col items-center gap-0.5" : "space-y-0.5")}>
        {!collapsed && <p className="px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">General</p>}
        {navItems.map((item) => {
          if (item.permission && !loaded) return null;
          if (item.permission && !canSee(item.permission)) return null;
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
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

          return btn;
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
