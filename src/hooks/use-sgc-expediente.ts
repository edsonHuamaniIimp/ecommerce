"use client";

import { useEffect, useState } from "react";
import { sgcService } from "@/lib/client/api/services/sgc-service";
import type { SgcExpedienteDetalleDTO } from "@/types/dto/sgc/expediente-detalle.dto";

interface SgcExpedienteData {
  data: SgcExpedienteDetalleDTO | null;
  loading: boolean;
  error: string | null;
}

export function useSgcExpediente(solicitudId: string): SgcExpedienteData & { refetch: () => void } {
  const [state, setState] = useState<SgcExpedienteData>({ data: null, loading: true, error: null });
  const [version, setVersion] = useState(0);

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
  }, [solicitudId, version]);

  return { ...state, refetch: () => setVersion((v) => v + 1) };
}
