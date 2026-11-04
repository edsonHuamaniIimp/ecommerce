"use client";

import { useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { pagosService, type ArchivoIImpInputDTO, type RequisitosFacturacionDTO } from "@/lib/client/api/services/pagos-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { useConfirm } from "@/hooks/use-confirm";
import { TIPOS_ARCHIVO_IIMP, type TipoArchivoIImp } from "@/lib/shared/constants";
import { TIPOS_ARCHIVO_LABELS } from "./form-archivo-iimp";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cuota propia del cliente: el backend resuelve con ella la solicitud y la reserva. */
  cuotaId: string;
  /** Numero de la cuota desde la que se solicita la factura (se asocia a los documentos). */
  cuotaNumero?: number;
  standCode?: string;
  /** Se ejecuta tras registrar la solicitud (recarga del listado). */
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

/** Carga de los documentos de un requisito declarado; la cuota ya viene de la bandeja. */
function AdjuntoRequisito({
  tipo,
  cuota,
  archivos,
  faltante,
  onAgregar,
  onQuitar,
}: {
  tipo: TipoArchivoIImp;
  cuota: number | null;
  archivos: ArchivoIImpInputDTO[];
  faltainte?: boolean;
  faltante?: boolean;
  onAgregar: (archivo: ArchivoIImpInputDTO) => void;
  onQuitar: (indice: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirm, confirmDialog } = useConfirm();
  const [subiendo, setSubiendo] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const aceptado = await confirm({
      title: "Subir documento",
      description: `¿Subir "${file.name}"?`,
      confirmLabel: "Subir",
      cancelLabel: "Cancelar",
    });
    if (!aceptado) return;
    setSubiendo(true);
    try {
      const url = await uploadService.subir(file);
      onAgregar({ tipo, cuota, link: url, nombre: file.name });
      toast.success("Documento adjuntado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el archivo");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className={`space-y-1.5 rounded-lg border p-3 ${faltante ? "border-warning/50 bg-warning/5" : "border-border"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="text-xs font-semibold text-foreground">{TIPOS_ARCHIVO_LABELS[tipo] ?? tipo}</p>
          <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-warning">
            Obligatorio
          </span>
        </div>
        <Button
          type="button"
          variant={faltante ? "default" : "outline"}
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs"
          disabled={subiendo}
          onClick={() => inputRef.current?.click()}
        >
          {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          <span>{subiendo ? "Subiendo..." : "Adjuntar"}</span>
        </Button>
      </div>

      {archivos.length === 0 ? (
        <p className={`flex items-center gap-1.5 text-[11px] ${faltante ? "font-medium text-warning" : "text-muted-foreground"}`}>
          {faltante && <AlertTriangle className="h-3 w-3 shrink-0" />}
          <span>{faltante ? "Falta adjuntar este documento." : "Sin documento adjunto."}</span>
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {archivos.map((a, i) => (
            <div key={`${a.link}-${i}`} className="flex items-center gap-2 px-2 py-1.5 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={a.link}>{a.nombre ?? a.link}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0 text-destructive"
                title="Quitar documento"
                onClick={() => onQuitar(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={(e) => { void onFile(e); }}
      />
      {confirmDialog}
    </div>
  );
}

/**
 * "Solicitar factura" en un solo paso: el cliente declara sus requisitos y adjunta
 * los documentos en el mismo modal. La cuota (la de la bandeja) ya viene fijada.
 * Los requisitos son referenciales; las constancias de pago se adjuntan al pagar.
 */
export function EnviarReservaIimp({ open, onOpenChange, cuotaId, cuotaNumero, standCode, onEnviado }: Props) {
  const [archivos, setArchivos] = useState<ArchivoIImpInputDTO[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [requisitos, setRequisitos] = useState<RequisitosFacturacionDTO>(REQUISITOS_INICIALES);
  /** Error de validacion de requisitos (plataforma, otros o documentos faltantes). */
  const [error, setError] = useState<string | null>(null);

  const marcar = (campo: keyof RequisitosFacturacionDTO, valor: boolean) => {
    setError(null);
    setRequisitos((prev) => {
      if (campo === "ninguna" && valor) {
        /* Declarar "ninguna de las anteriores" desmarca todo el checklist. */
        return {
          ...REQUISITOS_INICIALES,
          oc: false,
          hes: false,
          plataforma: false,
          plataformaNombre: "",
          plataformaUrl: "",
          valorizacion: false,
          otros: "",
          ninguna: true,
        };
      }
      return { ...prev, [campo]: valor, ...(campo !== "ninguna" && valor ? { ninguna: false } : {}) };
    });
  };

  const cerrar = (v: boolean) => {
    if (!v) {
      setArchivos([]);
      setRequisitos(REQUISITOS_INICIALES);
      setError(null);
    }
    onOpenChange(v);
  };

  /** Tipos que debe adjuntar segun lo declarado (OC, HES o valorizacion). */
  const tiposDeclarados: TipoArchivoIImp[] = [
    ...(requisitos.oc ? [TIPOS_ARCHIVO_IIMP.OC] : []),
    ...(requisitos.hes ? [TIPOS_ARCHIVO_IIMP.HES] : []),
    ...(requisitos.valorizacion ? [TIPOS_ARCHIVO_IIMP.VALORIZACION_COTIZACION] : []),
    ...(requisitos.otros ? [TIPOS_ARCHIVO_IIMP.OTROS_REQUISITOS] : []),
  ];
  const cuotaDocumentos = cuotaNumero && cuotaNumero > 0 ? cuotaNumero : null;
  const faltantes = tiposDeclarados.filter((tipo) => !archivos.some((a) => a.tipo === tipo));

  /** Valida requisitos y documentos; luego envia la solicitud de factura. */
  const enviar = async () => {
    if (!cuotaId) return;
    if (requisitos.plataforma) {
      if (!requisitos.plataformaNombre?.trim()) {
        setError("Indica el nombre de la plataforma.");
        return;
      }
      if (!/^https?:\/\/.+/i.test((requisitos.plataformaUrl ?? "").trim())) {
        setError("Ingresa un enlace válido de la plataforma (http:// o https://).");
        return;
      }
    }
    if (requisitos.otros && !requisitos.otros.trim()) {
      setError("Especifica el requisito en \"Otros requisitos\".");
      return;
    }
    if (faltantes.length > 0) {
      setError(`Adjunta al menos un documento de: ${faltantes.map((tipo) => TIPOS_ARCHIVO_LABELS[tipo] ?? tipo).join(", ")}.`);
      return;
    }
    setError(null);
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
          ? `Solicitud de factura enviada. Comprobante ${doc.serie}-${doc.numero} emitido.`
          : "Solicitud de factura enviada. La factura de cada cuota se emitirá en su fecha.",
      );
      toast.info("Facturación y Cobranzas te enviará un correo con las indicaciones de pago.");
      cerrar(false);
      onEnviado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar la solicitud de factura");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden rounded-xl border-border sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span>Requisitos de facturación{standCode ? ` · ${standCode}` : ""}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              <span>
                Antes de solicitar tu factura, verifica los requisitos de facturación de tu empresa.
                Selecciona todas las opciones que correspondan y adjunta los documentos que apliquen.
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
                <span>
                  <strong>Registro en plataforma o portal de proveedores</strong>: indica si tu empresa requiere registrar la factura en una plataforma para su validación o aprobación.{" "}
                  {requisitos.plataforma && (
                    <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-warning">Obligatorio</span>
                  )}
                </span>
              </label>

              {requisitos.plataforma && (
                <div className="ml-6 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                    <span>Obligatorio: nombre y enlace de la plataforma</span>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      className={`h-9 text-xs ${(requisitos.plataformaNombre ?? "").trim() ? "" : "border-warning/60"}`}
                      placeholder="Nombre de la plataforma"
                      value={requisitos.plataformaNombre ?? ""}
                      onChange={(e) => { setError(null); setRequisitos((prev) => ({ ...prev, plataformaNombre: e.target.value })); }}
                    />
                    <Input
                      className={`h-9 text-xs ${/^https?:\/\/.+/i.test((requisitos.plataformaUrl ?? "").trim()) ? "" : "border-warning/60"}`}
                      placeholder="Enlace de acceso (https://...)"
                      value={requisitos.plataformaUrl ?? ""}
                      onChange={(e) => { setError(null); setRequisitos((prev) => ({ ...prev, plataformaUrl: e.target.value })); }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">El enlace debe iniciar con http:// o https://.</p>
                </div>
              )}

              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={requisitos.valorizacion === true} onChange={(e) => marcar("valorizacion", e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                <span><strong>Valorización o cotización aprobada</strong>: documento que sustenta el importe contratado.</span>
              </label>

              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={Boolean(requisitos.otros)} onChange={(e) => { setError(null); setRequisitos((prev) => ({ ...prev, otros: e.target.checked ? (prev.otros || " ") : "", ...(e.target.checked ? { ninguna: false } : {}) })); }} className="mt-0.5 h-4 w-4 accent-primary" />
                <span>
                  <strong>Otros requisitos</strong>: especifica qué documento necesita tu empresa.{" "}
                  {Boolean(requisitos.otros) && (
                    <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-warning">Obligatorio</span>
                  )}
                </span>
              </label>

              {Boolean(requisitos.otros) && (
                <div className="ml-6 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                    <span>Obligatorio: especifica el requisito</span>
                  </p>
                  <Input
                    className={`h-9 w-full text-xs ${(requisitos.otros ?? "").trim() ? "" : "border-warning/60"}`}
                    placeholder="Especifica el requisito"
                    value={requisitos.otros === " " ? "" : (requisitos.otros ?? "")}
                    onChange={(e) => { setError(null); setRequisitos((prev) => ({ ...prev, otros: e.target.value })); }}
                    autoFocus
                  />
                </div>
              )}

              <label className="flex items-start gap-2 border-t border-border pt-2 text-xs">
                <input type="checkbox" checked={requisitos.ninguna === true} onChange={(e) => marcar("ninguna", e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                <span><strong>Ninguna de las anteriores</strong>: mi empresa no requiere estos documentos (por ejemplo, empresas extranjeras o sin orden de compra).</span>
              </label>
            </div>

            {/* Documentos de los requisitos declarados (cuota fija de la bandeja). */}
            {tiposDeclarados.length > 0 && (
              <div className="space-y-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Documentos a adjuntar{cuotaDocumentos ? ` · cuota ${cuotaDocumentos}` : ""}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-warning">
                    <span>Obligatorio: adjunta al menos un documento por cada requisito marcado.</span>
                  </p>
                </div>
                {tiposDeclarados.map((tipo) => (
                  <AdjuntoRequisito
                    key={tipo}
                    tipo={tipo}
                    cuota={cuotaDocumentos}
                    archivos={archivos.filter((a) => a.tipo === tipo)}
                    faltante={faltantes.includes(tipo)}
                    onAgregar={(archivo) => setArchivos((prev) => [...prev, archivo])}
                    onQuitar={(indice) =>
                      setArchivos((prev) => {
                        const delTipo = prev.filter((a) => a.tipo === tipo);
                        const objetivo = delTipo[indice];
                        return prev.filter((a) => a !== objetivo);
                      })
                    }
                  />
                ))}
              </div>
            )}

            {faltantes.length > 0 && (
              <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] font-medium text-foreground" role="alert">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  Faltan documentos obligatorios: {faltantes.map((tipo) => TIPOS_ARCHIVO_LABELS[tipo] ?? tipo).join(" · ")}.
                  Adjúntalos para poder enviar la solicitud.
                </span>
              </p>
            )}

            <p className="text-[11px] text-muted-foreground">
              <span>
                Los requisitos y documentos son referenciales: Facturación y Cobranzas valida los pagos
                por los canales formales. Las constancias de pago se adjuntan al pagar cada cuota.
              </span>
            </p>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[11px] font-medium text-destructive" role="alert">
                <span>{error}</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button className="w-full" disabled={enviando || faltantes.length > 0} onClick={() => { void enviar(); }}>
            {enviando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
            <span>{enviando ? "Enviando solicitud..." : "Enviar solicitud de factura"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
