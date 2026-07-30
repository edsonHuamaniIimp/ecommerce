"use client";

import type { FormDatos } from "./types";

interface Props {
  datos: FormDatos;
  selectedLabels: string;
  docsCount: number;
}

export function StepConfirmacion({ datos, selectedLabels, docsCount }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
        <p className="font-semibold text-slate-700">Resumen de la reserva</p>
        <div className="flex justify-between"><span className="text-muted-foreground">Stands</span><span className="font-mono">{selectedLabels}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Razon social</span><span className="font-medium">{datos.razonSocial}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">RUC</span><span className="font-medium">{datos.ruc}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Contacto</span><span className="font-medium">{datos.contacto}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Correo</span><span className="font-medium">{datos.email}</span></div>
        {docsCount > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">Documentos</span><span className="font-medium">{docsCount} adjunto(s)</span></div>
        )}
      </div>
      <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-800">
        <p>Al enviar la solicitud, el stand pasara a estado <strong>En evaluacion</strong> y no podra ser reservado por otra empresa hasta que el flujo de aprobaciones concluya.</p>
      </div>
    </div>
  );
}
