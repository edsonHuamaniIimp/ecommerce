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
  { href: "/dashboard/eventos", label: "Gestion de Eventos", icon: Calendar },
  { href: "/plano-isometrico", label: "Plano de Stands", icon: Building2 },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 flex-shrink-0 flex-col border-r bg-white lg:flex">
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">IIMP</span>
        <span className="text-xs font-semibold text-slate-700">Contratos Stands</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        <p className="px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">General</p>
        {navItems.map((item) => {
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Button
              key={item.href}
              variant={active ? "default" : "ghost"}
              size="sm"
              className={cn("w-full justify-start gap-2.5 h-8 text-xs", active ? "shadow-sm" : "text-muted-foreground")}
              asChild
            >
              <Link href={item.href}>
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
