import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";

/** Skeleton del visor de mapa (macro o simple) mientras carga el plano. */
export function MapaSkeleton() {
  return (
    <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-44 rounded-full" />
            </div>
          </div>
          <Skeleton className="min-h-[420px] flex-1 rounded-none" />
          <div className="border-t border-border px-4 py-3">
            <Skeleton className="mx-auto h-4 w-full max-w-md" />
          </div>
        </div>
      </div>
    </main>
  );
}
