"use client";

import { useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, CalendarClock, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { pagosService, type ArchivoIImpInputDTO, type RequisitosFacturacionDTO } from "@/lib/client/api/services/pagos-service";
import { facturacionService } from "@/lib/client/api/services/facturacion-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { useConfirm } from "@/hooks/use-confirm";
import { MAX_DESCRIPCION_FACTURA, TIPOS_ARCHIVO_IIMP, type TipoArchivoIImp } from "@/lib/shared/constants";
import { TIPOS_ARCHIVO_LABELS } from "./form-archivo-iimp";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cuota propia del cliente: el backend resuelve con ella la solicitud y la reserva. */
  cuotaId: string;
  /** Numero de la cuota desde la que se solicita la factura (se asocia a los documentos). */
  cuotaNumero?: number;
  standCode?: string;
  /** "solicitud" registra la reserva; "completar" solo guarda requisitos de una solicitud ya enviada. */
  modo?: "solicitud" | "completar";
  /** true = lo usa Facturacion en nombre del cliente (endpoint interno). */
  admin?: boolean;
  /** Cuotas del registro (solo admin al solicitar): permite elegir la cuota de origen. */
  cuotas?: Array<{ id: string; numero: number }>;
  /** Solicitud interna (solo admin al solicitar): permite guardar la solicitud como tarea con fecha y hora. */
  interna?: boolean;
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
  descripcionFactura: "",
};

/** Al completar una solicitud ya enviada no se preselecciona nada: el cliente declara. */
const REQUISITOS_COMPLETAR: RequisitosFacturacionDTO = {
  oc: false,
  hes: false,
  plataforma: false,
  plataformaNombre: "",
  plataformaUrl: "",
  valorizacion: false,
  otros: "",
  ninguna: false,
  descripcionFactura: "",
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
export function EnviarReservaIimp({ open, onOpenChange, cuotaId, cuotaNumero, standCode, modo = "solicitud", admin = false, cuotas = [], interna = false, onEnviado }: Props) {
  const esCompletar = modo === "completar";
  const esAdminSolicitud = admin && modo === "solicitud";
  const permiteProgramar = esAdminSolicitud && interna;
  /** Panel "Configurar fecha" abierto y fecha/hora (datetime-local, hora de Peru). */
  const [configurandoFecha, setConfigurandoFecha] = useState(false);
  const [fechaLocal, setFechaLocal] = useState("");
  const [cuotaOrigen, setCuotaOrigen] = useState({ id: cuotaId, numero: cuotaNumero ?? 1 });
  const cuotaEfectivaId = esAdminSolicitud ? cuotaOrigen.id : cuotaId;
  const cuotaEfectivaNumero = esAdminSolicitud ? cuotaOrigen.numero : cuotaNumero;
  const [archivos, setArchivos] = useState<ArchivoIImpInputDTO[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [requisitos, setRequisitos] = useState<RequisitosFacturacionDTO>(esCompletar ? REQUISITOS_COMPLETAR : REQUISITOS_INICIALES);
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
          descripcionFactura: prev.descripcionFactura ?? "",
        };
      }
      return { ...prev, [campo]: valor, ...(campo !== "ninguna" && valor ? { ninguna: false } : {}) };
    });
  };

  const cerrar = (v: boolean) => {
    if (!v) {
      setArchivos([]);
      setRequisitos(esCompletar ? REQUISITOS_COMPLETAR : REQUISITOS_INICIALES);
      setError(null);
      setCuotaOrigen({ id: cuotaId, numero: cuotaNumero ?? 1 });
      setConfigurandoFecha(false);
      setFechaLocal("");
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
  const cuotaDocumentos = cuotaEfectivaNumero && cuotaEfectivaNumero > 0 ? cuotaEfectivaNumero : null;
  const faltantes = tiposDeclarados.filter((tipo) => !archivos.some((a) => a.tipo === tipo));
  /** Debe declarar al menos un requisito o marcar explicitamente "Ninguna de las anteriores". */
  const sinRequisitoDeclarado =
    !requisitos.oc &&
    !requisitos.hes &&
    !requisitos.plataforma &&
    !requisitos.valorizacion &&
    !Boolean((requisitos.otros ?? "").trim()) &&
    !requisitos.ninguna;

  /** Requisitos declarados en el formato del API. */
  const armarRequisitos = () => ({
    oc: requisitos.oc,
    hes: requisitos.hes,
    plataforma: requisitos.plataforma,
    plataformaNombre: requisitos.plataformaNombre || null,
    plataformaUrl: requisitos.plataformaUrl || null,
    valorizacion: requisitos.valorizacion,
    otros: requisitos.otros || null,
    ninguna: requisitos.ninguna,
    descripcionFactura: requisitos.descripcionFactura || null,
  });

  /** Valida requisitos y documentos; devuelve false (y muestra el error) si falta algo. */
  const validar = (): boolean => {
    if (sinRequisitoDeclarado) {
      setError("Selecciona al menos un requisito o marca \"Ninguna de las anteriores\".");
      return false;
    }
    if (requisitos.plataforma) {
      if (!requisitos.plataformaNombre?.trim()) {
        setError("Indica el nombre de la plataforma.");
        return false;
      }
      if (!/^https?:\/\/.+/i.test((requisitos.plataformaUrl ?? "").trim())) {
        setError("Ingresa un enlace válido de la plataforma (http:// o https://).");
        return false;
      }
    }
    if (requisitos.otros && !requisitos.otros.trim()) {
      setError("Especifica el requisito en \"Otros requisitos\".");
      return false;
    }
    if (faltantes.length > 0) {
      setError(`Adjunta al menos un documento de: ${faltantes.map((tipo) => TIPOS_ARCHIVO_LABELS[tipo] ?? tipo).join(", ")}.`);
      return false;
    }
    return true;
  };

  /** Guarda la solicitud como tarea: el cron la registra en la fecha y hora configuradas. */
  const programar = async () => {
    if (!cuotaEfectivaId || !validar()) return;
    if (!fechaLocal) {
      setError("Indica la fecha y hora en que se solicitará la factura.");
      return;
    }
    /* El input es hora de Peru (UTC-5, sin horario de verano). */
    const fecha = new Date(`${fechaLocal}:00-05:00`);
    if (Number.isNaN(fecha.getTime()) || fecha.getTime() <= Date.now()) {
      setError("La fecha y hora deben ser posteriores al momento actual.");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await facturacionService.programarFactura(cuotaEfectivaId, fecha.toISOString(), armarRequisitos(), archivos);
      toast.success("Solicitud de factura programada. Se registrará automáticamente en la fecha indicada.");
      cerrar(false);
      onEnviado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo programar la solicitud de factura");
    } finally {
      setEnviando(false);
    }
  };

  /** Valida requisitos y documentos; luego envia la solicitud de factura. */
  const enviar = async () => {
    if (!cuotaEfectivaId || !validar()) return;
    setError(null);
    setEnviando(true);
    try {
      const datosRequisitos = armarRequisitos();
      if (esCompletar) {
        if (admin) await facturacionService.completarRequisitos(cuotaEfectivaId, datosRequisitos, archivos);
        else await pagosService.completarRequisitos(cuotaEfectivaId, datosRequisitos, archivos);
        toast.success("Requisitos de facturación actualizados.");
      } else {
        const resultado = admin
          ? await facturacionService.solicitarFactura(cuotaEfectivaId, datosRequisitos, archivos)
          : await pagosService.solicitarFactura(cuotaEfectivaId, archivos, datosRequisitos);
        const doc = resultado.documento;
        if (admin) {
          toast.success(
            doc
              ? `Solicitud registrada. Comprobante ${doc.serie}-${doc.numero} emitido.`
              : "Solicitud de factura registrada. La factura de cada cuota se emitirá en su fecha.",
          );
        } else {
          toast.success(
            doc
              ? `Solicitud de factura enviada. Comprobante ${doc.serie}-${doc.numero} emitido.`
              : "Solicitud de factura enviada. La factura de cada cuota se emitirá en su fecha.",
          );
          toast.info("Facturación y Cobranzas te enviará un correo con las indicaciones de pago.");
        }
      }
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
            <span>{esCompletar ? "Completar requisitos de facturación" : esAdminSolicitud ? "Solicitar factura" : "Requisitos de facturación"}{standCode ? ` · ${standCode}` : ""}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              <span>
                {esCompletar
                  ? "Tu solicitud de factura ya fue enviada, pero quedó sin requisitos declarados. Marca las opciones que correspondan y adjunta los documentos que apliquen."
                  : esAdminSolicitud
                    ? "Registra la solicitud de factura en nombre del cliente. Verifica los requisitos de facturación de la empresa, adjunta los documentos y elige la cuota de origen."
                    : "Antes de solicitar tu factura, verifica los requisitos de facturación de tu empresa. Selecciona todas las opciones que correspondan y adjunta los documentos que apliquen."}
              </span>
            </p>

            {esAdminSolicitud && cuotas.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold text-foreground">Cuota de origen</p>
                <Select
                  value={String(cuotaOrigen.numero)}
                  onValueChange={(valor) => {
                    const numero = Number(valor);
                    const cuota = cuotas.find((c) => c.numero === numero);
                    if (cuota) setCuotaOrigen({ id: cuota.id, numero: cuota.numero });
                  }}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cuotas.map((cuota) => (
                      <SelectItem key={cuota.id} value={String(cuota.numero)}>
                        <span>Cuota {cuota.numero}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  La solicitud se registra una sola vez para todas las cuotas; esta cuota identifica el origen de los requisitos y documentos.
                </p>
              </div>
            )}

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

              <div className="space-y-1.5 border-t border-border pt-2">
                <label htmlFor="descripcion-factura" className="text-xs font-semibold text-foreground">
                  Descripción de mi factura <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Input
                  id="descripcion-factura"
                  className="h-9 text-xs"
                  maxLength={MAX_DESCRIPCION_FACTURA}
                  placeholder="Ej.: OC 4501 - 1ra cuota"
                  value={requisitos.descripcionFactura ?? ""}
                  onChange={(e) => {
                    setError(null);
                    setRequisitos((prev) => ({ ...prev, descripcionFactura: e.target.value }));
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  {esCompletar
                    ? "La reserva ya fue enviada al IIMP: este texto se guarda en el Portal para Facturación y no se envía al SIE."
                    : `Máximo ${MAX_DESCRIPCION_FACTURA} caracteres. Se envía al sistema de facturación como texto libre de la cuota.`}
                </p>
              </div>
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

            {sinRequisitoDeclarado && (
              <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] font-medium text-foreground" role="status">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  Selecciona al menos un requisito o marca <strong>&quot;Ninguna de las anteriores&quot;</strong> para habilitar el envío.
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

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {permiteProgramar && configurandoFecha && (
            <div className="w-full space-y-1.5 rounded-lg border border-border p-3">
              <label htmlFor="fecha-programada" className="text-xs font-semibold text-foreground">
                Fecha y hora para solicitar la factura <span className="font-normal text-muted-foreground">(hora de Perú)</span>
              </label>
              <Input
                id="fecha-programada"
                type="datetime-local"
                className="h-9 text-xs"
                value={fechaLocal}
                onChange={(e) => { setError(null); setFechaLocal(e.target.value); }}
              />
              <p className="text-[10px] text-muted-foreground">
                Se guardan los requisitos y documentos de arriba como una tarea. En esa fecha y hora el sistema registra la solicitud de factura (puede demorar hasta 10 minutos).
              </p>
              <Button className="w-full" disabled={enviando || faltantes.length > 0 || sinRequisitoDeclarado || !fechaLocal} onClick={() => { void programar(); }}>
                {enviando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-1.5 h-4 w-4" />}
                <span>{enviando ? "Guardando..." : "Guardar programación"}</span>
              </Button>
            </div>
          )}
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            {permiteProgramar && (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                disabled={enviando}
                onClick={() => { setError(null); setConfigurandoFecha((v) => !v); }}
              >
                <CalendarClock className="mr-1.5 h-4 w-4" />
                <span>Configurar fecha</span>
              </Button>
            )}
            <Button className="w-full sm:flex-1" disabled={enviando || faltantes.length > 0 || sinRequisitoDeclarado} onClick={() => { void enviar(); }}>
              {enviando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
              <span>{enviando ? (esCompletar ? "Guardando..." : "Enviando solicitud...") : (esCompletar ? "Guardar requisitos" : esAdminSolicitud ? "Solicitar factura" : "Enviar solicitud de factura")}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
