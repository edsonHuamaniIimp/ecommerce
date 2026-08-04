"use client";

import { Skeleton } from "@nrivera-iimp/ui-kit-iimp";

interface Props {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 10, columns = 5 }: Props) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 py-2">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-4 ${c === 0 ? "w-[60px]" : c === columns - 1 ? "ml-auto w-[80px]" : "flex-1"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
