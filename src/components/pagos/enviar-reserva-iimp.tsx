"use client";

import { useState } from "react";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from "@nrivera-iimp/ui-kit-iimp";
import { ArrowLeft, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { pagosService, type ArchivoIImpInputDTO, type RequisitosFacturacionDTO } from "@/lib/client/api/services/pagos-service";
import { TIPOS_ARCHIVO_IIMP } from "@/lib/shared/constants";
import { FormArchivoIImp, TIPOS_ARCHIVO_LABELS } from "./form-archivo-iimp";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cuota propia del cliente: el backend resuelve con ella la solicitud y la reserva. */
  cuotaId: string;
  /** Numero de cuotas del plan: acota el input de cuota de las constancias. */
  cuotas: number;
  standCode?: string;
  /** Se ejecuta tras registrar la reserva (recarga del listado). */
  onEnviado: () => void;
}

const REQUISITOS_INICIALES: RequisitosFacturacionDTO = {
  oc: true,
  hes: true,
  plataforma: false,
  plataformaNombre: "",
  plataformaUrl: "",
  valorizacion: false,
  otros: "",
  ninguna: false,
};

/**
 * "Solicitar factura" en dos pasos:
 * 1) Requisitos de facturacion (checklist de la empresa: OC, HES, plataforma de
 *    proveedores, valorizacion, otros o "ninguna de las anteriores").
 * 2) Solicitud: documentos opcionales (OC/HES) y envio al IIMP. Los requisitos
 *    declarados son referenciales: no bloquean el envio. Las constancias de pago
 *    se adjuntan despues, al pagar cada cuota.
 */
export function EnviarReservaIimp({ open, onOpenChange, cuotaId, cuotas, standCode, onEnviado }: Props) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [archivos, setArchivos] = useState<ArchivoIImpInputDTO[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [requisitos, setRequisitos] = useState<RequisitosFacturacionDTO>(REQUISITOS_INICIALES);

  const marcar = (campo: keyof RequisitosFacturacionDTO, valor: boolean) => {
    setRequisitos((prev) => {
      if (campo === "ninguna" && valor) {
        /* Declarar "ninguna de las anteriores" desmarca el resto del checklist. */
        return { ...REQUISITOS_INICIALES, ninguna: true };
      }
      return { ...prev, [campo]: valor, ...(campo !== "ninguna" && valor ? { ninguna: false } : {}) };
    });
  };

  const cerrar = (v: boolean) => {
    if (!v) {
      setPaso(1);
      setArchivos([]);
      setRequisitos(REQUISITOS_INICIALES);
    }
    onOpenChange(v);
  };

  const enviar = async () => {
    if (!cuotaId) return;
    setEnviando(true);
    try {
      const resultado = await pagosService.solicitarFactura(cuotaId, archivos, {
        oc: requisitos.oc,
        hes: requisitos.hes,
        plataforma: requisitos.plataforma,
        plataformaNombre: requisitos.plataformaNombre || null,
        plataformaUrl: requisitos.plataformaUrl || null,
        valorizacion: requisitos.valorizacion,
        otros: requisitos.otros || null,
        ninguna: requisitos.ninguna,
      });
      const doc = resultado.documento;
      toast.success(
        doc
          ? `Reserva registrada en el IIMP (contrato ${resultado.contrato}). Comprobante ${doc.serie}-${doc.numero} emitido.`
          : `Reserva registrada en el IIMP (contrato ${resultado.contrato}). El IIMP emitirá la factura de cada cuota en su fecha.`,
      );
      toast.info("Facturación y Cobranzas te enviará un correo con las indicaciones de pago.");
      cerrar(false);
      onEnviado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar la reserva en el IIMP");
    } finally {
      setEnviando(false);
    }
  };

  const declaroDocumentos = !requisitos.ninguna && (requisitos.oc === true || requisitos.hes === true);

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden rounded-xl border-border sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span>
              {paso === 1 ? "Requisitos de facturación" : "Solicitar factura"}
              {standCode ? ` · ${standCode}` : ""}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {paso === 1 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                <span>
                  Antes de solicitar tu factura, verifica los requisitos de facturación de tu empresa.
                  Selecciona todas las opciones que correspondan.
                </span>
              </p>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={requisitos.oc === true} onChange={(e) => marcar("oc", e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                  <span><strong>Orden de compra (OC)</strong>: documento que autoriza la compra del producto o servicio.</span>
                </label>

                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={requisitos.hes === true} onChange={(e) => marcar("hes", e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                  <span><strong>Hoja de entrada de servicio (HES)</strong>: constancia de conformidad del servicio recibido.</span>
                </label>

                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={requisitos.plataforma === true} onChange={(e) => marcar("plataforma", e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                  <span><strong>Registro en plataforma o portal de proveedores</strong>: indica si tu empresa requiere registrar la factura en una plataforma para su validación o aprobación.</span>
                </label>

                {requisitos.plataforma && (
                  <div className="ml-6 grid gap-2 sm:grid-cols-2">
                    <Input
                      className="h-9 text-xs"
                      placeholder="Nombre de la plataforma"
                      value={requisitos.plataformaNombre ?? ""}
                      onChange={(e) => setRequisitos((prev) => ({ ...prev, plataformaNombre: e.target.value }))}
                    />
                    <Input
                      className="h-9 text-xs"
                      placeholder="Enlace de acceso (https://...)"
                      value={requisitos.plataformaUrl ?? ""}
                      onChange={(e) => setRequisitos((prev) => ({ ...prev, plataformaUrl: e.target.value }))}
                    />
                  </div>
                )}

                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={requisitos.valorizacion === true} onChange={(e) => marcar("valorizacion", e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                  <span><strong>Valorización o cotización aprobada</strong>: documento que sustenta el importe contratado.</span>
                </label>

                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={Boolean(requisitos.otros)} onChange={(e) => setRequisitos((prev) => ({ ...prev, otros: e.target.checked ? (prev.otros || " ") : "" }))} className="mt-0.5 h-4 w-4 accent-primary" />
                  <span><strong>Otros requisitos</strong>: especifica qué documento necesita tu empresa.</span>
                </label>

                {Boolean(requisitos.otros?.trim()) && (
                  <Input
                    className="ml-6 h-9 text-xs"
                    placeholder="Especifica el requisito"
                    value={requisitos.otros ?? ""}
                    onChange={(e) => setRequisitos((prev) => ({ ...prev, otros: e.target.value }))}
                  />
                )}

                <label className="flex items-start gap-2 border-t border-border pt-2 text-xs">
                  <input type="checkbox" checked={requisitos.ninguna === true} onChange={(e) => marcar("ninguna", e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                  <span><strong>Ninguna de las anteriores</strong>: mi empresa no requiere estos documentos (por ejemplo, empresas extranjeras o sin orden de compra).</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                <span>
                  Adjunta los documentos de tu declaración si ya los tienes (opcional). También puedes
                  registrarlos después desde &quot;Mis documentos&quot;. Las constancias de pago se adjuntan
                  al pagar cada cuota.
                </span>
              </p>

              {declaroDocumentos && (
                <p className="text-[11px] text-muted-foreground" role="note">
                  <span>Según tu declaración: {[requisitos.oc ? "OC" : null, requisitos.hes ? "HES" : null].filter(Boolean).join(" y ")}.</span>
                </p>
              )}

              <FormArchivoIImp
                cuotas={cuotas}
                botonLabel="Adjuntar"
                tiposPermitidos={[TIPOS_ARCHIVO_IIMP.OC, TIPOS_ARCHIVO_IIMP.HES]}
                onAgregar={(a) => setArchivos((prev) => [...prev, a])}
              />

              {archivos.length > 0 && (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {archivos.map((a, i) => (
                    <div key={`${a.tipo}-${i}`} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <Badge className="pointer-events-none">{TIPOS_ARCHIVO_LABELS[a.tipo] ?? a.tipo}</Badge>
                      {a.cuota ? <span className="shrink-0 text-muted-foreground">Cuota {a.cuota}</span> : null}
                      <span className="min-w-0 flex-1 truncate" title={a.link}>{a.nombre ?? a.link}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-destructive"
                        title="Quitar documento"
                        onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                <span>
                  Al confirmar, el IIMP reservará los stands y creará el contrato y la cuenta corriente; la
                  factura de cada cuota se emite en su fecha al contacto de pagos.
                </span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {paso === 1 ? (
            <Button className="w-full" onClick={() => setPaso(2)}>
              <span>Continuar</span>
            </Button>
          ) : (
            <div className="flex w-full gap-2">
              <Button variant="outline" disabled={enviando} onClick={() => setPaso(1)}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                <span>Volver</span>
              </Button>
              <Button className="flex-1" disabled={enviando} onClick={() => { void enviar(); }}>
                {enviando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
                <span>{enviando ? "Registrando reserva..." : "Enviar reserva al IIMP"}</span>
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
