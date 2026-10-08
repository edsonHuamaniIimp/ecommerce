"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { perfilService } from "@/lib/client/api/services/perfil-service";

/**
 * Al ingresar al dashboard: si la cuenta del Portal esta vinculada a una empresa y le
 * faltan datos obligatorios del representante legal (DNI/correo/celular/direccion), se muestra un
 * modal que lleva a completarlos en Perfil.
 */
export function RepresentanteGate() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let activo = true;
    perfilService
      .get()
      .then((p) => {
        if (activo && p?.representanteIncompleto) setAbierto(true);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  if (!abierto) return null;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) setAbierto(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold">Completa tus datos de representante legal</DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span>
              Tu cuenta esta vinculada a una empresa y aun faltan datos obligatorios del representante legal
              (DNI, correo, celular y direccion). Completalos en tu perfil para firmar contratos y validaciones.
            </span>
          </p>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setAbierto(false)}><span>Mas tarde</span></Button>
          <Button
            size="sm"
            onClick={() => {
              setAbierto(false);
              router.push("/dashboard/perfil");
            }}
          >
            <span>Completar en mi perfil</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
