"use client";

import { useEffect, useState } from "react";
import { configuracionService } from "@/lib/client/api/services/configuracion-service";
import type { PortalConfigDTO } from "@/types/dto/configuracion/portal-config.dto";

/** Configuracion sin datos: el portal no muestra ningun enlace. */
export const PORTAL_CONFIG_VACIO: PortalConfigDTO = {
  mesaAyudaEmail: null,
  contactoEmail: null,
  manualUrl: null,
  reglamentoUrl: null,
};

/* Cache en memoria del modulo: header, footer y tarjetas comparten una sola peticion. */
let cache: PortalConfigDTO | null = null;
let enVuelo: Promise<PortalConfigDTO> | null = null;

function cargar(): Promise<PortalConfigDTO> {
  if (cache) return Promise.resolve(cache);
  enVuelo ??= configuracionService
    .obtenerPortal()
    .then((config) => {
      cache = config;
      enVuelo = null;
      return config;
    })
    .catch(() => {
      enVuelo = null;
      return PORTAL_CONFIG_VACIO;
    });
  return enVuelo;
}

/**
 * Configuracion publica del portal (login/presala). Best-effort: si falla,
 * devuelve la config vacia (los enlaces simplemente no se muestran).
 */
export function usePortalConfig(): PortalConfigDTO {
  const [config, setConfig] = useState<PortalConfigDTO>(cache ?? PORTAL_CONFIG_VACIO);

  useEffect(() => {
    let activo = true;
    cargar().then((valor) => {
      if (activo) setConfig(valor);
    });
    return () => {
      activo = false;
    };
  }, []);

  return config;
}
