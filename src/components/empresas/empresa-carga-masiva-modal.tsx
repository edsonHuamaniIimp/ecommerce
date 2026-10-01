"use client";

import { useRef, useState } from "react";
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { BADGE_STYLES, CAMPOS_CARGA_EMPRESA, CARGA_MASIVA_EXTENSIONES, ESTADOS_FILA_CARGA } from "@/lib/shared/constants";
import type { FilaCargaEmpresaDTO, PrevisualizacionCargaEmpresasDTO } from "@/types/dto/empresas/carga-masiva.dto";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const EJEMPLO: Record<string, string> = {
  ruc: "20601234567",
  razonSocial: "Minera Cordillera S.A.C.",
  nombreComercial: "Minera Cordillera",
  direccionFiscal: "Av. Los Ingenieros 245, Lima",
  telefono: "+51 987 654 321",
  emailContacto: "contacto@mineracordillera.pe",
  emailFacturacion: "facturacion@mineracordillera.pe",
  representanteLegalNombre: "Jorge Quispe Ramos",
  representanteLegalDni: "45871233",
  tipoComprobante: "factura",
  sitioWeb: "www.mineracordillera.pe",
};

/** Valor CSV con comillas cuando contiene separador, comillas o salto. */
function csvCampo(valor: string): string {
  return /[",\n;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Descarga la plantilla CSV con los encabezados oficiales y una fila de ejemplo. */
function descargarPlantilla() {
  const encabezados = CAMPOS_CARGA_EMPRESA.map((c) => c.header).join(",");
  const ejemplo = CAMPOS_CARGA_EMPRESA.map((c) => csvCampo(EJEMPLO[c.campo] ?? "")).join(",");
  const csv = `\uFEFF${encabezados}\n${ejemplo}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-empresas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function EstadoFilaBadge({ estado }: { estado: string }) {
  if (estado === ESTADOS_FILA_CARGA.LISTA) {
    return (
      <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.SUCCESS}`}>
        <CheckCircle2 className="h-3 w-3" /><span>Lista</span>
      </Badge>
    );
  }
  if (estado === ESTADOS_FILA_CARGA.ADVERTENCIA) {
    return (
      <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.WARNING}`}>
        <AlertTriangle className="h-3 w-3" /><span>Advertencia</span>
      </Badge>
    );
  }
  return (
    <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}>
      <XCircle className="h-3 w-3" /><span>Error</span>
    </Badge>
  );
}

/** Carga masiva de empresas: archivo -> validacion previa -> importacion. */
export function EmpresaCargaMasivaModal({ onClose, onSaved }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previsualizacion, setPrevisualizacion] = useState<PrevisualizacionCargaEmpresasDTO | null>(null);
  const [validando, setValidando] = useState(false);
  const [importando, setImportando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validar = async (file: File) => {
    setValidando(true);
    setPrevisualizacion(null);
    try {
      const data = await empresasService.previsualizarCarga(file);
      setPrevisualizacion(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo validar el archivo");
      setArchivo(null);
    }
    setValidando(false);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setArchivo(file);
    void validar(file);
  };

  const importar = async () => {
    if (!previsualizacion) return;
    setImportando(true);
    try {
      const filas: FilaCargaEmpresaDTO[] = previsualizacion.filas;
      const resultado = await empresasService.importarCarga(filas);
      if (resultado.omitidas > 0) {
        toast.warning(`Se importaron ${resultado.creadas} empresas; ${resultado.omitidas} se omitieron por errores.`);
      } else {
        toast.success(`Se importaron ${resultado.creadas} empresas. Podras crear sus cuentas y enviar credenciales.`);
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar");
    }
    setImportando(false);
  };

  const resumen = previsualizacion?.resumen;
  const importables = resumen ? resumen.listas + resumen.advertencias : 0;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border pb-3 text-left">
          <DialogTitle className="text-base font-semibold">Carga masiva de empresas</DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Importa empresas desde Excel (.xlsx) o CSV. El sistema valida RUC, duplicados y formato antes de
            crear las cuentas; las filas con error no se importan.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
          {/* 1. Archivo */}
          <div className="rounded-lg border border-border p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">1. Archivo</p>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={descargarPlantilla}>
                <Download className="h-3.5 w-3.5" />
                <span>Descargar plantilla</span>
              </Button>
            </div>

            {!archivo ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed border-border bg-secondary/40 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <FileSpreadsheet className="h-6 w-6 text-primary/70" />
                <span className="text-xs font-semibold text-foreground">
                  Arrastra tu archivo o selecciona un Excel / CSV
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Formatos: {CARGA_MASIVA_EXTENSIONES.join(", ")} · maximo 5 MB y 500 filas
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{archivo.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{Math.round(archivo.size / 1024)} KB</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 shrink-0 p-0"
                  onClick={() => { setArchivo(null); setPrevisualizacion(null); }}
                  title="Quitar archivo"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
            />
          </div>

          {/* 2. Validacion previa */}
          {(validando || previsualizacion) && (
            <div className="rounded-lg border border-border p-4">
              <p className="mb-2 text-xs font-semibold text-foreground">2. Validacion previa</p>

              {validando ? (
                <p className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Validando archivo...
                </p>
              ) : previsualizacion && resumen && (
                <>
                  <div className="mb-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                    <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2">
                      <p className="font-mono text-lg font-bold text-success">{resumen.listas}</p>
                      <p className="text-[11px] text-muted-foreground">listas para importar</p>
                    </div>
                    <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2">
                      <p className="font-mono text-lg font-bold text-warning">{resumen.advertencias}</p>
                      <p className="text-[11px] text-muted-foreground">con advertencias</p>
                    </div>
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                      <p className="font-mono text-lg font-bold text-destructive">{resumen.errores}</p>
                      <p className="text-[11px] text-muted-foreground">con error (no se importan)</p>
                    </div>
                  </div>

                  <div className="max-h-[280px] overflow-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-14 text-[10px] uppercase tracking-wide">Fila</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wide">Razon social</TableHead>
                          <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">RUC</TableHead>
                          <TableHead className="w-32 text-[10px] uppercase tracking-wide">Estado</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wide">Detalle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previsualizacion.filas.map((fila) => (
                          <TableRow key={fila.numero}>
                            <TableCell className="font-mono text-[11px] text-muted-foreground">{fila.numero}</TableCell>
                            <TableCell className="max-w-[220px] truncate text-xs">{fila.razonSocial || "—"}</TableCell>
                            <TableCell className="hidden font-mono text-xs md:table-cell">{fila.ruc || "—"}</TableCell>
                            <TableCell><EstadoFilaBadge estado={fila.estado} /></TableCell>
                            <TableCell className="max-w-[320px] text-[11px] text-muted-foreground">
                              {fila.mensajes.length > 0 ? fila.mensajes.join(" · ") : "Datos completos"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-[11px] text-muted-foreground">
            Las empresas creadas recibiran sus credenciales por correo y validaran sus datos en el primer ingreso.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full px-4 text-xs" onClick={onClose} disabled={importando}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="rounded-full px-4 text-xs font-semibold"
              disabled={importando || !previsualizacion || importables === 0}
              onClick={importar}
            >
              {importando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
              {importando ? "Importando..." : `Importar ${importables} empresa${importables === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
