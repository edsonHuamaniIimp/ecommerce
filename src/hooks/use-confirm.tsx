"use client";

import { useCallback, useRef, useState } from "react";
import { ConfirmDialog, type ConfirmOptions } from "@/components/shared/confirm-dialog";

interface Estado extends ConfirmOptions {
  open: boolean;
}

/**
 * Confirmacion transversal con promesa. Reemplaza `window.confirm`.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   ...
 *   if (!(await confirm({ title: "Eliminar", description: "...", destructive: true }))) return;
 *   ...
 *   {confirmDialog}
 */
export function useConfirm() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const resolver = useRef<((valor: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setEstado({ ...options, open: true });
    });
  }, []);

  const cerrar = useCallback((valor: boolean) => {
    resolver.current?.(valor);
    resolver.current = null;
    setEstado((prev) => (prev ? { ...prev, open: false } : prev));
  }, []);

  const confirmDialog = (
    <ConfirmDialog
      open={estado?.open ?? false}
      title={estado?.title ?? ""}
      description={estado?.description}
      confirmLabel={estado?.confirmLabel}
      cancelLabel={estado?.cancelLabel}
      destructive={estado?.destructive}
      onConfirm={() => cerrar(true)}
      onCancel={() => cerrar(false)}
    />
  );

  return { confirm, confirmDialog };
}
