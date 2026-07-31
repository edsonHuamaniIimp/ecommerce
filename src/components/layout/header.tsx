"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { useEffect, useState, useRef } from "react";
import { LogOut, LogIn, Menu, User, ChevronDown } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  useEffect(() => { setMenuOpen(false); }, [pathname]);

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
      <div className="flex h-12 items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tracking-tight">
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">IIMP</span>
          <span className="hidden sm:inline">Contratos Stands</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Button key={l.href} variant={active ? "secondary" : "ghost"} size="sm" asChild className="h-7 text-xs">
                <Link href={l.href}><span>{l.label}</span></Link>
              </Button>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Evento */}
        {session?.eventoNombre ? (
          <Link
            href={`/presala?change=1&returnTo=${encodeURIComponent(pathname)}`}
            className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground transition-colors max-w-[140px] truncate"
            title={session.eventoNombre}
          >
            <span>{session.eventoNombre}</span>
          </Link>
        ) : (
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex h-7 text-xs">
            <Link href={`/presala?returnTo=${encodeURIComponent(pathname)}`}><span>Seleccionar evento</span></Link>
          </Button>
        )}

        {/* Auth */}
        {session?.authenticated ? (
          <div className="relative" ref={userMenuRef}>
            <Button variant="ghost" size="sm"
              className="h-7 gap-0.5 px-1.5 sm:px-2"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              title="Menu de usuario"
            >
              <User className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3 hidden sm:block" />
            </Button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border bg-white shadow-lg z-50 py-1">
                <Link href="/dashboard/perfil"
                  className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => setUserMenuOpen(false)}>
                  <User className="h-3.5 w-3.5" />
                  <span>Perfil</span>
                </Link>
                <button
                  onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Cerrar sesion</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0 sm:w-auto sm:px-2" title="Iniciar sesion">
            <Link href="/auth/login">
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1.5 text-xs">Ingresar</span>
            </Link>
          </Button>
        )}

        {/* Mobile hamburger */}
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 sm:hidden" onClick={() => setMenuOpen(!menuOpen)} title="Menu">
          <Menu className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t bg-background px-3 py-2 sm:hidden space-y-1">
          {session?.eventoNombre && (
            <Link
              href={`/presala?change=1&returnTo=${encodeURIComponent(pathname)}`}
              className="block rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <span>{session.eventoNombre}</span>
            </Link>
          )}
          {!session?.eventoNombre && (
            <Link href={`/presala?returnTo=${encodeURIComponent(pathname)}`} className="block rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted">
              <span>Seleccionar evento</span>
            </Link>
          )}
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`block rounded px-2 py-1.5 text-xs ${pathname === l.href ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted"}`}>
              <span>{l.label}</span>
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
