"use client";

import { useEffect, useState } from "react";
import { sgcService } from "@/lib/client/api/services/sgc-service";
import type { SgcExpedienteDetalleDTO } from "@/types/dto/sgc/expediente-detalle.dto";

interface SgcExpedienteState {
  data: SgcExpedienteDetalleDTO | null;
  loading: boolean;
  error: string | null;
}

export function useSgcExpediente(solicitudId: string): SgcExpedienteState {
  const [state, setState] = useState<SgcExpedienteState>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelado = false;
    sgcService
      .detalle(solicitudId)
      .then((data) => {
        if (!cancelado) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Error" });
        }
      });
    return () => {
      cancelado = true;
    };
  }, [solicitudId]);

  return state;
}
