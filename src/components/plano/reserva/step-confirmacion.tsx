"use client";

import { AlertTriangle } from "lucide-react";
import type { FormDatos } from "./interfaces";

interface Props {
  datos: FormDatos;
  selectedLabels: string;
  docsCount: number;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2.5 rounded even:bg-slate-50/50">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-[11px] font-medium text-slate-700 text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}

export function StepConfirmacion({ datos, selectedLabels, docsCount }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="bg-slate-50/80 px-3 py-2 border-b border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Resumen</p>
        </div>
        <Row label="Stands" value={selectedLabels} />
        <Row label="Comprobante" value={datos.tipoComprobante === "factura" ? "Factura" : datos.tipoComprobante === "boleta" ? "Boleta" : "—"} />

        <div className="border-t border-slate-100 px-3 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Comercial</p>
        </div>
        {datos.tipoComprobante === "factura" && <Row label="Razon social" value={datos.razonSocial} />}
        <Row label="Documento" value={`${datos.tipoComprobante === "factura" ? "RUC" : "DNI"} ${datos.numeroDocumento}`} />
        <Row label="Direccion" value={datos.direccion} />

        <div className="border-t border-slate-100 px-3 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Contacto</p>
        </div>
        <Row label="Persona" value={datos.contacto} />
        <Row label="Telefono" value={datos.telefono} />
        <Row label="Correo" value={datos.email} />

        {docsCount > 0 && (
          <>
            <div className="border-t border-slate-100 px-3 py-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Documentos</p>
            </div>
            <Row label="Adjuntos" value={`${docsCount} archivo(s)`} />
          </>
        )}
      </div>

      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <p className="text-[11px] text-amber-700/90">Al enviar, el stand pasara a <strong>En evaluacion</strong> y no podra ser reservado hasta que las aprobaciones concluyan.</p>
      </div>
    </div>
  );
}
