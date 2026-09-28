"use client";

import type { ReactNode } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pinta el boton de confirmar como accion destructiva. */
  destructive?: boolean;
}

interface Props extends ConfirmOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmacion transversal (basado en el Dialog del UI Kit).
 * Usar SIEMPRE esto en lugar de `window.confirm`/`alert`/`prompt`.
 * Para uso ergativo: `useConfirm()` (ver src/hooks/use-confirm.tsx).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="rounded-xl border-border sm:max-w-sm">
        <DialogHeader>
          <DialogTitle><span>{title}</span></DialogTitle>
        </DialogHeader>
        {description && (
          <p className="text-sm text-muted-foreground">
            {typeof description === "string" ? <span>{description}</span> : description}
          </p>
        )}
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onCancel}>
            <span>{cancelLabel}</span>
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
            <span>{confirmLabel}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
