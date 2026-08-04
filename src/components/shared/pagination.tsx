"use client";

import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  const delta = 1;
  const start = Math.max(2, page - delta);
  const end = Math.min(totalPages - 1, page + delta);

  pages.push(1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("...");
  if (totalPages > 1) pages.push(totalPages);

  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      <Button variant="outline" size="sm" className="hidden sm:inline-flex h-7 w-7 p-0" disabled={page <= 1} onClick={() => onPageChange(1)} title="Primera pagina">
        <ChevronsLeft className="h-3.5 w-3.5" />
      </Button>
      <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => onPageChange(page - 1)} title="Anterior">
        <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </Button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-0.5 sm:px-1 text-[10px] sm:text-xs text-muted-foreground">...</span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="sm"
            className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-[10px] sm:text-xs"
            onClick={() => onPageChange(p)}
          >
            <span>{p}</span>
          </Button>
        ),
      )}
      <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} title="Siguiente">
        <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </Button>
      <Button variant="outline" size="sm" className="hidden sm:inline-flex h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} title="Ultima pagina">
        <ChevronsRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
