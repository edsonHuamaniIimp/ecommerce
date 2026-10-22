"use client";

import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, CheckCircle2, Info, Loader2, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DdReputacionBadge } from "./dd-estado-badge";
import { DdRadioIndicator } from "./dd-radio-indicator";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import {
  BADGE_STYLES,
  DD_PER_PAGE_DEFAULT,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_FILTROS,
  DD_REPUTACION_RESULTADO_LABELS,
  DD_REPUTACION_RESULTADOS,
  PER_PAGE_OPCIONES,
  type DdReputacionResultado,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import type { DdReputacionResponseDTO, DdReputacionRowDTO } from "@/types/dto/debida-diligencia";

/** Bandeja de revision reputacional del area de Comunicaciones. */
export function DdReputacion() {
  const [data, setData] = useState<DdReputacionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<string>(DD_REPUTACION_ESTADOS.POR_REVISAR);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DD_PER_PAGE_DEFAULT);
  const [seleccionado, setSeleccionado] = useState<DdReputacionRowDTO | null>(null);
  const [resultado, setResultado] = useState<DdReputacionResultado | "">("");
  const [comentario, setComentario] = useState("");
  const [linkHallazgos, setLinkHallazgos] = useState("");
  const [notificar, setNotificar] = useState(true);
  const [guardando, setGuardando] = useState<"guardar" | "cerrar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (overrides?: Partial<{ page: number; perPage: number; search: string; estado: string }>) => {
    const actual = { page, perPage, search, estado, ...overrides };
    try {
      const respuesta = await debidaDiligenciaService.reputacionListar({
        page: actual.page,
        perPage: actual.perPage,
        search: actual.search.trim() || undefined,
        estado: actual.estado,
      });
      setData(respuesta);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la revisión reputacional");
    } finally {
      setLoading(false);
    }
  };

  const recargar = (overrides?: Partial<{ page: number; perPage: number; search: string; estado: string }>) => {
    setLoading(true);
    void load(overrides);
  };

  useEffect(() => {
    let activo = true;
    debidaDiligenciaService
      .reputacionListar({ page: 1, perPage: DD_PER_PAGE_DEFAULT, estado: DD_REPUTACION_ESTADOS.POR_REVISAR })
      .then((r) => { if (activo) setData(r); })
      .catch((err) => {
        if (activo) toast.error(err instanceof Error ? err.message : "No se pudo cargar la revisión reputacional");
      })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, []);

  const seleccionar = (fila: DdReputacionRowDTO) => {
    setSeleccionado(fila);
    setResultado(fila.resultado ?? "");
    setComentario(fila.comentario ?? "");
    setLinkHallazgos(fila.linkHallazgos ?? "");
    setError(null);
  };

  const resolver = async (cerrar: boolean) => {
    if (!seleccionado) return;
    if (!resultado) {
      setError("Selecciona un resultado para la revisión.");
      return;
    }
    if (resultado === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS && !linkHallazgos.trim()) {
      setError("El link de sustento es obligatorio cuando hay hallazgos.");
      return;
    }
    setGuardando(cerrar ? "cerrar" : "guardar");
    setError(null);
    try {
      await debidaDiligenciaService.reputacionResolver({
        id: seleccionado.id,
        resultado,
        comentario: comentario.trim() || null,
        linkHallazgos: resultado === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS ? linkHallazgos.trim() : null,
        cerrar,
        notificar,
      });
      toast.success(cerrar ? "Caso cerrado" : "Resultado guardado");
      setSeleccionado(null);
      setResultado("");
      setComentario("");
      setLinkHallazgos("");
      recargar();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "No se pudo guardar el resultado";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(null);
    }
  };

  const cambiarFiltro = (valor: string) => {
    setEstado(valor);
    setPage(1);
    setSeleccionado(null);
    recargar({ estado: valor, page: 1 });
  };

  const cerrada = seleccionado?.estado === DD_REPUTACION_ESTADOS.CERRADA;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Revisión reputacional</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Comunicaciones
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Nombres derivados por Logística para evaluación de imagen y reputación.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {data?.total ?? 0} solicitud(es)
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 border-b border-border pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:flex-1">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa, nombre o solicitud..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPage(1);
                      recargar({ search: e.currentTarget.value, page: 1 });
                    }
                  }}
                  className="h-8 border-border bg-secondary pl-8 text-xs placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
              <Select value={String(perPage)} onValueChange={(valor) => { const n = Number(valor); setPerPage(n); setPage(1); recargar({ perPage: n, page: 1 }); }}>
                <SelectTrigger className="h-8 w-[80px] shrink-0 border-border text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPCIONES.map((n) => (
                    <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar casos reputacionales">
              {DD_REPUTACION_FILTROS.map((filtro) => {
                const activo = estado === filtro.value;
                return (
                  <Button
                    key={filtro.value}
                    type="button"
                    size="sm"
                    variant={activo ? "default" : "outline"}
                    className="h-7 rounded-full px-3 text-[11px]"
                    onClick={() => cambiarFiltro(filtro.value)}
                  >
                    <span>{filtro.label}</span>
                  </Button>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-4">
            {loading ? (
              <TableSkeleton rows={perPage} columns={6} />
            ) : !data || data.data.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No hay solicitudes en este filtro.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Logística deriva los nombres al resolver la revisión de documentos.
                </p>
              </div>
            ) : (
              <>
                <Accordion type="multiple" className="space-y-2">
                  {data.data.map((grupo) => (
                    <AccordionItem
                      key={grupo.expedienteId}
                      value={grupo.expedienteId}
                      className="rounded-xl border border-border bg-card px-3"
                    >
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex w-full flex-wrap items-center justify-between gap-2 pr-2 text-left">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {grupo.empresa.razonSocial}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {grupo.codigo} · {grupo.totalCasos} nombre(s)
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {grupo.pendientes > 0 ? (
                              <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.WARNING}`}>
                                <span>{grupo.pendientes} pendiente(s)</span>
                              </Badge>
                            ) : null}
                            {grupo.cerrados > 0 ? (
                              <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.SUCCESS}`}>
                                <span>{grupo.cerrados} cerrado(s)</span>
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[10px] uppercase tracking-wide">Nombre</TableHead>
                                <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Sitio web</TableHead>
                                <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Derivado por</TableHead>
                                <TableHead className="hidden text-[10px] uppercase tracking-wide sm:table-cell">Fecha</TableHead>
                                <TableHead className="text-[10px] uppercase tracking-wide">Estado</TableHead>
                                <TableHead className="text-right text-[10px] uppercase tracking-wide">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {grupo.casos.map((fila) => (
                                <TableRow key={fila.id} className={seleccionado?.id === fila.id ? "bg-primary/5" : undefined}>
                                  <TableCell className="max-w-[250px]">
                                    <p className="truncate text-xs font-semibold text-foreground">{fila.nombreARevisar}</p>
                                  </TableCell>
                                  <TableCell className="hidden max-w-[160px] truncate text-xs md:table-cell">
                                    {fila.sitioWeb ? (
                                      <a href={fila.sitioWeb} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                                        {fila.sitioWeb.replace(/^https?:\/\//, "")}
                                      </a>
                                    ) : (
                                      <span className="text-muted-foreground">Sin web</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden max-w-[150px] truncate text-[11px] text-muted-foreground lg:table-cell">{fila.derivadoPor}</TableCell>
                                  <TableCell className="hidden text-[11px] text-muted-foreground sm:table-cell">{dateUtils.format(fila.fechaDerivacion)}</TableCell>
                                  <TableCell><DdReputacionBadge estado={fila.estado} /></TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-[11px]"
                                      onClick={() => seleccionar(fila)}
                                    >
                                      <span>{fila.estado === DD_REPUTACION_ESTADOS.CERRADA ? "Ver" : "Revisar"}</span>
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-muted-foreground">
                    {data.total} solicitud(es) · página {data.page} de {data.totalPages || 1}
                  </span>
                  <Pagination
                    page={data.page}
                    totalPages={data.totalPages}
                    onPageChange={(p) => { setPage(p); recargar({ page: p }); }}
                  />
                </div>
                <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-muted-foreground">
                    {data.total} casos — página {data.page} de {data.totalPages || 1}
                  </span>
                  <Pagination
                    page={data.page}
                    totalPages={data.totalPages}
                    onPageChange={(p) => { setPage(p); recargar({ page: p }); }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit xl:sticky xl:top-16">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle><span className="text-sm font-bold text-primary">Detalle del caso</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {!seleccionado ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ShieldAlert className="h-7 w-7 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Selecciona un caso para revisar su resultado.</p>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-foreground">{seleccionado.nombreARevisar}</p>
                    <DdReputacionBadge estado={seleccionado.estado} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Caso {seleccionado.codigo} · {seleccionado.empresa.razonSocial}
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3 text-[11px]">
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Nombre a evaluar</span>
                    <span className="text-right font-medium text-foreground">{seleccionado.nombreARevisar}</span>
                  </p>
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Sitio web</span>
                    <span className="text-right font-medium text-foreground">
                      {seleccionado.sitioWeb ? (
                        <a href={seleccionado.sitioWeb} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                          {seleccionado.sitioWeb.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        "No declarado"
                      )}
                    </span>
                  </p>
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Derivado por</span>
                    <span className="text-right font-medium text-foreground">{seleccionado.derivadoPor}</span>
                  </p>
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Fecha</span>
                    <span className="text-right font-medium text-foreground">{dateUtils.format(seleccionado.fechaDerivacion)}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs"><span>Resultado de la revisión</span></Label>
                  <RadioGroup
                    value={resultado || undefined}
                    onValueChange={(valor) => { setResultado(valor as DdReputacionResultado); setError(null); }}
                    className="space-y-1.5"
                    disabled={cerrada}
                  >
                    {Object.values(DD_REPUTACION_RESULTADOS).map((opcion) => (
                      <label key={opcion} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 ${resultado === opcion ? "border-primary bg-secondary" : "border-border bg-card"}`}>
                        <RadioGroupItem value={opcion} className="peer sr-only" />
                        <DdRadioIndicator selected={resultado === opcion} className="peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                        <span className="text-[11px] font-medium text-foreground">{DD_REPUTACION_RESULTADO_LABELS[opcion]}</span>
                        {opcion === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS ? <AlertTriangle className="ml-auto h-3.5 w-3.5 text-destructive" /> : null}
                        {opcion === DD_REPUTACION_RESULTADOS.SIN_HALLAZGOS ? <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-success" /> : null}
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs"><span>Comentario para Logística</span></Label>
                  <Textarea
                    value={comentario}
                    onChange={(e) => { setComentario(e.target.value); setError(null); }}
                    placeholder="Detalle los hallazgos o la información requerida..."
                    className="min-h-24 text-xs"
                    disabled={cerrada}
                  />
                  {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
                </div>

                {resultado === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS ? (
                  <div className="space-y-2">
                    <Label className="text-xs">
                      <span>Link de sustento de hallazgos <span className="text-destructive">*</span></span>
                    </Label>
                    <Input
                      type="url"
                      value={linkHallazgos}
                      onChange={(e) => { setLinkHallazgos(e.target.value); setError(null); }}
                      placeholder="https://drive.google.com/..."
                      className="h-9 text-sm"
                      disabled={cerrada}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Adjunta el enlace de Drive con la evidencia de los hallazgos.
                    </p>
                  </div>
                ) : null}

                {seleccionado.estado !== DD_REPUTACION_ESTADOS.CERRADA ? (
                  <label className="flex items-start gap-2">
                    <Checkbox checked={notificar} onCheckedChange={(valor) => setNotificar(valor === true)} className="mt-0.5" />
                    <span className="text-[11px] leading-relaxed text-muted-foreground">Notificar a Logística al guardar</span>
                  </label>
                ) : null}

                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  {!cerrada ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5 text-xs"
                        disabled={guardando !== null}
                        onClick={() => void resolver(false)}
                      >
                        {guardando === "guardar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        <span>Guardar</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={guardando !== null}
                        onClick={() => void resolver(true)}
                      >
                        {guardando === "cerrar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        <span>Cerrar caso</span>
                      </Button>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Caso cerrado {dateUtils.format(seleccionado.fechaCierre)} por {seleccionado.revisor ?? "Comunicaciones"}.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Alert className="border-gold-soft/60 bg-gold/10">
        <Info className="h-4 w-4 text-gold" />
        <AlertDescription>
          <span className="text-xs text-foreground">
            Comunicaciones no accede a la ficha completa del cliente; evalúa el nombre y el sitio web remitidos.
          </span>
        </AlertDescription>
      </Alert>
    </div>
  );
}
