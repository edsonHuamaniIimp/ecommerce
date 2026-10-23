"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { Loader2, Table2 } from "lucide-react";
import { toast } from "sonner";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import { DD_RUTAS } from "@/lib/shared/constants";

interface Props {
  /** Expediente DD cuya fila de empresa se abre en la Matriz de evaluacion. */
  expedienteId: string;
  disabled?: boolean;
}

/** Boton "Matriz" de las bandejas: lleva al detalle de la empresa en la Matriz de evaluacion DD. */
export function DdMatrizBoton({ expedienteId, disabled = false }: Props) {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);

  const abrir = async () => {
    setAbriendo(true);
    try {
      const { id } = await ddMatrizEvaluacionService.abrir(expedienteId);
      router.push(`${DD_RUTAS.MATRIZ}/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir la matriz");
      setAbriendo(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1 text-[11px]"
      disabled={disabled || abriendo}
      title="Ver en la Matriz de evaluación DD"
      onClick={() => { void abrir(); }}
    >
      {abriendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Table2 className="h-3.5 w-3.5" />}
      <span>Matriz</span>
    </Button>
  );
}
