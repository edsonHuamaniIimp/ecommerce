"use client";

import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { LayoutDashboard, Building2, Map, Wrench, Shield, Calendar } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Panel de Control", icon: LayoutDashboard },
  { href: "/dashboard/planogess", label: "Plano GESS", icon: Map },
  { href: "/dashboard/gess", label: "Mantenedor GESS", icon: Wrench },
  { href: "/dashboard/roles", label: "Roles y Permisos", icon: Shield },
  { href: "/dashboard/eventos", label: "Eventos y Versiones", icon: Calendar },
  { href: "/plano", label: "Plano de Stands", icon: Building2 },
] as const;

export function Sidebar() {
  const pathname = usePathname();
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
        <span className="text-sm font-semibold text-slate-700">Contratos Stands</span>
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
      <div className="border-t border-slate-200 p-3">
        <Button variant="ghost" size="sm" className="w-full justify-start text-slate-400" asChild>
          <Link href="/">
            <span>Salir</span>
          </Link>
        </Button>
      </div>
    </aside>
  );
}
