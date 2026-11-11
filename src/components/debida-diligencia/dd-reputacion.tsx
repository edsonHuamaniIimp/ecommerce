"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
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
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DdPaisBandera } from "./dd-pais-bandera";
import { DdReputacionBadge } from "./dd-estado-badge";
import { DdRadioIndicator } from "./dd-radio-indicator";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import {
  DD_PER_PAGE_DEFAULT,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_FILTROS,
  DD_REPUTACION_RESULTADO_LABELS,
  DD_REPUTACION_RESULTADOS,
  PER_PAGE_OPCIONES,
  type DdReputacionResultado,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { paisDeTexto } from "@/lib/shared/utils/pais";
import type { DdReputacionResponseDTO, DdReputacionRowDTO } from "@/types/dto/debida-diligencia";

type Guardado = "guardar" | "cerrar" | "aceptar" | null;

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
  const [guardando, setGuardando] = useState<Guardado>(null);
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
      .then((r) => {
        if (activo) setData(r);
      })
      .catch((err) => {
        if (activo) toast.error(err instanceof Error ? err.message : "No se pudo cargar la revisión reputacional");
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const casosVisibles = useMemo(
    () => data?.data.flatMap((grupo) => grupo.casos) ?? [],
    [data],
  );
  const pendientesVisibles = useMemo(
    () => casosVisibles.filter((caso) => caso.estado === DD_REPUTACION_ESTADOS.POR_REVISAR).length,
    [casosVisibles],
  );
  const conHallazgosVisibles = useMemo(
    () => casosVisibles.filter((caso) => caso.estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS).length,
    [casosVisibles],
  );
  const cerradosVisibles = useMemo(
    () => casosVisibles.filter((caso) => caso.estado === DD_REPUTACION_ESTADOS.CERRADA).length,
    [casosVisibles],
  );

  const seleccionar = (fila: DdReputacionRowDTO) => {
    setSeleccionado(fila);
    setResultado(fila.resultado ?? "");
    setComentario(fila.comentario ?? "");
    setLinkHallazgos(fila.linkHallazgos ?? "");
    setError(null);
  };

  const resolver = async (cerrar: boolean, resultadoOverride?: DdReputacionResultado) => {
    if (!seleccionado) return;
    const resultadoFinal = resultadoOverride ?? resultado;
    if (!resultadoFinal) {
      setError("Selecciona un resultado para la revisión.");
      return;
    }
    if (resultadoFinal === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS && !linkHallazgos.trim()) {
      setError("El link de sustento es obligatorio cuando hay hallazgos.");
      return;
    }
    setGuardando(resultadoOverride === DD_REPUTACION_RESULTADOS.SIN_HALLAZGOS && cerrar ? "aceptar" : cerrar ? "cerrar" : "guardar");
    setError(null);
    try {
      await debidaDiligenciaService.reputacionResolver({
        id: seleccionado.id,
        resultado: resultadoFinal,
        comentario: comentario.trim() || null,
        linkHallazgos: resultadoFinal === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS ? linkHallazgos.trim() : null,
        cerrar,
        notificar,
      });
      toast.success(cerrar ? "Caso enviado a SIG" : "Observación guardada");
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

  const aceptarSinObservaciones = () => {
    setResultado(DD_REPUTACION_RESULTADOS.SIN_HALLAZGOS);
    setLinkHallazgos("");
    void resolver(true, DD_REPUTACION_RESULTADOS.SIN_HALLAZGOS);
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
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cola de revisión reputacional</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Comunicaciones
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Bandeja oficial
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Casos enviados por el SIG para validación de imagen y reputación.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-[11px]">
            <span className="text-muted-foreground">Casos: <strong className="text-foreground">{casosVisibles.length}</strong></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-muted-foreground">Pendientes: <strong className="text-foreground">{pendientesVisibles}</strong></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-muted-foreground">Hallazgos: <strong className="text-destructive">{conHallazgosVisibles}</strong></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-muted-foreground">Cerrados: <strong className="text-foreground">{cerradosVisibles}</strong></span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => recargar()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 border-b border-border pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:flex-1">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa, vínculo o expediente..."
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
              <Select
                value={String(perPage)}
                onValueChange={(valor) => {
                  const n = Number(valor);
                  setPerPage(n);
                  setPage(1);
                  recargar({ perPage: n, page: 1 });
                }}
              >
                <SelectTrigger className="h-8 w-[92px] shrink-0 border-border text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPCIONES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      <span>{n} filas</span>
                    </SelectItem>
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
            ) : casosVisibles.length === 0 ? (
              <div className="py-16 text-center">
                <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">No hay casos en este filtro</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Logística deriva los nombres al resolver la revisión de documentos.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader className="bg-secondary/40">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase tracking-wide">Empresa / Expediente</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wide">Vínculo evaluado</TableHead>
                        <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Nacionalidad</TableHead>
                        <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Derivado</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wide">Estado</TableHead>
                        <TableHead className="text-right text-[10px] uppercase tracking-wide">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {casosVisibles.map((fila) => (
                        <TableRow
                          key={fila.id}
                          className={`cursor-pointer transition-colors ${
                            seleccionado?.id === fila.id ? "border-l-2 border-primary bg-primary/5" : "hover:bg-secondary/40"
                          }`}
                          onClick={() => seleccionar(fila)}
                        >
                          <TableCell className="max-w-[230px]">
                            <p className="truncate text-xs font-semibold text-foreground">{fila.empresa.razonSocial}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              RUC {fila.empresa.ruc} · {fila.codigo}
                            </p>
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            <p className="truncate text-xs font-medium text-foreground">{fila.nombreARevisar}</p>
                            <p className="text-[10px] text-muted-foreground">{fila.cargo ?? "Sin cargo registrado"}</p>
                            <p className="text-[10px] text-muted-foreground">{fila.sitioWeb ? fila.sitioWeb.replace(/^https?:\/\//, "") : "Sin sitio web"}</p>
                          </TableCell>
                          <TableCell className="hidden max-w-[130px] text-[11px] text-muted-foreground md:table-cell">
                            {fila.nacionalidad ? (
                              <span className="inline-flex items-center gap-1.5">
                                <DdPaisBandera pais={paisDeTexto(fila.nacionalidad)} />
                                <span className="truncate">{fila.nacionalidad}</span>
                              </span>
                            ) : (
                              <span>-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden text-[11px] text-muted-foreground lg:table-cell">
                            {dateUtils.format(fila.fechaDerivacion)}
                          </TableCell>
                          <TableCell>
                            <DdReputacionBadge estado={fila.estado} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={(event) => {
                                event.stopPropagation();
                                seleccionar(fila);
                              }}
                            >
                              <span>{fila.estado === DD_REPUTACION_ESTADOS.CERRADA ? "Ver" : "Revisar"}</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-muted-foreground">
                    {data?.total ?? 0} empresa(s) en este filtro · página {data?.page ?? 1} de {data?.totalPages || 1}
                  </span>
                  <Pagination
                    page={data?.page ?? 1}
                    totalPages={data?.totalPages ?? 0}
                    onPageChange={(p) => {
                      setPage(p);
                      recargar({ page: p });
                    }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit xl:sticky xl:top-16">
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-primary">Detalle del caso reputacional</CardTitle>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Expediente derivado por SIG-DD para dictamen
                </p>
              </div>
              {seleccionado ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setSeleccionado(null)}
                  aria-label="Cerrar detalle"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {!seleccionado ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <ShieldAlert className="h-7 w-7 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Selecciona un caso para revisar su resultado.</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-secondary/40 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Empresa</p>
                      <p className="truncate text-sm font-bold text-primary">{seleccionado.empresa.razonSocial}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">RUC {seleccionado.empresa.ruc} · {seleccionado.codigo}</p>
                    </div>
                    <DdReputacionBadge estado={seleccionado.estado} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[11px]">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Vínculo evaluado</p>
                      <p className="truncate font-semibold text-foreground" title={seleccionado.nombreARevisar}>
                        {seleccionado.nombreARevisar}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{seleccionado.cargo ?? "Sin cargo registrado"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {seleccionado.nacionalidad ?? "Nacionalidad sin registrar"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Sitio web</p>
                      {seleccionado.sitioWeb ? (
                        <a
                          href={seleccionado.sitioWeb}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-[11px] font-medium text-primary underline underline-offset-2"
                        >
                          {seleccionado.sitioWeb.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        <p className="font-medium text-foreground">No declarado</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
                    <span>Derivado por {seleccionado.derivadoPor}</span>
                    <span className="font-mono">{dateUtils.format(seleccionado.fechaDerivacion)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">
                    <span>Dictamen de Comunicaciones</span>
                  </Label>
                  <RadioGroup
                    value={resultado || undefined}
                    onValueChange={(valor) => {
                      setResultado(valor as DdReputacionResultado);
                      setError(null);
                    }}
                    className="grid gap-1.5 sm:grid-cols-3 xl:grid-cols-1"
                    disabled={cerrada}
                  >
                    {Object.values(DD_REPUTACION_RESULTADOS).map((opcion) => (
                      <label
                        key={opcion}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 ${
                          resultado === opcion ? "border-primary bg-secondary" : "border-border bg-card"
                        }`}
                      >
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
                  <Label className="text-xs">
                    <span>Registro de observación reputacional</span>
                  </Label>
                  <Textarea
                    value={comentario}
                    onChange={(e) => {
                      setComentario(e.target.value);
                      setError(null);
                    }}
                    placeholder="Detalle los hallazgos, fuentes o la información requerida..."
                    className="min-h-24 text-xs"
                    disabled={cerrada}
                  />
                  {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
                </div>

                {resultado === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS || seleccionado.linkHallazgos ? (
                  <div className="space-y-2">
                    <Label className="text-xs">
                      <span>Fuente de hallazgos {resultado === DD_REPUTACION_RESULTADOS.CON_HALLAZGOS ? <span className="text-destructive">*</span> : null}</span>
                    </Label>
                    {seleccionado.linkHallazgos && !linkHallazgos ? (
                      <a
                        href={seleccionado.linkHallazgos}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-2 text-[11px] font-medium text-primary"
                      >
                        <Link2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{seleccionado.linkHallazgos}</span>
                      </a>
                    ) : null}
                    <Input
                      type="url"
                      value={linkHallazgos}
                      onChange={(e) => {
                        setLinkHallazgos(e.target.value);
                        setError(null);
                      }}
                      placeholder="https://drive.google.com/..."
                      className="h-9 text-sm"
                      disabled={cerrada}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Adjunta el enlace de Drive con la evidencia de los hallazgos.
                    </p>
                  </div>
                ) : null}

                {!cerrada ? (
                  <label className="flex items-start gap-2">
                    <Checkbox checked={notificar} onCheckedChange={(valor) => setNotificar(valor === true)} className="mt-0.5" />
                    <span className="text-[11px] leading-relaxed text-muted-foreground">Notificar a Logística al guardar</span>
                  </label>
                ) : null}

                <Alert className="border-gold-soft/60 bg-gold/10">
                  <Info className="h-4 w-4 text-gold" />
                  <AlertDescription>
                    <span className="text-[11px] text-foreground">
                      Comunicaciones solo registra observaciones y fuentes; el SIG define el dictamen final.
                    </span>
                  </AlertDescription>
                </Alert>

                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  {!cerrada ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5 text-xs"
                          disabled={guardando !== null}
                          onClick={() => void resolver(false)}
                        >
                          {guardando === "guardar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          <span>Guardar observación</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          disabled={guardando !== null}
                          onClick={aceptarSinObservaciones}
                        >
                          {guardando === "aceptar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          <span>Aceptar sin observaciones</span>
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        disabled={guardando !== null}
                        onClick={() => void resolver(true)}
                      >
                        {guardando === "cerrar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        <span>Cerrar caso y enviar a SIG</span>
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
    </div>
  );
}

