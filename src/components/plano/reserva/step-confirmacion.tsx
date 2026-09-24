"use client";

import { useState } from "react";
import { Building2, FileText, Info, ShieldCheck, User } from "lucide-react";
import { Button, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, Label } from "@nrivera-iimp/ui-kit-iimp";
import { BADGE_STYLES, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO } from "@/lib/shared/constants";
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
    <div className="flex items-start justify-between gap-3 px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right text-[11px] font-medium text-foreground">{value}</span>
    </div>
  );
}

function CardResumen({ titulo, icono, badge, children }: { titulo: string; icono: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary px-3 py-2">
        <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-primary uppercase">
          {icono}
          {titulo}
        </span>
        {badge}
      </div>
      <div className="py-1">{children}</div>
    </div>
  );
}

export function StepConfirmacion({ datos, selectedLabels, docsCount, confirmado, onConfirmadoChange }: Props) {
  const [termsOpen, setTermsOpen] = useState(false);
  const esFactura = datos.tipoComprobante === TIPOS_COMPROBANTE.FACTURA;
  const comprobante = esFactura ? "Factura" : datos.tipoComprobante === TIPOS_COMPROBANTE.BOLETA ? "Boleta" : "-";

  return (
    <div className="flex flex-col gap-3 pt-3">
      <CardResumen titulo="Stands seleccionados" icono={<Building2 className="h-3.5 w-3.5" />}>
        <div className="px-3 py-2">
          <p className="text-xs text-foreground">{selectedLabels || "-"}</p>
        </div>
      </CardResumen>

      <CardResumen
        titulo="Facturacion y datos comerciales"
        icono={<ShieldCheck className="h-3.5 w-3.5" />}
      >
        <Row label="Comprobante" value={comprobante} />
        {esFactura && <Row label="Razon social" value={datos.razonSocial || "-"} />}
        <Row
          label="Documento"
          value={`${esFactura ? TIPOS_DOCUMENTO.RUC : TIPOS_DOCUMENTO.DNI} ${datos.numeroDocumento || "-"}`}
        />
        <Row label="Direccion" value={datos.direccion || "-"} />
      </CardResumen>

      <CardResumen titulo="Contacto comercial y tecnico" icono={<User className="h-3.5 w-3.5" />}>
        <Row label="Representante" value={datos.contacto || "-"} />
        <Row label="Telefono" value={datos.telefono || "-"} />
        <Row label="Correo electronico" value={datos.email || "-"} />
      </CardResumen>

      {docsCount > 0 && (
        <CardResumen
          titulo="Documentacion adjunta"
          icono={<FileText className="h-3.5 w-3.5" />}
          badge={
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLES.SUCCESS}`}>
              {docsCount} archivo{docsCount === 1 ? "" : "s"}
            </span>
          }
        >
          <Row label="Adjuntos" value={`${docsCount} archivo(s)`} />
        </CardResumen>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3">
        <Checkbox
          id="acepto-terminos"
          checked={confirmado}
          onCheckedChange={(v) => onConfirmadoChange(v === true)}
          className="mt-0.5 h-4 w-4 border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
        <Label htmlFor="acepto-terminos" className="block cursor-pointer text-xs leading-relaxed font-normal text-muted-foreground">
          <span>
            He leido y acepto los{" "}
            <Button
              type="button"
              variant="ghost"
              className="h-auto p-0 text-xs font-medium text-primary underline hover:bg-transparent hover:text-primary/80"
              onClick={(e) => { e.preventDefault(); setTermsOpen(true); }}
            >
              <span>terminos y condiciones</span>
            </Button>{" "}
            del IIMP. Entiendo que al enviar esta solicitud, el stand quedara reservado y sujeto al proceso de revision.
          </span>
        </Label>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-[11px] text-warning">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-semibold">Nota importante:</span> al enviar la solicitud, tus stands quedaran sujetos al
          proceso de revision hasta que el Comite Comercial del IIMP emita el contrato marco.
        </span>
      </div>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Terminos y Condiciones del IIMP</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 text-sm text-muted-foreground">
            <p>Al solicitar el alquiler de un stand en los eventos organizados por el <strong className="text-foreground">Instituto de Ingenieros de Minas del Peru (IIMP)</strong>, el solicitante acepta las siguientes condiciones:</p>

            <div className="space-y-3">
              <div>
                <p className="font-semibold text-foreground">1. Proposito del alquiler</p>
                <p className="mt-0.5 text-xs">El stand sera utilizado exclusivamente para fines comerciales o institucionales relacionados con el evento para el cual se realiza la solicitud. No se permite la subarrendacion ni cesion del espacio sin autorizacion expresa del IIMP.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">2. Proceso de revision</p>
                <p className="mt-0.5 text-xs">Toda solicitud de alquiler esta sujeta a un proceso de revision por parte de las areas de Comunicacion, Legal y Logistica del IIMP. La aprobacion final queda a criterio del IIMP, el cual se reserva el derecho de rechazar una solicitud sin expresion de causa.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">3. Documentacion requerida</p>
                <p className="mt-0.5 text-xs">El solicitante se compromete a presentar la documentacion requerida en los plazos establecidos. La falta de documentacion completa podra ser causal de rechazo de la solicitud.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">4. Reserva y disponibilidad</p>
                <p className="mt-0.5 text-xs">La solicitud no constituye una reserva firme hasta que sea aprobada por todas las areas revisoras. Una vez enviada la solicitud, el stand pasara a estado &quot;En evaluacion&quot; y no podra ser reservado por terceros hasta que el proceso concluya.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">5. Proteccion de datos</p>
                <p className="mt-0.5 text-xs">Los datos personales proporcionados seran tratados conforme a la Ley de Proteccion de Datos Personales (Ley N. 29733). El IIMP no compartira la informacion con terceros sin consentimiento previo.</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t border-border pt-2">
            <Button size="sm" onClick={() => setTermsOpen(false)}>
              <span>Cerrar</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
