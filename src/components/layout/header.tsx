"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { useEffect, useState } from "react";
import { authService } from "@/lib/api/services/auth-service";
import { LS_KEYS } from "@/lib/constants";

const links = [
  { href: "/plano", label: "Isometrico" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<{ authenticated: boolean; email?: string; eventoNombre?: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const json = await authService.getSession();
        if (json.authenticated) {
          let eventoNombre = json.eventoNombre ?? null;
          if (!eventoNombre) {
            const raw = localStorage.getItem(LS_KEYS.EVENTO_PUBLICO);
            if (raw) {
              try {
                const pub = JSON.parse(raw) as { nombre: string };
                eventoNombre = pub.nombre;
              } catch { /* ignore */ }
            }
          }
          setSession({ ...json, eventoNombre });
          return;
        }
        const raw = localStorage.getItem(LS_KEYS.EVENTO_PUBLICO);
        if (raw) {
          const pub = JSON.parse(raw) as { eventoId: string; nombre: string };
          setSession({ authenticated: false, eventoNombre: pub.nombre });
          return;
        }
        setSession(json);
      } catch {
        setSession({ authenticated: false });
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
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">IIMP</span>
          <span className="hidden sm:inline">Contratos Stands</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Button key={l.href} variant={active ? "secondary" : "ghost"} size="sm" asChild>
                <Link href={l.href}><span>{l.label}</span></Link>
              </Button>
            );
          })}
        </nav>
        <div className="flex-1" />
        {session?.eventoNombre ? (
          <Link
            href={`/presala?change=1&returnTo=${encodeURIComponent(pathname)}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{session.eventoNombre}</span>
          </Link>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/presala?returnTo=${encodeURIComponent(pathname)}`}><span>Seleccionar evento</span></Link>
          </Button>
        )}
        {session?.authenticated ? (
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <span>Cerrar sesion</span>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/auth/login"><span>Ingresar</span></Link>
          </Button>
        )}
      </div>
    </header>
  );
}
