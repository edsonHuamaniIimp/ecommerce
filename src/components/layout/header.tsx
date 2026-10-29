"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button, Popover, PopoverTrigger, PopoverContent } from "@nrivera-iimp/ui-kit-iimp";
import { useEffect, useState, useRef } from "react";
import { LogOut, LogIn, Menu, User, ChevronDown, AlertCircle } from "lucide-react";
import { authService } from "@/lib/client/api/services/auth-service";
import { LS_KEYS, ROLES } from "@/lib/shared/constants";
import { portalEmpresaService } from "@/lib/client/api/services/portal-empresa-service";
import { empresaPerfilPendiente } from "@/lib/shared/utils/empresa-perfil";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

const links = [
  { href: "/mapa", label: "Dinamico" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<{ authenticated: boolean; userId?: string; email?: string; roles?: string[]; eventoNombre?: string | null } | null>(null);
  const [perfilPendiente, setPerfilPendiente] = useState(false);
  const [perfilAvisoOpen, setPerfilAvisoOpen] = useState(false);
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
          // El evento elegido en presala manda sobre el de la sesion (es el que usa /mapa).
          let eventoNombre = json.eventoNombre ?? null;
          const raw = localStorage.getItem(LS_KEYS.EVENTO_PUBLICO);
          if (raw) {
            try {
              const pub = JSON.parse(raw) as { nombre?: string };
              if (pub.nombre) eventoNombre = pub.nombre;
            } catch { /* ignore */ }
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

  /* Aviso de perfil de empresa incompleto (solo clientes con empresa vinculada). */
  useEffect(() => {
    let activo = true;
    const esCliente = Boolean(session?.authenticated && session.roles?.includes(ROLES.CLIENTE) && !session.roles?.includes(ROLES.ADMIN));
    if (!esCliente) return () => { activo = false; };
    portalEmpresaService.misDatos()
      .then((empresa) => {
        if (activo) setPerfilPendiente(empresaPerfilPendiente(empresa).pendiente);
      })
      .catch(() => {
        if (activo) setPerfilPendiente(false);
      });
    return () => { activo = false; };
  }, [session?.authenticated, session?.userId, session?.roles, pathname]);
  useEffect(() => {
    queueMicrotask(() => setMenuOpen(false));
  }, [pathname]);

  /* Apertura automatica del aviso (una vez por sesion de navegador). */
  useEffect(() => {
    if (!perfilPendiente) return;
    try {
      if (sessionStorage.getItem("perfil-aviso-visto") === "1") return;
      sessionStorage.setItem("perfil-aviso-visto", "1");
    } catch {
      /* sessionStorage no disponible */
    }
    queueMicrotask(() => setPerfilAvisoOpen(true));
  }, [perfilPendiente]);
  const handleLogout = async () => {
    await authService.logout();
    localStorage.removeItem(LS_KEYS.EVENTO_PUBLICO);
    localStorage.removeItem(LS_KEYS.EVENTO_PENDIENTE);
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-12 items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tracking-tight">
          <Image src="/iimp-logo.png" alt="IIMP" width={202} height={65} className="h-6 w-auto" preload />
          <span className="hidden sm:inline">ecommerce</span>
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

        {/* Idioma (sitio publico) */}
        <LanguageSwitcher />

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
            {perfilPendiente && (
              <Popover open={perfilAvisoOpen} onOpenChange={setPerfilAvisoOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Completar datos de la empresa"
                    className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-amber-500 ring-2 ring-background"
                    onClick={(e) => e.stopPropagation()}
                  />
                </PopoverTrigger>
                <PopoverContent align="end" side="bottom" className="w-80">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">Completa los datos de tu empresa</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Necesitamos la informacion de la empresa y del representante legal para generar correctamente tu contrato y tus comprobantes.
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPerfilAvisoOpen(false)}>
                        <span>Ahora no</span>
                      </Button>
                      <Button size="sm" className="h-7 text-xs" asChild>
                        <Link href="/dashboard/perfil?tab=empresa" onClick={() => setPerfilAvisoOpen(false)}>
                          <span>Completar informacion</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border bg-white shadow-lg z-50 py-1">
                {perfilPendiente && (
                  <Link href="/dashboard/perfil?tab=empresa"
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100"
                    onClick={() => setUserMenuOpen(false)}>
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Completar datos de empresa</span>
                  </Link>
                )}
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
          {perfilPendiente && (
            <Link href="/dashboard/perfil?tab=empresa" className="flex items-center gap-2 rounded bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Completar datos de empresa</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
