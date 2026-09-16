"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import type { FormDatos } from "./interfaces";

interface Props {
  datos: FormDatos;
  selectedLabels: string;
  docsCount: number;
  confirmado: boolean;
  onConfirmadoChange: (v: boolean) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2.5 rounded even:bg-slate-50/50">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-[11px] font-medium text-slate-700 text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}

export function StepConfirmacion({ datos, selectedLabels, docsCount, confirmado, onConfirmadoChange }: Props) {
  const [termsOpen, setTermsOpen] = useState(false);

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

      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 cursor-pointer hover:border-emerald-300 transition-colors">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={(e) => onConfirmadoChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
        />
        <span className="text-xs text-slate-600 leading-relaxed">
          He leido y acepto los{" "}
          <button type="button" onClick={(e) => { e.preventDefault(); setTermsOpen(true); }} className="text-primary underline hover:text-primary/80">
            terminos y condiciones
          </button>{" "}
          del IIMP. Entiendo que al enviar esta solicitud, el stand quedara reservado y sujeto al proceso de revision.
        </span>
      </label>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <span>Terminos y Condiciones — IIMP</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto text-sm text-slate-600 space-y-4 pr-2">
            <p>Al solicitar el alquiler de un stand en los eventos organizados por el <strong>Instituto de Ingenieros de Minas del Peru (IIMP)</strong>, el solicitante acepta las siguientes condiciones:</p>

            <div className="space-y-3">
              <div>
                <p className="font-semibold text-slate-700">1. Proposito del alquiler</p>
                <p className="text-xs mt-0.5">El stand sera utilizado exclusivamente para fines comerciales o institucionales relacionados con el evento para el cual se realiza la solicitud. No se permite la subarrendacion ni cesion del espacio sin autorizacion expresa del IIMP.</p>
              </div>

              <div>
                <p className="font-semibold text-slate-700">2. Proceso de revision</p>
                <p className="text-xs mt-0.5">Toda solicitud de alquiler esta sujeta a un proceso de revision por parte de las areas de Comunicacion, Legal y Logistica del IIMP. La aprobacion final queda a criterio del IIMP, el cual se reserva el derecho de rechazar una solicitud sin expresion de causa.</p>
              </div>

              <div>
                <p className="font-semibold text-slate-700">3. Documentacion requerida</p>
                <p className="text-xs mt-0.5">El solicitante se compromete a presentar la documentacion requerida en los plazos establecidos. La falta de documentacion completa podra ser causal de rechazo de la solicitud.</p>
              </div>

              <div>
                <p className="font-semibold text-slate-700">4. Reserva y disponibilidad</p>
                <p className="text-xs mt-0.5">La solicitud no constituye una reserva firme hasta que sea aprobada por todas las areas revisoras. Una vez enviada la solicitud, el stand pasara a estado &quot;En evaluacion&quot; y no podra ser reservado por terceros hasta que el proceso concluya.</p>
              </div>

              <div>
                <p className="font-semibold text-slate-700">5. Proteccion de datos</p>
                <p className="text-xs mt-0.5">Los datos personales proporcionados seran tratados conforme a la Ley de Proteccion de Datos Personales (Ley N° 29733). El IIMP no compartira la informacion con terceros sin consentimiento previo.</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t">
            <Button size="sm" className="rounded-full" onClick={() => setTermsOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
