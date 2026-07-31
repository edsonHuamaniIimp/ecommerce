"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@nrivera-iimp/ui-kit-iimp";
import { LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { authService } from "@/lib/api/services/auth-service";
import { LS_KEYS } from "@/lib/constants";

export function DashboardHeader() {
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
    localStorage.removeItem(LS_KEYS.EVENTO_PUBLICO);
    localStorage.removeItem(LS_KEYS.EVENTO_PENDIENTE);
    localStorage.removeItem(LS_KEYS.VERTICAL);
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-end gap-3 border-b bg-background px-4">
      {eventoNombre && (
        <Link href="/presala?change=1" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          <span>{eventoNombre}</span>
        </Link>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 max-w-[200px]">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline text-xs truncate">{email ?? "Usuario"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {email && (
            <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-b mb-1 truncate">{email}</div>
          )}
          <DropdownMenuItem asChild className="text-xs cursor-pointer">
            <Link href="/dashboard/perfil">
              <User className="h-3.5 w-3.5 mr-2" />
              <span>Perfil</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-xs cursor-pointer text-red-600">
            <LogOut className="h-3.5 w-3.5 mr-2" />
            <span>Cerrar sesion</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
