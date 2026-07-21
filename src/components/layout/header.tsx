"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, VerticalSwitcher } from "@nrivera-iimp/ui-kit-iimp";
import { useEffect, useState } from "react";

const links = [
  { href: "/plano-isometrico", label: "Isometrico" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<{ authenticated: boolean; email?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/session");
        const json = await res.json();
        setSession(json);
      } catch {
        setSession({ authenticated: false });
      }
    })();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
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
        {session?.authenticated ? (
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <span>Cerrar sesion</span>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/auth/login"><span>Ingresar</span></Link>
          </Button>
        )}
        <VerticalSwitcher />
      </div>
    </header>
  );
}
