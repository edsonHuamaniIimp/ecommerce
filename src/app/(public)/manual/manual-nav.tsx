"use client";

import { useCallback, useEffect, useState } from "react";
import type { ManualSeccion } from "./content";

/** Alto del header sticky + margen de respiro para que el titulo quede visible. */
function altoOffset(): number {
  const header = document.querySelector("header");
  const alto = header?.getBoundingClientRect().height ?? 48;
  return alto + 16;
}

function irASeccion(id: string, behavior: ScrollBehavior) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - altoOffset();
  window.scrollTo({ top: y, behavior });
}

/** Menu lateral del manual: resalta la seccion visible y navega con scroll suave. */
export function ManualNav({ secciones }: { secciones: ManualSeccion[] }) {
  const [activa, setActiva] = useState<string>(secciones[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibles = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visibles[0]?.target.id) setActiva(visibles[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    for (const s of secciones) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [secciones]);

  /* Apertura directa con hash (ej. /manual#seccion-3): reposiciona con el offset del header. */
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || !secciones.some((s) => s.id === hash)) return;
    const timer = window.setTimeout(() => {
      irASeccion(hash, "auto");
      setActiva(hash);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [secciones]);

  const onClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    irASeccion(id, "smooth");
    window.history.replaceState(null, "", `#${id}`);
    setActiva(id);
  }, []);

  return (
    <nav aria-label="Secciones del manual" className="flex flex-col gap-0.5">
      {secciones.map((s) => {
        const activaSeccion = s.id === activa;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => onClick(e, s.id)}
            aria-current={activaSeccion ? "true" : undefined}
            className={`group flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-xs leading-snug transition-colors ${
              activaSeccion
                ? "border-gold bg-primary/5 font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                activaSeccion ? "bg-gold" : "bg-border group-hover:bg-muted-foreground"
              }`}
            />
            <span>{s.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
