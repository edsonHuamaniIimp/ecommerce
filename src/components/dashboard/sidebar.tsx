"use client";

import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { LayoutDashboard, Building2, Map, Wrench, Shield, Calendar, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { authService } from "@/lib/api/services/auth-service";

const navItems = [
  { href: "/dashboard", label: "Panel de Control", icon: LayoutDashboard },
  { href: "/dashboard/planogess", label: "Plano GESS", icon: Map },
  { href: "/dashboard/gess", label: "Mantenedor GESS", icon: Wrench },
  { href: "/dashboard/roles", label: "Roles y Permisos", icon: Shield },
  { href: "/dashboard/eventos", label: "Gestion de Eventos", icon: Calendar },
  { href: "/plano", label: "Plano de Stands", icon: Building2 },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [eventoNombre, setEventoNombre] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const json = await authService.getSession();
        if (json.authenticated && json.eventoNombre) {
          setEventoNombre(json.eventoNombre);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    router.push("/auth/login");
    router.refresh();
  };
  const isDashboard = pathname.startsWith("/dashboard");

  return (
    <aside
      className={cn(
        "hidden w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-white transition-all lg:flex",
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
          IIMP
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-slate-700">Contratos Stands</span>
          {eventoNombre && (
            <p className="truncate text-[10px] text-muted-foreground">{eventoNombre}</p>
          )}
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-400">
          General
        </p>
        {navItems.map((item) => {
          const active = item.href === "/dashboard" 
            ? pathname === "/dashboard" 
            : pathname.startsWith(item.href);
          return (
            <Button
              key={item.href}
              variant={active ? "default" : "ghost"}
              size="sm"
              className={cn("w-full justify-start gap-3", active ? "shadow-sm" : "text-slate-500")}
              asChild
            >
              <Link href={item.href}>
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </Button>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesion</span>
        </Button>
      </div>
    </aside>
  );
}
