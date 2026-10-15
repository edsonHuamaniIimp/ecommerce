"use client";

import { useRef, useState } from "react";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@nrivera-iimp/ui-kit-iimp";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { TIPOS_ARCHIVO_IIMP, TIPOS_ARCHIVO_IIMP_CON_CUOTA, type TipoArchivoIImp } from "@/lib/shared/constants";
import type { ArchivoCuentaDTO, ArchivoIImpInputDTO } from "@/lib/client/api/services/pagos-service";

/** Etiquetas de las categorias de archivo de la cuenta corriente del IIMP. */
export const TIPOS_ARCHIVO_LABELS: Record<string, string> = {
  [TIPOS_ARCHIVO_IIMP.OC]: "Orden de compra (OC)",
  [TIPOS_ARCHIVO_IIMP.HES]: "Hoja de entrada de servicio (HES)",
  [TIPOS_ARCHIVO_IIMP.DETRACCION]: "Constancia de detracción",
  [TIPOS_ARCHIVO_IIMP.DIFERENCIA]: "Constancia de pago de la diferencia",
  [TIPOS_ARCHIVO_IIMP.PAGO_TOTAL]: "Constancia de pago total",
  [TIPOS_ARCHIVO_IIMP.VALORIZACION_COTIZACION]: "Valorización / cotización",
};

interface Props {
  /** Numero de cuotas de la reserva: acota el input de cuota. */
  cuotas: number;
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
 * categoria, cuota cuando aplica, link (subido o pegado) y nombre. Lo usan
 * "Registrar reserva" (documentos en la misma reserva) y el panel de documentos
 * de una cuenta ya creada. La lista de tipos es dinamica segun los pagos de la
 * cuota elegida: "pago total" es excluyente con "detraccion" y "diferencia".
 */
export function FormArchivoIImp({ cuotas, onAgregar, botonLabel = "Agregar", tiposPermitidos, archivosRegistrados }: Props) {
  const permitidos: readonly TipoArchivoIImp[] = tiposPermitidos ?? (Object.values(TIPOS_ARCHIVO_IIMP) as TipoArchivoIImp[]);
  const [tipo, setTipo] = useState<string>(permitidos[0] ?? TIPOS_ARCHIVO_IIMP.OC);
  const [cuotaNum, setCuotaNum] = useState("1");
  const [link, setLink] = useState("");
  const [nombre, setNombre] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const inputFileRef = useRef<HTMLInputElement>(null);

  /* Pagos ya registrados de la cuota elegida: si la cuota tiene "pago total" no se
     ofrecen detraccion/diferencia, y viceversa. La cuota 1 tambien requiere OC + HES. */
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
  /* Mientras un tipo de pago este seleccionado, su contraparte tampoco se ofrece en la lista. */
  const visibles = visiblesBase.filter((t) => {
    if (t === TIPOS_ARCHIVO_IIMP.PAGO_TOTAL) return tipoEfectivo !== TIPOS_ARCHIVO_IIMP.DETRACCION && tipoEfectivo !== TIPOS_ARCHIVO_IIMP.DIFERENCIA;
    if (t === TIPOS_ARCHIVO_IIMP.DETRACCION || t === TIPOS_ARCHIVO_IIMP.DIFERENCIA) return tipoEfectivo !== TIPOS_ARCHIVO_IIMP.PAGO_TOTAL;
    return true;
  });
  const exigeCuota = TIPOS_ARCHIVO_IIMP_CON_CUOTA.includes(tipoEfectivo as (typeof TIPOS_ARCHIVO_IIMP_CON_CUOTA)[number]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendo(true);
    try {
      const url = await uploadService.subir(file);
      setLink(url);
      if (!nombre.trim()) setNombre(file.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el archivo");
    } finally {
      setSubiendo(false);
    }
  };

  const agregar = () => {
    if (!link.trim()) {
      toast.error("Sube un archivo o pega su link");
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
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Tipo de documento</p>
          <Select value={tipoEfectivo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {visibles.map((t) => (
                <SelectItem key={t} value={t}>{TIPOS_ARCHIVO_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            {exigeCuota ? `Cuota (1 a ${Math.max(cuotas, 1)})` : "Cuota (opcional)"}
          </p>
          <Input
            type="number"
            min="1"
            max={Math.max(cuotas, 1)}
            value={cuotaNum}
            onChange={(e) => setCuotaNum(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground">Link del documento (http/https)</p>
        <div className="flex gap-2">
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://... o sube un archivo" />
          <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" disabled={subiendo} onClick={() => inputFileRef.current?.click()}>
            {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            <span>Subir</span>
          </Button>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Nombre (opcional)</p>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="OC 4501" />
        </div>
        <Button type="button" size="sm" className="h-9" onClick={agregar}>
          <span>{botonLabel}</span>
        </Button>
      </div>
      <input ref={inputFileRef} type="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => { void onFile(e); }} />
    </div>
  );
}
