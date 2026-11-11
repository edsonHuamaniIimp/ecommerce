"use client";

import { useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nrivera-iimp/ui-kit-iimp";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  BADGE_STYLES,
  DD_MATRIZ_ADJUNTO_EXTENSIONES,
  DD_MATRIZ_SI_NO_NA,
  DD_MATRIZ_SI_NO_NA_LABELS,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_REPOSITORIO_IMPORT_ACCEPT,
  DD_REPOSITORIO_IMPORT_CATEGORIAS,
  DD_REPOSITORIO_IMPORT_EXTENSIONES,
  DD_REPOSITORIO_IMPORT_FORMATOS,
  DD_REPOSITORIO_IMPORT_MAX_ARCHIVOS,
  DD_REPOSITORIO_IMPORT_NOMENCLATURA,
  type DdMatrizTipoVinculo,
} from "@/lib/shared/constants";
import { ddClasificarArchivosService } from "@/lib/client/api/services/dd-clasificar-archivos-service";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import { archivoUtils } from "@/lib/shared/utils/archivo";
import {
  clasificarNombreArchivo,
  validarNomenclaturaArchivo,
  type ImportacionVinculo,
} from "@/lib/shared/utils/dd-repositorio-import";

interface ImportacionEmpresa {
  id: string;
  razonSocial: string;
  ruc: string;
  codigo: string;
}

interface Props {
  empresa: ImportacionEmpresa;
  vinculos: ImportacionVinculo[];
  onImported: () => void;
}

interface Sugerencia {
  vinculoId: string | null;
  categoria: string;
  confianza: number;
  motivo: string;
  origen: "ia" | "reglas";
}

interface ArchivoImportar {
  id: string;
  file: File;
  validacion: ReturnType<typeof validarNomenclaturaArchivo>;
  formatoValido: boolean;
  vinculoId: string;
  categoria: string;
  sugerencia: Sugerencia;
  estado: "pendiente" | "subiendo" | "ok" | "error";
  error?: string;
}

function iconoArchivo(nombre: string) {
  const ext = archivoUtils.extensionDeArchivo(nombre);
  if (ext === DD_REPOSITORIO_IMPORT_EXTENSIONES.ZIP) return <FileArchive className="h-4 w-4 text-amber-600" />;
  if (ext === DD_REPOSITORIO_IMPORT_EXTENSIONES.XLSX) return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
  return <FileText className="h-4 w-4 text-red-600" />;
}

function tipoArchivo(nombre: string): string {
  const ext = archivoUtils.extensionDeArchivo(nombre);
  return ext ? ext.toUpperCase() : "SIN EXT.";
}

function etiquetaVinculo(vinculo: ImportacionVinculo): string {
  const tipo = DD_MATRIZ_TIPO_VINCULO_LABELS[vinculo.tipo as DdMatrizTipoVinculo] ?? vinculo.tipo;
  return `${tipo}: ${vinculo.nombre}`;
}

function formatoArchivoValido(nombre: string): boolean {
  const extension = archivoUtils.extensionDeArchivo(nombre);
  return (DD_MATRIZ_ADJUNTO_EXTENSIONES as readonly string[]).includes(extension);
}

function crearArchivos(lista: File[], vinculos: ImportacionVinculo[]): ArchivoImportar[] {
  return lista.slice(0, DD_REPOSITORIO_IMPORT_MAX_ARCHIVOS).map((file) => {
    const clasificacion = clasificarNombreArchivo(file.name, vinculos);
    return {
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      validacion: validarNomenclaturaArchivo(file.name),
      formatoValido: formatoArchivoValido(file.name),
      vinculoId: clasificacion.vinculoId ?? vinculos[0]?.id ?? "",
      categoria: clasificacion.categoria,
      sugerencia: {
        vinculoId: clasificacion.vinculoId,
        categoria: clasificacion.categoria,
        confianza: 0.45,
        motivo: clasificacion.motivo,
        origen: "reglas" as const,
      },
      estado: "pendiente" as const,
    };
  });
}

export function DdImportarCarpeta({ empresa, vinculos, onImported }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [iniciales, setIniciales] = useState<File[]>([]);
  const [arrastrandoPanel, setArrastrandoPanel] = useState(false);

  const abrirImportacion = (files: File[] = []) => {
    if (vinculos.length === 0) {
      toast.error("La empresa no tiene vínculos de matriz disponibles.");
      return;
    }
    setIniciales(files);
    setAbierto(true);
  };

  return (
    <>
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <CloudUpload className="h-4 w-4 text-primary" />
              <span>Importar carpeta</span>
            </CardTitle>
            <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.INFO}`}><span>Carga masiva</span></Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{empresa.razonSocial}</span> · RUC {empresa.ruc} · {empresa.codigo}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => abrirImportacion()}
            onKeyDown={(evento) => { if (evento.key === "Enter" || evento.key === " ") abrirImportacion(); }}
            onDragOver={(evento) => { evento.preventDefault(); setArrastrandoPanel(true); }}
            onDragLeave={() => setArrastrandoPanel(false)}
            onDrop={(evento) => {
              evento.preventDefault();
              setArrastrandoPanel(false);
              abrirImportacion(Array.from(evento.dataTransfer.files));
            }}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition ${arrastrandoPanel ? "border-primary bg-primary/5" : "border-border bg-secondary/20 hover:border-primary hover:bg-primary/5"}`}
          >
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
              <CloudUpload className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-foreground">Arrastra y suelta la carpeta aquí</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">o haz clic para abrir el proceso de importación</p>
            <span className="mt-2 inline-block rounded bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {DD_REPOSITORIO_IMPORT_FORMATOS.join(", ")}
            </span>
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
              <Info className="h-3.5 w-3.5" />
              <span>Nomenclatura recomendada</span>
            </div>
            <code className="block rounded bg-card px-2 py-1 font-mono text-[10px] text-primary">
              {DD_REPOSITORIO_IMPORT_NOMENCLATURA}
            </code>
          </div>

          <div className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>El asistente opcional solo analiza nombres de archivo, nunca su contenido.</span>
          </div>

          <Button type="button" className="w-full gap-1.5 text-xs" onClick={() => abrirImportacion()} disabled={vinculos.length === 0}>
            <CloudUpload className="h-4 w-4" />
            <span>Abrir importación</span>
          </Button>
        </CardContent>
      </Card>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-base font-semibold">Importar carpeta de evidencias</DialogTitle>
              <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.NEUTRAL}`}><span>Evidencias de matriz</span></Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {empresa.razonSocial} · RUC {empresa.ruc} · {empresa.codigo}
            </p>
          </DialogHeader>

          <ContenidoImportacion
            empresa={empresa}
            vinculos={vinculos}
            initialFiles={iniciales}
            onImported={onImported}
            onClose={() => setAbierto(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContenidoImportacion({
  empresa,
  vinculos,
  initialFiles,
  onImported,
  onClose,
}: Props & { initialFiles: File[]; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<ArchivoImportar[]>(() => crearArchivos(initialFiles, vinculos));
  const [arrastrando, setArrastrando] = useState(false);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [usarIA, setUsarIA] = useState(true);
  const [aceptoClasificacion, setAceptoClasificacion] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });

  const pendientes = useMemo(() => archivos.filter((archivo) => archivo.estado !== "ok"), [archivos]);
  const hayFormatoInvalido = archivos.some((archivo) => !archivo.formatoValido);
  const hayError = archivos.some((archivo) => archivo.estado === "error");

  const abrirSelector = () => {
    const input = inputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.click();
  };

  const seleccionar = (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    const nuevos = crearArchivos(Array.from(lista), vinculos);
    setArchivos(nuevos);
    setAceptoClasificacion(false);
    toast.info(`${nuevos.length} archivo(s) cargados para revisar.`);
  };

  const actualizar = (id: string, cambios: Partial<ArchivoImportar>) => {
    setArchivos((previo) => previo.map((archivo) => (archivo.id === id ? { ...archivo, ...cambios } : archivo)));
    setAceptoClasificacion(false);
  };

  const quitar = (id: string) => {
    setArchivos((previo) => previo.filter((archivo) => archivo.id !== id));
    setAceptoClasificacion(false);
  };

  const sugerirConIA = async () => {
    if (archivos.length === 0) {
      toast.info("Selecciona una carpeta primero.");
      return;
    }
    if (!usarIA) {
      toast.info("Activa el asistente para generar sugerencias.");
      return;
    }
    setSugiriendo(true);
    try {
      const respuesta = await ddClasificarArchivosService.clasificar({
        empresa: { id: empresa.id, razonSocial: empresa.razonSocial, ruc: empresa.ruc },
        vinculos,
        archivos: archivos.map((archivo) => ({ nombre: archivo.file.name })),
      });
      const porIndice = new Map(respuesta.sugerencias.map((sugerencia) => [sugerencia.indice, sugerencia]));
      setArchivos((previo) => previo.map((archivo, indice) => {
        const sugerencia = porIndice.get(indice);
        if (!sugerencia) return archivo;
        return {
          ...archivo,
          vinculoId: sugerencia.vinculoId ?? archivo.vinculoId,
          categoria: sugerencia.categoria,
          sugerencia: {
            vinculoId: sugerencia.vinculoId,
            categoria: sugerencia.categoria,
            confianza: sugerencia.confianza,
            motivo: sugerencia.motivo,
            origen: respuesta.origen,
          },
        };
      }));
      setAceptoClasificacion(false);
      toast.info(
        respuesta.origen === "ia"
          ? "Sugerencias de IA aplicadas. Revisa y acepta antes de importar."
          : "IA no configurada: se aplicaron sugerencias por reglas. Revisa y acepta antes de importar.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron generar sugerencias.");
    } finally {
      setSugiriendo(false);
    }
  };

  const importar = async () => {
    if (pendientes.length === 0) {
      toast.info("No hay archivos pendientes por importar.");
      return;
    }
    if (hayFormatoInvalido) {
      toast.error("Corrige o quita los archivos con formato no permitido.");
      return;
    }
    if (!aceptoClasificacion) {
      toast.error("Debes revisar y aceptar la clasificación antes de importar.");
      return;
    }
    if (pendientes.some((archivo) => !archivo.vinculoId || !archivo.categoria)) {
      toast.error("Completa el vínculo y la categoría de todos los archivos.");
      return;
    }

    setImportando(true);
    setProgreso({ actual: 0, total: pendientes.length });
    let importados = 0;
    let fallidos = 0;

    for (const [indice, archivo] of pendientes.entries()) {
      actualizar(archivo.id, { estado: "subiendo", error: undefined });
      try {
        await ddMatrizEvaluacionService.subirAdjunto(archivo.vinculoId, archivo.categoria, archivo.file);
        actualizar(archivo.id, { estado: "ok", error: undefined });
        importados += 1;
      } catch (error) {
        actualizar(archivo.id, {
          estado: "error",
          error: error instanceof Error ? error.message : "No se pudo importar.",
        });
        fallidos += 1;
      } finally {
        setProgreso({ actual: indice + 1, total: pendientes.length });
      }
    }

    setImportando(false);
    if (importados > 0) {
      toast.success(`${importados} archivo(s) importados a ${empresa.razonSocial}.`);
      onImported();
    }
    if (fallidos > 0) {
      toast.error(`${fallidos} archivo(s) no se pudieron importar. Revisa el detalle.`);
    }
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                  <span className="text-xs font-semibold text-foreground">{archivos.length > 0 ? "Carpeta cargada" : "Selecciona la carpeta"}</span>
                </div>
                {archivos.length > 0 ? <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.SUCCESS}`}><span>{archivos.length} archivo(s)</span></Badge> : null}
              </header>
              <div className="p-3">
                {archivos.length === 0 ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={abrirSelector}
                    onKeyDown={(evento) => { if (evento.key === "Enter" || evento.key === " ") abrirSelector(); }}
                    onDragOver={(evento) => { evento.preventDefault(); setArrastrando(true); }}
                    onDragLeave={() => setArrastrando(false)}
                    onDrop={(evento) => { evento.preventDefault(); setArrastrando(false); seleccionar(evento.dataTransfer.files); }}
                    className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition ${arrastrando ? "border-primary bg-primary/5" : "border-border bg-secondary/20 hover:border-primary hover:bg-primary/5"}`}
                  >
                    <CloudUpload className="mx-auto mb-1.5 h-5 w-5 text-primary" />
                    <p className="text-[11px] font-semibold text-foreground">Arrastra tu carpeta aquí</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">o haz clic para examinar</p>
                    <p className="mt-1 font-mono text-[9px] text-muted-foreground">{DD_REPOSITORIO_IMPORT_FORMATOS.join(" · ")}</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <FolderOpen className="h-4 w-4 shrink-0 text-emerald-600" />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-foreground">Carpeta lista para revisar</p>
                        <p className="text-[10px] text-muted-foreground">Puedes cambiar la carpeta si te equivocaste.</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 text-[10px]" onClick={abrirSelector} disabled={importando}>
                      <span>Cambiar</span>
                    </Button>
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <Info className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Regla de nomenclatura</span>
              </header>
              <div className="space-y-2 p-3">
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  El prefijo numérico permite clasificar mejor las evidencias.
                </p>
                <code className="block rounded-md border border-border bg-secondary/40 px-2 py-1.5 font-mono text-[10px] text-primary">
                  {DD_REPOSITORIO_IMPORT_NOMENCLATURA}
                </code>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Formatos válidos: <span className="font-mono text-foreground">{DD_MATRIZ_ADJUNTO_EXTENSIONES.join(", ")}</span>.
                </p>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
              <span className="text-xs font-semibold text-foreground">Revisa y acepta la clasificación</span>
            </div>
            <Badge className={`pointer-events-none text-[9px] ${archivos.length > 0 ? BADGE_STYLES.INFO : BADGE_STYLES.NEUTRAL}`}>
              <span>{archivos.length} archivo(s)</span>
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-[11px] font-semibold text-foreground">Asistente de clasificación opcional</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                  Analiza solo los <strong>nombres de archivo</strong>, nunca su contenido.
                </p>
              </div>
            </div>
            <label className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-foreground">
              <Checkbox checked={usarIA} onCheckedChange={(valor) => setUsarIA(valor === true)} />
              <span>Usar IA</span>
            </label>
            <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 gap-1.5 text-[10px]" onClick={() => void sugerirConIA()} disabled={archivos.length === 0 || sugiriendo || importando || !usarIA}>
              {sugiriendo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              <span>Sugerir clasificación</span>
            </Button>
          </div>

          {archivos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <FolderOpen className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-xs font-medium text-foreground">Aún no hay archivos seleccionados</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Selecciona una carpeta para comenzar.</p>
            </div>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {archivos.map((archivo) => (
                <div key={archivo.id} className={`overflow-hidden rounded-xl border bg-card ${archivo.formatoValido ? "border-border" : "border-destructive/30"}`}>
                  <div className="flex items-start justify-between gap-2 p-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary">
                        {iconoArchivo(archivo.file.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground" title={archivo.file.name}>{archivo.file.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge className={`pointer-events-none text-[9px] ${archivo.formatoValido ? BADGE_STYLES.NEUTRAL : BADGE_STYLES.DESTRUCTIVE}`}>
                            <span>{archivo.formatoValido ? tipoArchivo(archivo.file.name) : "Formato no permitido"}</span>
                          </Badge>
                          <Badge className={`pointer-events-none text-[9px] ${archivo.validacion.cumple ? BADGE_STYLES.SUCCESS : BADGE_STYLES.WARNING}`}>
                            <span>{archivo.validacion.cumple ? "Nomenclatura OK" : "Revisar nomenclatura"}</span>
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0 text-muted-foreground" onClick={() => quitar(archivo.id)} disabled={importando} aria-label={`Quitar ${archivo.file.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {!archivo.formatoValido ? (
                    <div className="mx-3 mb-2 flex items-start gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-[10px] text-destructive">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>Usa un archivo PDF, JPG, PNG o DOCX. Este archivo no se puede importar.</span>
                    </div>
                  ) : null}
                  {!archivo.validacion.cumple ? (
                    <div className="mx-3 mb-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-2 text-[10px] text-amber-800">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{archivo.validacion.detalle} Puedes continuar, pero corrige el nombre si es posible.</span>
                    </div>
                  ) : null}

                  <div className="grid gap-2 border-t border-border bg-secondary/20 p-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Vínculo</p>
                      <Select value={archivo.vinculoId} onValueChange={(value) => actualizar(archivo.id, { vinculoId: value })} disabled={importando || archivo.estado === "ok"}>
                        <SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Selecciona un vínculo" /></SelectTrigger>
                        <SelectContent>
                          {vinculos.map((vinculo) => (
                            <SelectItem key={vinculo.id} value={vinculo.id}><span>{etiquetaVinculo(vinculo)}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Campo / categoría</p>
                      <Select value={archivo.categoria} onValueChange={(value) => actualizar(archivo.id, { categoria: value })} disabled={importando || archivo.estado === "ok"}>
                        <SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                        <SelectContent>
                          {DD_REPOSITORIO_IMPORT_CATEGORIAS.map((categoria) => (
                            <SelectItem key={categoria.value} value={categoria.value}><span>{categoria.label}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Sparkles className="h-3 w-3 shrink-0 text-primary" />
                      <p className="truncate text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground">{archivo.sugerencia.origen === "ia" ? "IA" : "Reglas"}</span> · {Math.round(archivo.sugerencia.confianza * 100)}% · {archivo.sugerencia.motivo}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[10px] text-primary" onClick={() => actualizar(archivo.id, { vinculoId: archivo.sugerencia.vinculoId ?? archivo.vinculoId, categoria: archivo.sugerencia.categoria })} disabled={importando || archivo.estado === "ok"}>
                      <Wand2 className="h-3 w-3" />
                      <span>Aplicar sugerencia</span>
                    </Button>
                  </div>

                  {archivo.estado === "subiendo" ? <p className="flex items-center gap-1 border-t border-border px-3 py-2 text-[10px] text-primary"><Loader2 className="h-3 w-3 animate-spin" /> Importando...</p> : null}
                  {archivo.estado === "ok" ? <p className="flex items-center gap-1 border-t border-border px-3 py-2 text-[10px] font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Importado</p> : null}
                  {archivo.error ? <p className="border-t border-border px-3 py-2 text-[10px] text-destructive">{archivo.error}</p> : null}
                </div>
              ))}
            </div>
          )}

          <label className={`flex items-start gap-2 rounded-xl border p-3 text-[11px] ${aceptoClasificacion ? "border-emerald-200 bg-emerald-50/40" : "border-border bg-secondary/30"}`}>
            <Checkbox checked={aceptoClasificacion} onCheckedChange={(valor) => setAceptoClasificacion(valor === true)} disabled={importando || archivos.length === 0 || hayFormatoInvalido} className="mt-0.5" />
            <span className="leading-relaxed text-foreground">He revisado los archivos y acepto la clasificación de vínculo y categoría para importarlos.</span>
          </label>

          {hayError ? <p className="text-[10px] text-destructive">Hay archivos con error. Puedes reintentar los pendientes.</p> : null}

          <div className="rounded-r-lg border-l-[3px] border-secondary bg-amber-50/60 p-2.5">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">Nota institucional:</strong> cada campo aplicable de la matriz exige archivo o link obligatorio; el estatus{" "}
              <span className="font-mono text-[11px] font-bold text-foreground">{DD_MATRIZ_SI_NO_NA_LABELS[DD_MATRIZ_SI_NO_NA.NA]}</span> debe estar formalmente eximido por Oficialía de Cumplimiento.
            </p>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={DD_REPOSITORIO_IMPORT_ACCEPT}
        className="hidden"
        onChange={(evento) => { seleccionar(evento.target.files); evento.target.value = ""; }}
      />

      <DialogFooter className="shrink-0 gap-2 border-t border-border px-5 py-3">
        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={onClose} disabled={importando}>
          <span>Cancelar</span>
        </Button>
        <Button type="button" size="sm" className="gap-1.5 text-xs" onClick={() => void importar()} disabled={importando || pendientes.length === 0 || vinculos.length === 0 || !aceptoClasificacion || hayFormatoInvalido}>
          {importando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          <span>{importando ? `Importando ${progreso.actual}/${progreso.total}...` : `Importar ${pendientes.length} evidencia${pendientes.length === 1 ? "" : "s"}`}</span>
        </Button>
      </DialogFooter>
    </>
  );
}
