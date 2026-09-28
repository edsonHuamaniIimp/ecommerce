"use client";

import { useCallback, useEffect, useState } from "react";
import { VISTAS_BANDEJA, type VistaBandeja } from "@/lib/shared/constants";
import { vistaUtils } from "@/lib/shared/utils/vista";

/**
 * Vista (cuadricula/lista) de una bandeja, persistida en localStorage por bandeja.
 * `bandeja` es la clave logica (p. ej. "mis-pagos", "solicitudes").
 */
export function useVistaBandeja(bandeja: string, porDefecto: VistaBandeja = VISTAS_BANDEJA.GRID) {
  const [vista, setVistaState] = useState<VistaBandeja>(porDefecto);

  useEffect(() => {
    void (async () => { setVistaState(vistaUtils.get(bandeja, porDefecto)); })();
  }, [bandeja, porDefecto]);

  const setVista = useCallback((valor: VistaBandeja) => {
    setVistaState(valor);
    vistaUtils.set(bandeja, valor);
  }, [bandeja]);

  return { vista, setVista };
}
