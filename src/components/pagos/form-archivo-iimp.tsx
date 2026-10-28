"use client";

import { useRef, useState } from "react";
import { Button, Input, Switch } from "@nrivera-iimp/ui-kit-iimp";
import {
  BadgeCheck,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileUp,
  HandCoins,
  Landmark,
  Loader2,
  ShoppingCart,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { TIPOS_ARCHIVO_IIMP, TIPOS_ARCHIVO_IIMP_CON_CUOTA, type TipoArchivoIImp } from "@/lib/shared/constants";
import type { ArchivoCuentaDTO, ArchivoIImpInputDTO } from "@/lib/client/api/services/pagos-service";

/** Etiquetas de las categorias de archivo (badges de la bandeja y adjuntos). */
export const TIPOS_ARCHIVO_LABELS: Record<string, string> = {
  [TIPOS_ARCHIVO_IIMP.OC]: "Orden de compra (OC)",
  [TIPOS_ARCHIVO_IIMP.HES]: "Hoja de entrada (HES)",
  [TIPOS_ARCHIVO_IIMP.DETRACCION]: "Constancia de detracción",
  [TIPOS_ARCHIVO_IIMP.DIFERENCIA]: "Pago del saldo",
  [TIPOS_ARCHIVO_IIMP.PAGO_TOTAL]: "Pago total",
  [TIPOS_ARCHIVO_IIMP.VALORIZACION_COTIZACION]: "Valorización / cotización",
};

/** Titulos claros para las tarjetas de seleccion (lenguaje del cliente). */
const TIPOS_ARCHIVO_TITULO: Record<string, string> = {
  [TIPOS_ARCHIVO_IIMP.OC]: "Orden de compra (OC)",
  [TIPOS_ARCHIVO_IIMP.HES]: "Hoja de entrada de servicio",
  [TIPOS_ARCHIVO_IIMP.DETRACCION]: "Constancia de detracción",
  [TIPOS_ARCHIVO_IIMP.DIFERENCIA]: "Pago del saldo de la cuota",
  [TIPOS_ARCHIVO_IIMP.PAGO_TOTAL]: "Pago total",
  [TIPOS_ARCHIVO_IIMP.VALORIZACION_COTIZACION]: "Valorización o cotización",
};

/** Icono y descripcion breve de cada tipo de documento. */
const TIPOS_ARCHIVO_META: Record<string, { icono: LucideIcon; descripcion: string }> = {
  [TIPOS_ARCHIVO_IIMP.OC]: { icono: ShoppingCart, descripcion: "La orden de compra de tu empresa" },
  [TIPOS_ARCHIVO_IIMP.HES]: { icono: ClipboardCheck, descripcion: "Conformidad del servicio prestado" },
  [TIPOS_ARCHIVO_IIMP.DETRACCION]: { icono: Landmark, descripcion: "Comprobante del depósito de detracción (SPOT)" },
  [TIPOS_ARCHIVO_IIMP.DIFERENCIA]: { icono: HandCoins, descripcion: "Comprobante del pago restante de la cuota" },
  [TIPOS_ARCHIVO_IIMP.PAGO_TOTAL]: { icono: BadgeCheck, descripcion: "Comprobante del pago completo de la cuota" },
  [TIPOS_ARCHIVO_IIMP.VALORIZACION_COTIZACION]: { icono: ClipboardList, descripcion: "Cotización o valorización del servicio" },
};

interface Props {
  /** Numero de cuotas de la reserva: acota el input de cuota. */
  cuotas: number;
  /** Cuota preseleccionada (p. ej. la cuota desde la que se abrio el panel). */
  cuotaInicial?: number;
  /** Recibe el archivo listo (valida link y cuota obligatoria antes). */
  onAgregar: (archivo: ArchivoIImpInputDTO) => void;
  botonLabel?: string;
  /** Restringe las categorias disponibles (p. ej. en la solicitud de factura: solo OC y HES). */
  tiposPermitidos?: readonly TipoArchivoIImp[];
  /** Archivos ya registrados en la cuenta: habilita la lista dinamica de pagos por cuota. */
  archivosRegistrados?: readonly ArchivoCuentaDTO[];
}

/**
 * Formulario de carga de un documento de la cuenta corriente del IIMP:
 * 1) tipo de documento en tarjetas, 2) cuota cuando aplica (bloqueada si el panel
 * se abrio desde una cuota) y 3) el documento (arrastrar/soltar o pegar un enlace).
 * La lista de tipos es dinamica segun los pagos de la cuota elegida: "pago total"
 * es excluyente con "detraccion" y "diferencia".
 */
export function FormArchivoIImp({ cuotas, cuotaInicial, onAgregar, botonLabel = "Agregar a la bandeja", tiposPermitidos, archivosRegistrados }: Props) {
  const permitidos: readonly TipoArchivoIImp[] = tiposPermitidos ?? (Object.values(TIPOS_ARCHIVO_IIMP) as TipoArchivoIImp[]);
  const [tipo, setTipo] = useState<string>(permitidos[0] ?? TIPOS_ARCHIVO_IIMP.OC);
  const [cuotaNum, setCuotaNum] = useState(cuotaInicial ? String(cuotaInicial) : "1");
  /* Con cuota preseleccionada el input queda bloqueado; el switch habilita su edicion. */
  const [editarCuota, setEditarCuota] = useState(!cuotaInicial);
  const [link, setLink] = useState("");
  const [nombre, setNombre] = useState("");
  const [archivoSubido, setArchivoSubido] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const inputFileRef = useRef<HTMLInputElement>(null);

  /* Pagos ya registrados de la cuota elegida: si la cuota tiene "pago total" no se
     ofrecen detraccion/diferencia, y viceversa. */
  const cuotaNumerica = Number(cuotaNum);
  const cuotaValida = Number.isInteger(cuotaNumerica) && cuotaNumerica > 0 ? cuotaNumerica : null;
  const pagosDeCuota = (archivosRegistrados ?? []).filter((a) => a.cuota === cuotaValida);
  const hayPagoTotal = pagosDeCuota.some((a) => a.tipo === TIPOS_ARCHIVO_IIMP.PAGO_TOTAL);
  const hayPagoParcial = pagosDeCuota.some((a) => a.tipo === TIPOS_ARCHIVO_IIMP.DETRACCION || a.tipo === TIPOS_ARCHIVO_IIMP.DIFERENCIA);

  const visiblesBase = permitidos.filter((t) => {
    if (t === TIPOS_ARCHIVO_IIMP.PAGO_TOTAL) return !hayPagoParcial;
    if (t === TIPOS_ARCHIVO_IIMP.DETRACCION || t === TIPOS_ARCHIVO_IIMP.DIFERENCIA) return !hayPagoTotal;
    return true;
  });
  const tipoEfectivo = visiblesBase.includes(tipo as TipoArchivoIImp) ? tipo : (visiblesBase[0] ?? TIPOS_ARCHIVO_IIMP.OC);
  /* Mientras un tipo de pago este seleccionado, su contraparte tampoco se ofrece. */
  const visibles = visiblesBase.filter((t) => {
    if (t === TIPOS_ARCHIVO_IIMP.PAGO_TOTAL) return tipoEfectivo !== TIPOS_ARCHIVO_IIMP.DETRACCION && tipoEfectivo !== TIPOS_ARCHIVO_IIMP.DIFERENCIA;
    if (t === TIPOS_ARCHIVO_IIMP.DETRACCION || t === TIPOS_ARCHIVO_IIMP.DIFERENCIA) return tipoEfectivo !== TIPOS_ARCHIVO_IIMP.PAGO_TOTAL;
    return true;
  });
  const exigeCuota = TIPOS_ARCHIVO_IIMP_CON_CUOTA.includes(tipoEfectivo as (typeof TIPOS_ARCHIVO_IIMP_CON_CUOTA)[number]);

  const subirArchivo = async (file: File) => {
    setSubiendo(true);
    try {
      const url = await uploadService.subir(file);
      setLink(url);
      setNombre((prev) => (prev.trim() ? prev : file.name));
      setArchivoSubido(file.name);
      toast.success("Documento cargado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el archivo");
    } finally {
      setSubiendo(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void subirArchivo(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void subirArchivo(file);
  };

  const quitarArchivo = () => {
    setLink("");
    setNombre("");
    setArchivoSubido(null);
  };

  const agregar = () => {
    if (!link.trim()) {
      toast.error("Sube un archivo o pega su enlace");
      return;
    }
    if (exigeCuota && (!Number.isInteger(cuotaNumerica) || cuotaNumerica < 1)) {
      toast.error("Indica la cuota de la constancia de pago");
      return;
    }
    onAgregar({
      tipo: tipoEfectivo,
      cuota: Number.isInteger(cuotaNumerica) && cuotaNumerica > 0 ? cuotaNumerica : null,
      link: link.trim(),
      nombre: nombre.trim() || null,
    });
    setLink("");
    setNombre("");
    setArchivoSubido(null);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border p-3">
      {/* 1. Tipo de documento en tarjetas */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">1. ¿Qué documento vas a subir?</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visibles.map((t) => {
            const meta = TIPOS_ARCHIVO_META[t];
            const Icono = meta?.icono ?? ClipboardList;
            const activo = tipoEfectivo === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                aria-pressed={activo}
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                  activo ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                <Icono className={`mt-0.5 h-4 w-4 shrink-0 ${activo ? "text-primary" : "text-muted-foreground"}`} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-tight text-foreground">{TIPOS_ARCHIVO_TITULO[t] ?? TIPOS_ARCHIVO_LABELS[t] ?? t}</span>
                  <span className="block text-[10px] leading-tight text-muted-foreground">{meta?.descripcion ?? ""}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Cuota */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            2. ¿A qué cuota corresponde? {exigeCuota ? `(obligatoria, 1 a ${Math.max(cuotas, 1)})` : "(opcional)"}
          </p>
          {cuotaInicial ? (
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Switch
                checked={editarCuota}
                onCheckedChange={setEditarCuota}
                className="h-4 w-7"
                aria-label="Habilitar edicion de la cuota"
              />
              <span>Editar</span>
            </label>
          ) : null}
        </div>
        <Input
          type="number"
          min="1"
          max={Math.max(cuotas, 1)}
          value={cuotaNum}
          disabled={!editarCuota}
          onChange={(e) => setCuotaNum(e.target.value)}
          className="h-9 text-xs"
        />
      </div>

      {/* 3. Documento: arrastrar/soltar o enlace */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">3. Sube tu archivo</p>
        {archivoSubido ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
            <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-emerald-800" title={archivoSubido}>{archivoSubido}</span>
            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0 text-emerald-700" title="Quitar archivo" onClick={quitarArchivo}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputFileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputFileRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
              arrastrando ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/40"
            }`}
          >
            {subiendo ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <FileUp className="h-5 w-5 text-muted-foreground" />
            )}
            <p className="text-xs font-semibold text-foreground">
              {subiendo ? "Subiendo documento..." : "Arrastra tu documento aquí o haz clic para subirlo"}
            </p>
            <p className="text-[10px] text-muted-foreground">PDF, imagen, Word o Excel · máximo 10 MB</p>
          </div>
        )}
        <input ref={inputFileRef} type="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" className="hidden" onChange={onFile} />

        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground">También puedes pegar un enlace del documento</p>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className="h-9 text-xs" />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground">Nombre (opcional)</p>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="OC 4501" className="h-9 text-xs" />
          </div>
          <Button type="button" size="sm" className="h-9" onClick={agregar}>
            <span>{botonLabel}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
