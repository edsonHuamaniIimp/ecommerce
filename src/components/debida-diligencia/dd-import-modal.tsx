"use client";

import { useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nrivera-iimp/ui-kit-iimp";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import type { DdEmpresasImportResponseDTO } from "@/types/dto/debida-diligencia";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const CABECERAS = [
  "FECHA DE INGRESO SOLICITUD",
  "FECHA DE REVISIÓN POR SIG",
  "PERSONA JURIDICA / PERSONA NATURAL",
  "RUC / DNI / ID",
  "MOTIVO DE LA EVALUACIÓN",
  "EVENTO O PROYECTO ASOCIADO",
  "RESULTADO DE EVALUACIÓN DEBIDA DILIGENCIA",
];

export function DdImportModal({ open, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState<DdEmpresasImportResponseDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const descargarFormato = () => {
    const ejemplo = [
      CABECERAS.join(";"),
      "1/10/2026;2/10/2026;EMPRESA EJEMPLO S.A.C.;20549974342;EXHIBIDOR;PERUMIN;APTO",
    ].join("\n");
    const blob = new Blob([`\uFEFF${ejemplo}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "formato-importacion-dd.csv";
    enlace.click();
    URL.revokeObjectURL(url);
  };

  const importar = async () => {
    if (!file) {
      setError("Selecciona un archivo XLSX o CSV.");
      return;
    }
    setImporting(true);
    setError(null);
    setResultado(null);
    try {
      const respuesta = await debidaDiligenciaService.importarEmpresas(file);
      setResultado(respuesta);
      toast.success(`Importación completada: ${respuesta.importados} nuevos, ${respuesta.actualizados} actualizados.`);
      onImported();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo importar el archivo";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setImporting(false);
    }
  };

  const cerrar = () => {
    if (importing) return;
    setFile(null);
    setResultado(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(valor) => { if (!valor) cerrar(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Importación masiva de Debida Diligencia
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Sube la lista oficial en XLSX o CSV. El identificador debe ser RUC de 11 dígitos o RUT/identificador extranjero.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">Columnas requeridas</p>
            <p className="mt-1">
              Fecha de ingreso · Fecha de revisión · Razón social · RUC/RUT · Motivo · Evento/proyecto · Resultado DD
            </p>
            <p className="mt-2">
              Resultados aceptados: APTO, APTO CON OBSERVACIONES, NO APTO, EN REVISIÓN, EN PROCESO o DOCUMENTACIÓN OBSERVADA.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={descargarFormato}>
              <Download className="h-3.5 w-3.5" />
              <span>Descargar formato</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>{file ? "Cambiar archivo" : "Seleccionar archivo"}</span>
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const seleccionado = e.target.files?.[0] ?? null;
                e.target.value = "";
                setFile(seleccionado);
                setResultado(null);
                setError(null);
              }}
            />
          </div>
          {file ? <p className="text-[11px] text-foreground">{file.name}</p> : null}

          {resultado ? (
            <Alert className="border-success/40 bg-success/5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-xs">
                <p>
                  Nuevos: <strong>{resultado.importados}</strong> · Actualizados:{" "}
                  <strong>{resultado.actualizados}</strong> · Omitidos: <strong>{resultado.omitidos}</strong>
                </p>
                {resultado.errores.length > 0 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium text-warning">
                      {resultado.errores.length} fila(s) con error
                    </summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px]">
                      {resultado.errores.slice(0, 10).map((fila) => (
                        <li key={`${fila.fila}-${fila.documento}`}>
                          Fila {fila.fila}: {fila.mensaje} {fila.documento ? `(${fila.documento})` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={cerrar} disabled={importing}>
            <span>Cerrar</span>
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => void importar()} disabled={importing || !file}>
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            <span>Importar</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
