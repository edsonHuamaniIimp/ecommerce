"use client";

import { useRef, useState } from "react";
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, KeyRound, Loader2, Upload, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { empresasService } from "@/lib/client/api/services/empresas-service";
import { BADGE_STYLES, CARGA_MASIVA_EXTENSIONES, ESTADOS_FILA_CARGA } from "@/lib/shared/constants";
import type {
  FilaCargaEmpresaDTO,
  PrevisualizacionCargaEmpresasDTO,
  ResultadoCreacionCuentasEmpresasDTO,
  ResultadoImportacionEmpresasDTO,
} from "@/types/dto/empresas";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const EJEMPLO_RUC = "20601234567";

/** Descarga la plantilla CSV: solo la columna RUC (el resto se completa desde servicio-persona). */
function descargarPlantilla() {
  const csv = `\uFEFFRUC\n${EJEMPLO_RUC}\n`;
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

/** Carga masiva de empresas (solo RUC): archivo -> validacion previa -> importacion -> cuentas de acceso. */
export function EmpresaCargaMasivaModal({ onClose, onSaved }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previsualizacion, setPrevisualizacion] = useState<PrevisualizacionCargaEmpresasDTO | null>(null);
  const [validando, setValidando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacionEmpresasDTO | null>(null);
  const [creandoCuentas, setCreandoCuentas] = useState(false);
  const [cuentas, setCuentas] = useState<ResultadoCreacionCuentasEmpresasDTO | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validar = async (file: File) => {
    setValidando(true);
    setPrevisualizacion(null);
    setResultado(null);
    setCuentas(null);
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
      const data = await empresasService.importarCarga(filas);
      setResultado(data);
      onSaved();
      if (data.omitidas > 0) {
        toast.warning(`Se importaron ${data.creadas} empresas; ${data.omitidas} se omitieron.`);
      } else {
        toast.success(`Se importaron ${data.creadas} empresas.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar");
    }
    setImportando(false);
  };

  /** RUCs validos del archivo (los errores quedan fuera). */
  const rucsValidos = previsualizacion
    ? Array.from(new Set(
        previsualizacion.filas
          .filter((f) => f.estado !== ESTADOS_FILA_CARGA.ERROR)
          .map((f) => f.ruc.replace(/\D/g, ""))
          .filter(Boolean),
      ))
    : [];

  const crearCuentas = async () => {
    if (rucsValidos.length === 0) return;
    setCreandoCuentas(true);
    try {
      const data = await empresasService.crearCuentas(rucsValidos);
      setCuentas(data);
      onSaved();
      if (data.omitidas > 0) {
        toast.warning(`Se crearon ${data.creadas} cuentas; ${data.omitidas} no se pudieron crear.`);
      } else {
        toast.success(`Se crearon ${data.creadas} cuentas de acceso.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron crear las cuentas");
    }
    setCreandoCuentas(false);
  };

  /** Genera un Excel (.xlsx) con las cuentas creadas y sus contrasenas temporales. */
  const descargarCredenciales = async () => {
    if (!cuentas) return;
    const creadas = cuentas.resultados.filter((r) => r.creada);
    if (creadas.length === 0) return;
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Cuentas de acceso");
    ws.columns = [
      { header: "RUC", key: "ruc", width: 15 },
      { header: "RAZON SOCIAL", key: "razonSocial", width: 45 },
      { header: "USUARIO", key: "usuario", width: 15 },
      { header: "CONTRASENA TEMPORAL", key: "password", width: 22 },
    ];
    for (const r of creadas) {
      ws.addRow({
        ruc: r.ruc,
        razonSocial: r.razonSocial,
        usuario: r.usuario ?? r.ruc,
        password: r.passwordTemporal ?? "",
      });
    }
    ws.getRow(1).font = { bold: true };
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cuentas-acceso.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const cerrar = () => {
    onSaved();
    onClose();
  };

  const resumen = previsualizacion?.resumen;
  const importables = resumen ? resumen.listas + resumen.advertencias : 0;
  const cuentasCreadas = cuentas ? cuentas.resultados.filter((r) => r.creada) : [];

  return (
    <Dialog open onOpenChange={(v) => { if (!v) cerrar(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border pb-3 text-left">
          <DialogTitle className="text-base font-semibold">Carga masiva de empresas</DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Solo necesitas la columna <strong>RUC</strong>: el sistema completa la razon social y el contacto
            desde servicio-persona. Tambien acepta columnas adicionales (razon social, contacto, representante)
            si ya las tienes; las filas con error no se importan.
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
                disabled={Boolean(resultado)}
                className="flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed border-border bg-secondary/40 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
              >
                <FileSpreadsheet className="h-6 w-6 text-primary/70" />
                <span className="text-xs font-semibold text-foreground">
                  Arrastra tu archivo o selecciona un Excel / CSV con los RUC
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
                  disabled={Boolean(resultado)}
                  onClick={() => { setArchivo(null); setPrevisualizacion(null); setResultado(null); setCuentas(null); }}
                  title="Quitar archivo"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept={CARGA_MASIVA_EXTENSIONES.map((ext) => `.${ext}`).join(",")}
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
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Validando archivo y consultando servicio-persona...
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

          {/* 3. Cuentas de acceso */}
          {resultado && (
            <div className="rounded-lg border border-border p-4">
              <p className="mb-2 text-xs font-semibold text-foreground">3. Cuentas de acceso</p>

              {!cuentas ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Se importaron <strong>{resultado.creadas}</strong> empresa(s)
                    {resultado.omitidas > 0 ? ` (${resultado.omitidas} omitida(s))` : ""}. ¿Deseas crear ahora las
                    cuentas de acceso de estas {rucsValidos.length} empresa(s)?
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    La cuenta usa el RUC como usuario y una contrasena temporal que se mostrara una sola vez
                    (no se envian correos). Al primer ingreso el representante completa sus datos en el perfil.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="gap-1.5 text-xs" disabled={creandoCuentas || rucsValidos.length === 0} onClick={() => { void crearCuentas(); }}>
                      {creandoCuentas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                      <span>{creandoCuentas ? "Creando cuentas..." : `Si, crear ${rucsValidos.length} cuenta(s)`}</span>
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" disabled={creandoCuentas} onClick={cerrar}>
                      <span>Ahora no</span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Cuentas creadas: <strong>{cuentas.creadas}</strong>
                      {cuentas.omitidas > 0 ? ` · no creadas: ${cuentas.omitidas}` : ""}.
                      Anota o descarga las contrasenas: no se muestran de nuevo.
                    </p>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={cuentasCreadas.length === 0} onClick={() => { void descargarCredenciales(); }}>
                      <Download className="h-3.5 w-3.5" />
                      <span>Descargar Excel (cuentas)</span>
                    </Button>
                  </div>
                  <div className="max-h-[280px] overflow-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] uppercase tracking-wide">Empresa</TableHead>
                          <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">RUC</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wide">Usuario</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wide">Contrasena temporal</TableHead>
                          <TableHead className="w-24 text-[10px] uppercase tracking-wide">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cuentas.resultados.map((r) => (
                          <TableRow key={r.ruc}>
                            <TableCell className="max-w-[220px] truncate text-xs">{r.razonSocial || "—"}</TableCell>
                            <TableCell className="hidden font-mono text-xs md:table-cell">{r.ruc}</TableCell>
                            <TableCell className="font-mono text-xs">{r.creada ? (r.usuario ?? r.ruc) : "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{r.creada ? (r.passwordTemporal ?? "—") : "—"}</TableCell>
                            <TableCell>
                              {r.creada ? (
                                <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}><span>Creada</span></Badge>
                              ) : (
                                <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}><span>{r.error ?? "Error"}</span></Badge>
                              )}
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
            Sin envio de correos: las credenciales se entregan manualmente al representante.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full px-4 text-xs" onClick={cerrar} disabled={importando || creandoCuentas}>
              {resultado ? "Cerrar" : "Cancelar"}
            </Button>
            {!resultado && (
              <Button
                size="sm"
                className="rounded-full px-4 text-xs font-semibold"
                disabled={importando || !previsualizacion || importables === 0}
                onClick={importar}
              >
                {importando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                {importando ? "Importando..." : `Importar ${importables} empresa${importables === 1 ? "" : "s"}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
