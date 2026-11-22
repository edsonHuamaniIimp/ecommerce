"use client";

import { Card, CardContent, Skeleton } from "@nrivera-iimp/ui-kit-iimp";

function Cabecera() {
  return (
    <Card className="border-l-4 border-l-primary/40">
      <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1 basis-72 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-8 rounded" />
            <Skeleton className="h-7 w-72 max-w-full" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-80 max-w-full" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

function TarjetaDatos({ filas }: { filas: number }) {
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-4 w-44" />
      </div>
      <CardContent className="grid gap-x-4 gap-y-4 pt-4 sm:grid-cols-2">
        {Array.from({ length: filas }).map((_, indice) => (
          <div key={indice} className="space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-3.5 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FilaCriterio() {
  return (
    <div className="grid grid-cols-[1.4fr_auto_1.2fr] items-start gap-4 border-b border-border p-4 last:border-b-0">
      <div className="flex items-start gap-2">
        <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
        <div className="w-full space-y-1.5">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <div className="flex gap-1">
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-7 w-12" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

/** Esqueleto de carga de las vistas de lectura y edicion de un vinculo (misma estructura que la pantalla). */
export function DdVinculoSkeleton({ modo }: { modo: "lectura" | "edicion" }) {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando vínculo">
      <Skeleton className="h-3 w-56" />
      <Cabecera />
      {modo === "lectura" ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <TarjetaDatos filas={8} />
            <TarjetaDatos filas={5} />
            <TarjetaDatos filas={4} />
          </div>
          <Card>
            <div className="flex items-center gap-2 border-b border-border p-4">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            {Array.from({ length: 5 }).map((_, indice) => (
              <div key={indice} className="grid grid-cols-[1.4fr_auto_1.2fr] items-center gap-4 border-b border-border p-4 last:border-b-0">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <div className="space-y-2 border-b border-border p-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72 max-w-full" />
              <Skeleton className="h-1.5 w-full" />
            </div>
            {Array.from({ length: 6 }).map((_, indice) => (
              <FilaCriterio key={indice} />
            ))}
          </Card>
          <div className="space-y-4">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
