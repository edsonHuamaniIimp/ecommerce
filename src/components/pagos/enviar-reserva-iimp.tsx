"use client";

import { useState } from "react";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { pagosService, type ArchivoIImpInputDTO } from "@/lib/client/api/services/pagos-service";
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

/**
 * "Registrar reserva en el IIMP": envia `POST /stands/reserva` con los documentos de
 * la cuenta corriente adjuntos por categoria (OC, HES, detraccion, diferencia).
 * Los documentos son opcionales; tambien se pueden agregar despues desde el panel
 * de documentos de la cuenta corriente.
 */
export function EnviarReservaIimp({ open, onOpenChange, cuotaId, cuotas, standCode, onEnviado }: Props) {
  const [archivos, setArchivos] = useState<ArchivoIImpInputDTO[]>([]);
  const [enviando, setEnviando] = useState(false);

  /* Requisito del flujo: la 1ra cuota exige al menos una OC y una HES (cuentan los documentos
     generales, sin cuota; en cuotas 2-3 son opcionales). Las constancias de pago
     (detraccion/diferencia) se adjuntan despues, al pagar. */
  const esDePrimeraCuota = (a: ArchivoIImpInputDTO) => a.cuota == null || a.cuota === 1;
  const tieneOC = archivos.some((a) => a.tipo === TIPOS_ARCHIVO_IIMP.OC && esDePrimeraCuota(a));
  const tieneHES = archivos.some((a) => a.tipo === TIPOS_ARCHIVO_IIMP.HES && esDePrimeraCuota(a));
  const requisitoOk = tieneOC && tieneHES;
  const falta = [!tieneOC ? "OC" : null, !tieneHES ? "HES" : null].filter(Boolean).join(" y ");

  const enviar = async () => {
    if (!cuotaId) return;
    setEnviando(true);
    try {
      const resultado = await pagosService.solicitarFactura(cuotaId, archivos);
      const doc = resultado.documento;
      toast.success(
        doc
          ? `Reserva registrada en el IIMP (contrato ${resultado.contrato}). Comprobante ${doc.serie}-${doc.numero} emitido.`
          : `Reserva registrada en el IIMP (contrato ${resultado.contrato}). El IIMP emitirá la factura de cada cuota en su fecha.`,
      );
      setArchivos([]);
      onOpenChange(false);
      onEnviado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar la reserva en el IIMP");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl border-border sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span>Registrar reserva en el IIMP{standCode ? ` · ${standCode}` : ""}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            <span>
              Adjunta la <strong>orden de compra (OC)</strong> y la <strong>hoja de entrada de servicio (HES)</strong> de la
              <strong>primera cuota</strong> (en las cuotas 2 y 3 son opcionales; indica la cuota de cada documento).
              Son requisito para solicitar la factura. Las constancias de pago (diferencia y detracción) se
              adjuntan después, al pagar cada cuota, en cualquier orden; la detracción aplica si la cuota
              supera S/ 700 (convertir si está en USD) y puede pagarse hasta 1 mes después.
            </span>
          </p>

          <FormArchivoIImp
            cuotas={cuotas}
            botonLabel="Adjuntar"
            tiposPermitidos={[TIPOS_ARCHIVO_IIMP.OC, TIPOS_ARCHIVO_IIMP.HES]}
            onAgregar={(a) => setArchivos((prev) => [...prev, a])}
          />

          {!requisitoOk && (
            <p className="text-[11px] font-semibold text-amber-700" role="alert">
              <span>Requisito: la primera cuota necesita al menos una OC y una HES para solicitar la factura{!requisitoOk ? ` (falta ${falta})` : ""}.</span>
            </p>
          )}

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

        <DialogFooter>
          <Button className="w-full" disabled={enviando || !requisitoOk} onClick={() => { void enviar(); }}>
            {enviando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
            <span>{enviando ? "Registrando reserva..." : "Enviar reserva al IIMP"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
