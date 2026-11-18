"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  Badge,
  Button,
  Calendar,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
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
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Matcher } from "react-day-picker";
import { es as localeEs } from "react-day-picker/locale";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { useConfirm } from "@/hooks/use-confirm";
import { DdPaisBandera } from "./dd-pais-bandera";
import { DdReputacionBadge } from "./dd-estado-badge";

import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import {
  BADGE_STYLES,
  DD_FILTRO_TODAS,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_PER_PAGE_DEFAULT,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_ESTADO_LABELS,
  DD_REPUTACION_FILTROS,
  DD_REPUTACION_ORDEN,
  DD_REPUTACION_ORDEN_LABELS,
  DD_REPUTACION_RESULTADO_LABELS,
  DD_REPUTACION_RESULTADOS,
  DD_REPUTACION_RESULTADOS_OPCIONES,
  PER_PAGE_OPCIONES,
  type DdReputacionOrden,
  type DdReputacionResultado,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";
import { isValidHttpUrl } from "@/lib/shared/utils/form-validator";
import { paisDeTexto } from "@/lib/shared/utils/pais";
import type { DdReputacionResponseDTO, DdReputacionRowDTO } from "@/types/dto/debida-diligencia";

type DdFechaFiltroProps = {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (valor: string) => void;
};

function DdFechaFiltro({ label, value, min, max, onChange }: DdFechaFiltroProps) {
  const [open, setOpen] = useState(false);
  const seleccionada = dateUtils.toDate(value) ?? undefined;
  const desde = dateUtils.toDate(min) ?? undefined;
  const hasta = dateUtils.toDate(max) ?? undefined;
  const deshabilitados: Matcher[] = [
    ...(desde ? [{ before: desde }] : []),
    ...(hasta ? [{ after: hasta }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-[158px] justify-start gap-1.5 border-border bg-card px-2 text-[11px] font-normal"
          aria-label={`${label}: ${seleccionada ? dateUtils.format(seleccionada) : "sin fecha"}`}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-[10px] text-muted-foreground">{label}</span>
          <span className={`truncate ${seleccionada ? "text-foreground" : "text-muted-foreground"}`}>
            {seleccionada ? dateUtils.format(seleccionada) : "dd/mm/aaaa"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={seleccionada}
          onSelect={(fecha) => {
            onChange(fecha ? dateUtils.inputValue(fecha) : "");
            setOpen(false);
          }}
          locale={localeEs}
          disabled={deshabilitados.length > 0 ? deshabilitados : undefined}
          initialFocus
        />
        <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
          <span className="text-[10px] text-muted-foreground">{label}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={!value}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            <span>Limpiar</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type Guardado = "guardar" | "cerrar" | null;

type FiltrosReputacion = {
  page: number;
  perPage: number;
  search: string;
  estado: string;
  desde: string;
  hasta: string;
  orden: DdReputacionOrden;
};

export function DdReputacion() {
  const { confirm, confirmDialog } = useConfirm();
  const [data, setData] = useState<DdReputacionResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<string>(DD_REPUTACION_ESTADOS.POR_REVISAR);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [orden, setOrden] = useState<DdReputacionOrden>(DD_REPUTACION_ORDEN.RECIENTES);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DD_PER_PAGE_DEFAULT);
  const [seleccionado, setSeleccionado] = useState<DdReputacionRowDTO | null>(null);
  const [resultado, setResultado] = useState<DdReputacionResultado | "">("");
  const [comentario, setComentario] = useState("");
  const [linkHallazgos, setLinkHallazgos] = useState("");
  const [notificar, setNotificar] = useState(true);
  const [guardando, setGuardando] = useState<Guardado>(null);
  const [iniciando, setIniciando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [etiquetasEstado, setEtiquetasEstado] =
    useState<Record<string, string>>(DD_REPUTACION_ESTADO_LABELS);
  const [estadosCatalogo, setEstadosCatalogo] = useState<
    { codigo: string; nombre: string }[] | null
  >(null);

  const load = async (overrides?: Partial<FiltrosReputacion>) => {
    const actual = { page, perPage, search, estado, desde, hasta, orden, ...overrides };
    try {
      const respuesta = await debidaDiligenciaService.reputacionListar({
        page: actual.page,
        perPage: actual.perPage,
        search: actual.search.trim() || undefined,
        estado: actual.estado,
        desde: actual.desde || undefined,
        hasta: actual.hasta || undefined,
        orden: actual.orden,
      });
      setData(respuesta);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la revisión reputacional");
    } finally {
      setLoading(false);
    }
  };

  const recargar = (overrides?: Partial<FiltrosReputacion>) => {
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

  useEffect(() => {
    let activo = true;
    debidaDiligenciaService
      .maestra(["reputacion_estado"])
      .then(({ data: catalogo }) => {
        if (!activo) return;
        const estados = catalogo.filter((item) => item.tipo === "reputacion_estado");
        if (estados.length > 0) {
          setEtiquetasEstado({
            ...DD_REPUTACION_ESTADO_LABELS,
            ...Object.fromEntries(estados.map((item) => [item.codigo, item.nombre])),
          });
          setEstadosCatalogo(estados.map((item) => ({ codigo: item.codigo, nombre: item.nombre })));
        }
      })
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, []);

  const filtrosEstado = useMemo(
    () =>
      estadosCatalogo
        ? [
            { value: DD_FILTRO_TODAS, label: "Todas" },
            ...estadosCatalogo.map((estado) => ({
              value: estado.codigo,
              label: estado.nombre,
            })),
          ]
        : DD_REPUTACION_FILTROS.map((filtro) => ({
            ...filtro,
            label: etiquetasEstado[filtro.value] ?? filtro.label,
          })),
    [estadosCatalogo, etiquetasEstado],
  );

  const casosVisibles = useMemo(
    () => data?.data.flatMap((grupo) => grupo.casos) ?? [],
    [data],
  );
  const pendientesVisibles = useMemo(
    () =>
      casosVisibles.filter(
        (caso) =>
          caso.estado === DD_REPUTACION_ESTADOS.POR_REVISAR ||
          caso.estado === DD_REPUTACION_ESTADOS.EN_ANALISIS,
      ).length,
    [casosVisibles],
  );
  const conHallazgosVisibles = useMemo(
    () =>
      casosVisibles.filter(
        (caso) =>
          caso.estado === DD_REPUTACION_ESTADOS.CON_HALLAZGOS ||
          caso.estado === DD_REPUTACION_ESTADOS.REQUIERE_INFORMACION,
      ).length,
    [casosVisibles],
  );
  const cerradosVisibles = useMemo(
    () => casosVisibles.filter((caso) => caso.estado === DD_REPUTACION_ESTADOS.CERRADA).length,
    [casosVisibles],
  );

  const seleccionar = (fila: DdReputacionRowDTO) => {
    setSeleccionado(fila);
    const resultadoNormalizado = ddUtils.normalizarResultadoReputacion(fila.resultado);
    setResultado(
      resultadoNormalizado === DD_REPUTACION_RESULTADOS.OBSERVADO
        ? DD_REPUTACION_RESULTADOS.OBSERVADO
        : resultadoNormalizado === DD_REPUTACION_RESULTADOS.ACEPTADO
          ? DD_REPUTACION_RESULTADOS.ACEPTADO
          : "",
    );
    setComentario(fila.comentario ?? "");
    setLinkHallazgos(fila.linkHallazgos ?? "");
    setError(null);
  };

  const iniciarRevision = async () => {
    if (!seleccionado) return;
    const ok = await confirm({
      title: "Comenzar revisión",
      description:
        "¿Deseas comenzar a revisar este vínculo? Quedará marcado como EN REVISIÓN para SIG.",
      confirmLabel: "Sí, comenzar",
      cancelLabel: "No",
    });
    if (!ok) return;

    setIniciando(true);
    setError(null);
    try {
      const actualizado = await debidaDiligenciaService.reputacionIniciar(seleccionado.id);
      const estado = actualizado.estado as DdReputacionRowDTO["estado"];
      setSeleccionado((previa) => (previa ? { ...previa, estado } : previa));
      setData((previa) =>
        previa
          ? {
              ...previa,
              data: previa.data.map((grupo) => ({
                ...grupo,
                casos: grupo.casos.map((caso) =>
                  caso.id === seleccionado.id ? { ...caso, estado } : caso,
                ),
              })),
            }
          : previa,
      );
      toast.success("Vínculo marcado En revisión");
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "No se pudo iniciar la revisión";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setIniciando(false);
    }
  };
  const guardarObservacion = async (cerrar: boolean) => {
    if (!seleccionado) return;
    if (cerrar && !resultado) {
      setError("Selecciona el resultado de Comunicaciones para cerrar la revisión.");
      return;
    }
    if (linkInvalido) {
      setError("Ingresa una URL válida que empiece con http:// o https://.");
      return;
    }
    if (resultado === DD_REPUTACION_RESULTADOS.OBSERVADO && !linkHallazgos.trim()) {
      setError("La fuente es obligatoria cuando el resultado es OBSERVADO.");
      return;
    }
    if (cerrar) {
      const ok = await confirm({
        title: "Guardar y enviar a SIG",
        description:
          "Se cerrará la revisión de Comunicaciones y el vínculo pasará a SIG para registrar la conclusión reputacional.",
        confirmLabel: "Sí, guardar",
        cancelLabel: "Cancelar",
      });
      if (!ok) return;
    }
    setGuardando(cerrar ? "cerrar" : "guardar");
    setError(null);
    try {
      await debidaDiligenciaService.reputacionObservar({
        id: seleccionado.id,
        resultado: resultado || null,
        comentario: comentario.trim() || null,
        linkHallazgos: linkHallazgos.trim() || null,
        cerrar,
        notificar: cerrar ? notificar : false,
      });
      if (cerrar) {
        toast.success("Revisión cerrada y enviada a SIG");
        setSeleccionado(null);
        setResultado("");
        setComentario("");
        setLinkHallazgos("");
      } else {
        toast.success("Borrador guardado");
        setSeleccionado((previa) =>
          previa
            ? {
                ...previa,
                estado: DD_REPUTACION_ESTADOS.EN_ANALISIS,
                resultado: resultado || null,
                comentario: comentario.trim() || null,
                linkHallazgos: linkHallazgos.trim() || null,
              }
            : previa,
        );
      }
      recargar();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "No se pudo guardar el borrador";
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

  const cambiarFecha = (campo: "desde" | "hasta", valor: string) => {
    if (campo === "desde" && hasta && valor > hasta) {
      toast.error("La fecha desde no puede ser mayor que la fecha hasta");
      return;
    }
    if (campo === "hasta" && desde && valor < desde) {
      toast.error("La fecha hasta no puede ser menor que la fecha desde");
      return;
    }
    if (campo === "desde") setDesde(valor);
    else setHasta(valor);
    setPage(1);
    setSeleccionado(null);
    recargar({ [campo]: valor, page: 1 });
  };

  const cambiarOrden = (valor: DdReputacionOrden) => {
    setOrden(valor);
    setPage(1);
    recargar({ orden: valor, page: 1 });
  };

  const limpiarFiltros = () => {
    setSearch("");
    setEstado(DD_REPUTACION_ESTADOS.POR_REVISAR);
    setDesde("");
    setHasta("");
    setOrden(DD_REPUTACION_ORDEN.RECIENTES);
    setPage(1);
    setSeleccionado(null);
    recargar({
      search: "",
      estado: DD_REPUTACION_ESTADOS.POR_REVISAR,
      desde: "",
      hasta: "",
      orden: DD_REPUTACION_ORDEN.RECIENTES,
      page: 1,
    });
  };

  const filtrosActivos = Boolean(
    search.trim() ||
      desde ||
      hasta ||
      estado !== DD_REPUTACION_ESTADOS.POR_REVISAR ||
      orden !== DD_REPUTACION_ORDEN.RECIENTES,
  );

  const cerrada = seleccionado?.estado === DD_REPUTACION_ESTADOS.CERRADA;
  const pendienteInicio =
    seleccionado?.estado === DD_REPUTACION_ESTADOS.POR_REVISAR && !seleccionado.resultado;
  const bloqueado = cerrada || pendienteInicio;
  const linkInvalido = linkHallazgos.trim().length > 0 && !isValidHttpUrl(linkHallazgos);

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
              {filtrosEstado.map((filtro) => {
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
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-secondary/40 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Envío SIG
                </span>
                <div className="flex items-center gap-1.5">
                  <DdFechaFiltro
                    label="Desde"
                    value={desde}
                    max={hasta || undefined}
                    onChange={(valor) => cambiarFecha("desde", valor)}
                  />
                  <span className="text-[10px] text-muted-foreground/50">–</span>
                  <DdFechaFiltro
                    label="Hasta"
                    value={hasta}
                    min={desde || undefined}
                    onChange={(valor) => cambiarFecha("hasta", valor)}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Orden</span>
                  <Select value={orden} onValueChange={(valor) => cambiarOrden(valor as DdReputacionOrden)}>
                    <SelectTrigger className="h-8 w-[174px] border-border bg-card text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(DD_REPUTACION_ORDEN).map((valor) => (
                        <SelectItem key={valor} value={valor}>
                          <span>{DD_REPUTACION_ORDEN_LABELS[valor]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                onClick={limpiarFiltros}
                disabled={!filtrosActivos}
              >
                <X className="h-3.5 w-3.5" />
                <span>Limpiar filtros</span>
              </Button>
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
                <Accordion type="multiple" className="space-y-2">
                  {(data?.data ?? []).map((grupo) => (
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
                              {grupo.codigo} · {grupo.totalCasos} caso(s) · Enviado por SIG{" "}
                              {dateUtils.format(grupo.fechaDerivacion)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {grupo.casos.every((caso) => !caso.vinculoId) ? (
                              <Badge className={`pointer-events-none text-[9px] ${BADGE_STYLES.NEUTRAL}`}>
                                <span>Sin vínculo</span>
                              </Badge>
                            ) : null}
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
                            <TableHeader className="bg-secondary/40">
                              <TableRow>
                                <TableHead className="text-[10px] uppercase tracking-wide">Vínculo evaluado</TableHead>
                                <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Nacionalidad</TableHead>
                                <TableHead className="hidden text-[10px] uppercase tracking-wide sm:table-cell">Enviado SIG</TableHead>
                                <TableHead className="text-[10px] uppercase tracking-wide">Estado</TableHead>
                                <TableHead className="text-right text-[10px] uppercase tracking-wide">Acción</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {grupo.casos.map((fila) => (
                                <TableRow
                                  key={fila.id}
                                  className={`cursor-pointer transition-colors ${
                                    seleccionado?.id === fila.id ? "border-l-2 border-primary bg-primary/5" : "hover:bg-secondary/40"
                                  }`}
                                  onClick={() => { void seleccionar(fila); }}
                                >
                                  <TableCell className="max-w-[280px]">
                                    <p className="truncate text-xs font-medium text-foreground">
                                      {fila.vinculoNombre ?? fila.nombreARevisar}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {[
                                        fila.vinculoTipo
                                          ? DD_MATRIZ_TIPO_VINCULO_LABELS[
                                              fila.vinculoTipo as keyof typeof DD_MATRIZ_TIPO_VINCULO_LABELS
                                            ] ?? fila.vinculoTipo
                                          : null,
                                        fila.cargo,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ") || "Sin clasificar"}
                                      {fila.vinculoDocumento ? ` · ${fila.vinculoDocumento}` : ""}
                                    </p>
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
                                  <TableCell className="hidden text-[11px] text-muted-foreground sm:table-cell">
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
                                        void seleccionar(fila);
                                      }}
                                    >
                                      <span>Ver</span>
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
                    {data?.total ?? 0} expediente(s) · página {data?.page ?? 1} de {data?.totalPages || 1}
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
                <p className="text-xs text-muted-foreground">Selecciona un caso para ver su detalle.</p>
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
                      <p className="text-[10px] text-muted-foreground">
                        {seleccionado.vinculoId ? "Vínculo evaluado" : "Nombre evaluado"}
                      </p>
                      <p className="truncate font-semibold text-foreground" title={seleccionado.vinculoNombre ?? seleccionado.nombreARevisar}>
                        {seleccionado.vinculoNombre ?? seleccionado.nombreARevisar}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {[
                          seleccionado.vinculoTipo
                            ? DD_MATRIZ_TIPO_VINCULO_LABELS[
                                seleccionado.vinculoTipo as keyof typeof DD_MATRIZ_TIPO_VINCULO_LABELS
                              ] ?? seleccionado.vinculoTipo
                            : null,
                          seleccionado.cargo,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sin clasificar"}
                        {seleccionado.vinculoDocumento ? ` · ${seleccionado.vinculoDocumento}` : ""}
                      </p>
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

                {pendienteInicio ? (
                  <div className="space-y-2 rounded-lg border border-gold-soft/60 bg-gold/10 p-3">
                    <p className="text-[11px] font-semibold text-foreground">
                      Este vínculo todavía no está en revisión
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Puedes revisar la información. Para registrar un dictamen, inicia la revisión.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      disabled={iniciando}
                      onClick={() => { void iniciarRevision(); }}
                    >
                      {iniciando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      <span>{iniciando ? "Iniciando..." : "Comenzar revisión"}</span>
                    </Button>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label className="text-xs">
                    <span>Resultado de Comunicaciones</span>
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Resultado de Comunicaciones">
                    {DD_REPUTACION_RESULTADOS_OPCIONES.map((opcion) => {
                      const activo = resultado === opcion;
                      const esObservado = opcion === DD_REPUTACION_RESULTADOS.OBSERVADO;
                      return (
                        <button
                          key={opcion}
                          type="button"
                          role="radio"
                          aria-checked={activo}
                          disabled={bloqueado}
                          onClick={() => {
                            setResultado(opcion);
                            setError(null);
                          }}
                          className={`flex h-9 w-full cursor-pointer select-none items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold shadow-sm transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [-webkit-tap-highlight-color:transparent] ${
                            esObservado
                              ? activo
                                ? "border-amber-600 bg-amber-100 text-amber-800 ring-1 ring-amber-600 hover:bg-amber-100 active:bg-amber-200 focus-visible:ring-amber-500"
                                : "border-border bg-card text-muted-foreground hover:border-amber-300 hover:bg-amber-50/50 hover:text-amber-800 active:bg-amber-50 focus-visible:ring-amber-400"
                              : activo
                                ? "border-green-600 bg-green-100 text-green-800 ring-1 ring-green-600 hover:bg-green-100 active:bg-green-200 focus-visible:ring-green-500"
                                : "border-border bg-card text-muted-foreground hover:border-green-300 hover:bg-green-50/50 hover:text-green-800 active:bg-green-50 focus-visible:ring-green-400"
                          }`}
                        >
                          {esObservado ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          <span>{DD_REPUTACION_RESULTADO_LABELS[opcion] ?? opcion}</span>
                        </button>
                      );
                    })}
                  </div>
                  {!resultado && !bloqueado ? (
                    <p className="text-[10px] font-medium text-amber-700">
                      Selecciona ACEPTADO u OBSERVADO para habilitar Guardar.
                    </p>
                  ) : null}
                  <p className="text-[10px] text-muted-foreground">
                    Comunicaciones registra resultado, observaciones y fuentes. La conclusión
                    reputacional la define SIG en la matriz.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">
                    <span>Detalle de las observaciones</span>
                  </Label>
                  <Textarea
                    value={comentario}
                    onChange={(e) => {
                      setComentario(e.target.value);
                      setError(null);
                    }}
                    placeholder="Detalle los hallazgos, fuentes o la información requerida..."
                    className="min-h-24 text-xs"
                    disabled={bloqueado}
                  />
                  {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">
                    <span>Fuente de las observaciones</span>
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
                    disabled={bloqueado}
                    aria-invalid={linkInvalido}
                  />
                  {linkInvalido ? (
                    <p className="text-[11px] text-destructive">
                      Ingresa una URL válida que empiece con http:// o https://.
                    </p>
                  ) : null}
                  <p className="text-[10px] text-muted-foreground">
                    Adjunta el enlace de Drive con la evidencia o fuente revisada.
                  </p>
                </div>

                {!bloqueado ? (
                  <label className="flex items-start gap-2">
                    <Checkbox checked={notificar} onCheckedChange={(valor) => setNotificar(valor === true)} className="mt-0.5" />
                    <span className="text-[11px] leading-relaxed text-muted-foreground">Notificar a Logística al cerrar la revisión</span>
                  </label>
                ) : null}

                <Alert className="border-gold-soft/60 bg-gold/10">
                  <Info className="h-4 w-4 text-gold" />
                  <AlertDescription>
                    <span className="text-[11px] text-foreground">
                      Comunicaciones registra el resultado, las observaciones y las fuentes; SIG define la conclusión reputacional en la matriz.
                    </span>
                  </AlertDescription>
                </Alert>

                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  {pendienteInicio ? null : !cerrada ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          disabled={guardando !== null || linkInvalido}
                          onClick={() => void guardarObservacion(false)}
                        >
                          {guardando === "guardar" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          <span>Guardar borrador</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5 text-xs"
                          disabled={
                            guardando !== null ||
                            linkInvalido ||
                            !resultado ||
                            (resultado === DD_REPUTACION_RESULTADOS.OBSERVADO &&
                              !linkHallazgos.trim())
                          }
                          onClick={() => void guardarObservacion(true)}
                        >
                          {guardando === "cerrar" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          <span>Guardar</span>
                        </Button>
                      </div>
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
      {confirmDialog}
    </div>
  );
}




