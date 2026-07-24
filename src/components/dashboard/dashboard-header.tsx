"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@nrivera-iimp/ui-kit-iimp";
import { LayoutDashboard, Map, Wrench, Shield, Calendar, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { authService } from "@/lib/api/services/auth-service";

const links = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/dashboard/planogess", label: "Plano GESS", icon: Map },
  { href: "/dashboard/gess", label: "Mantenedor GESS", icon: Wrench },
  { href: "/dashboard/roles", label: "Roles", icon: Shield },
  { href: "/dashboard/eventos", label: "Eventos", icon: Calendar },
] as const;

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [eventoNombre, setEventoNombre] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const json = await authService.getSession();
        if (json.authenticated) {
          setEventoNombre(json.eventoNombre ?? null);
          setEmail(json.email ?? null);
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

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-14 items-center gap-1 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 mr-3">
          <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">IIMP</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(l.href));
            return (
              <Button key={l.href} variant={active ? "secondary" : "ghost"} size="sm" asChild>
                <Link href={l.href}>
                  <l.icon className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline text-xs">{l.label}</span>
                </Link>
              </Button>
            );
          })}
        </nav>

        <div className="flex-1" />

        {eventoNombre && (
          <span className="hidden sm:inline text-xs text-muted-foreground mr-3 border-l pl-3">{eventoNombre}</span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">{email ?? "Usuario"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {email && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground border-b mb-1">{email}</div>
            )}
            <DropdownMenuItem onClick={handleLogout} className="text-xs">
              <LogOut className="h-3.5 w-3.5 mr-2" />
              <span>Cerrar sesion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
