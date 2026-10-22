"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, Input, Label, Select, SelectContent, SelectItem, SelectTrigger,
  SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsList, TabsTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { Bookmark, CheckSquare, Download, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Pencil, RotateCcw, Search, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmpresaPicker } from "@/components/shared/empresa-picker";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { useConfirm } from "@/hooks/use-confirm";
import { gessService } from "@/lib/client/api/services/gess-service";
import { planosService } from "@/lib/client/api/services/planos-service";
import { uploadService } from "@/lib/client/api/services/upload-service";
import { ESTADOS_STAND, MAX_PRE_RESERVA_LOTE, UI_SENTINEL } from "@/lib/shared/constants";
import { estadoStandBadge } from "@/lib/shared/utils/estado-stand";
import { dateUtils } from "@/lib/shared/utils/date";
import { exportarTablaCsv, exportarTablaExcel, nombreArchivoExport, type ColumnaExportacion } from "@/lib/shared/utils/export-tabla";
import type { GessStandDTO } from "@/types/dto/gess";
import type { EmpresaAccesoDTO } from "@/types/dto/usuarios/usuario.dto";

/** Estados sobre los que se puede operar desde esta vista. */
const ESTADOS_SELECCIONABLES: string[] = [ESTADOS_STAND.DISPONIBLE, ESTADOS_STAND.PRE_RESERVADO];

/** Paginacion server-side de la bandeja. */
const PER_PAGE_DEFAULT = 25;
const PER_PAGE_OPCIONES = [10, 25, 50, 100];
const EXPORT_MAX_FILAS = 2000;

/** Etiqueta para stands sin pabellon resoluble (plano o nombre). */
const SIN_PABELLON = "Sin pabellon";

/** Algunos stand guardan coordenadas ("-10,-11") en `pabellon`; no son nombres. */
function esCoordenada(valor: string): boolean {
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(valor.trim());
}

interface Props {
  eventoId: string;
  tipoEvento?: number;
  codigoEvento?: number;
}

export function PreReservasManager({ eventoId, tipoEvento, codigoEvento }: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const [rows, setRows] = useState<GessStandDTO[]>([]);
  const [bloquePlano, setBloquePlano] = useState<Map<string, string>>(new Map());
  const [pabellonesPlano, setPabellonesPlano] = useState<Array<{ label: string; codigo: string; bloqueIds: string[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pabellon, setPabellon] = useState<string>(UI_SENTINEL.TODOS);
  const [tipo, setTipo] = useState<string>(UI_SENTINEL.TODOS);
  const [estadoFiltro, setEstadoFiltro] = useState<string>(UI_SENTINEL.TODOS);
  const [tipos, setTipos] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [seleccion, setSeleccion] = useState<Map<string, GessStandDTO>>(new Map());

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editRow, setEditRow] = useState<GessStandDTO | null>(null);
  const [modo, setModo] = useState<"empresa" | "titulo">("empresa");
  const [empresa, setEmpresa] = useState<EmpresaAccesoDTO | null>(null);
  const [titulo, setTitulo] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState<"csv" | "xlsx" | null>(null);

  const pageRef = useRef(page);
  const perPageRef = useRef(perPage);
  const filtrosRef = useRef({ search, pabellon, tipo, estadoFiltro });
  const pabellonesRef = useRef(pabellonesPlano);
  const firstSearchRef = useRef(true);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { perPageRef.current = perPage; }, [perPage]);
  useEffect(() => { filtrosRef.current = { search, pabellon, tipo, estadoFiltro }; }, [search, pabellon, tipo, estadoFiltro]);
  useEffect(() => { pabellonesRef.current = pabellonesPlano; }, [pabellonesPlano]);

  const load = useCallback(async (
    p?: number,
    overrides?: Partial<{ search: string; pabellon: string; tipo: string; estadoFiltro: string }>,
    pp?: number,
  ) => {
    setLoading(true);
    try {
      const filtros = { ...filtrosRef.current, ...overrides };
      const pabellonSel = pabellonesRef.current.find((item) => item.label === filtros.pabellon);
      const respuesta = await gessService.list(eventoId, {
        page: p ?? pageRef.current,
        per_page: pp ?? perPageRef.current,
        search: filtros.search.trim() || undefined,
        estado: filtros.estadoFiltro === UI_SENTINEL.TODOS ? undefined : filtros.estadoFiltro,
        tipo: filtros.tipo === UI_SENTINEL.TODOS ? undefined : filtros.tipo,
        planoCodigo: filtros.pabellon === UI_SENTINEL.TODOS || filtros.pabellon === SIN_PABELLON ? undefined : pabellonSel?.codigo,
        sinPabellon: filtros.pabellon === SIN_PABELLON,
      });
      setRows(respuesta.data);
      setPagination({
        page: respuesta.pagination.page,
        total: respuesta.pagination.total,
        totalPages: respuesta.pagination.total_pages,
      });
    } catch {
      setRows([]);
      setPagination({ page: 1, total: 0, totalPages: 0 });
    }
    setLoading(false);
  }, [eventoId]);

  useEffect(() => {
    void (async () => { await load(1); })();
  }, [load]);

  /* Tipos distintos del evento (filtro server-side). */
  useEffect(() => {
    let activo = true;
    gessService.tipos(eventoId)
      .then((lista) => { if (activo) setTipos(lista); })
      .catch(() => {});
    return () => { activo = false; };
  }, [eventoId]);

  /* Busqueda con debounce; el primer render no dispara una segunda carga. */
  useEffect(() => {
    if (firstSearchRef.current) { firstSearchRef.current = false; return; }
    const timer = setTimeout(() => {
      setPage(1);
      setSeleccion(new Map());
      void load(1, { search });
    }, 400);
    return () => clearTimeout(timer);
  }, [search, load]);

  const cambiarFiltro = (cambios: Partial<{ search: string; pabellon: string; tipo: string; estadoFiltro: string }>) => {
    filtrosRef.current = { ...filtrosRef.current, ...cambios };
    if (cambios.pabellon !== undefined) setPabellon(cambios.pabellon);
    if (cambios.tipo !== undefined) setTipo(cambios.tipo);
    if (cambios.estadoFiltro !== undefined) setEstadoFiltro(cambios.estadoFiltro);
    setPage(1);
    setSeleccion(new Map());
    void load(1, cambios);
  };

  const cambiarPerPage = (valor: number) => {
    setPerPage(valor);
    setPage(1);
    void load(1, undefined, valor);
  };

  /* Pabellon por bloque: los planos del evento dan el nombre real (no la coordenada cruda). */
  useEffect(() => {
    if (!tipoEvento || !codigoEvento) return;
    let activo = true;
    planosService.planosDeEvento(tipoEvento, codigoEvento)
      .then((planes) => {
        if (!activo) return;
        const mapa = new Map<string, string>();
        const porPabellon = new Map<string, Set<string>>();
        const codigoPorPabellon = new Map<string, string>();
        for (const plano of planes) {
          const label = plano.nombre?.trim() || plano.codigo;
          const bloqueIds = porPabellon.get(label) ?? new Set<string>();
          for (const bloque of plano.bloques) {
            mapa.set(bloque.bloqueId, label);
            bloqueIds.add(bloque.bloqueId);
          }
          porPabellon.set(label, bloqueIds);
          if (!codigoPorPabellon.has(label)) codigoPorPabellon.set(label, plano.codigo);
        }
        setBloquePlano(mapa);
        setPabellonesPlano(
          [...porPabellon.entries()]
            .map(([label, ids]) => ({ label, codigo: codigoPorPabellon.get(label) ?? "", bloqueIds: [...ids] }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
      })
      .catch(() => {});
    return () => { activo = false; };
  }, [tipoEvento, codigoEvento]);

  const pabellonDe = useCallback((r: GessStandDTO): string => {
    const porBloque = r.bloqueId ? bloquePlano.get(r.bloqueId) : undefined;
    if (porBloque) return porBloque;
    const crudo = r.pabellon?.trim();
    if (crudo && !esCoordenada(crudo)) return crudo;
    return SIN_PABELLON;
  }, [bloquePlano]);

  /* Seleccion sobre la pagina actual; el Map conserva filas de paginas anteriores. */
  const seleccionablesPagina = rows.filter((r) => ESTADOS_SELECCIONABLES.includes(r.estado ?? ""));
  const seleccionadosDisponibles = [...seleccion.values()].filter((r) => r.estado === ESTADOS_STAND.DISPONIBLE);
  const seleccionadosPre = [...seleccion.values()].filter((r) => r.estado === ESTADOS_STAND.PRE_RESERVADO);
  const todosPaginaSeleccionados = seleccionablesPagina.length > 0 && seleccionablesPagina.every((r) => seleccion.has(r.id));

  const toggle = (row: GessStandDTO) => {
    if (!ESTADOS_SELECCIONABLES.includes(row.estado ?? "")) return;
    setSeleccion((prev) => {
      const next = new Map(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  };

  const toggleTodosPagina = () => {
    setSeleccion((prev) => {
      const next = new Map(prev);
      if (todosPaginaSeleccionados) {
        for (const r of seleccionablesPagina) next.delete(r.id);
      } else {
        for (const r of seleccionablesPagina) next.set(r.id, r);
      }
      return next;
    });
  };

  const abrirPreReserva = () => {
    if (seleccionadosDisponibles.length > MAX_PRE_RESERVA_LOTE) {
      toast.error(`Maximo ${MAX_PRE_RESERVA_LOTE} stands por operacion; filtra para reducir la seleccion`);
      return;
    }
    setEditRow(null);
    setModo("empresa");
    setEmpresa(null);
    setTitulo("");
    setLogoUrl("");
    setNota("");
    setModalAbierto(true);
  };

  const abrirEditar = (row: GessStandDTO) => {
    setEditRow(row);
    if (row.preReservaTitulo) {
      setModo("titulo");
      setEmpresa(null);
      setTitulo(row.preReservaTitulo);
    } else {
      setModo("empresa");
      setEmpresa({
        idEmpresa: row.preReservaSie ?? "",
        nombreEmpresa: row.preReservaRazonSocial ?? row.empresa ?? "",
        ruc: row.preReservaRuc ?? null,
      });
      setTitulo("");
    }
    setLogoUrl(row.preReservaLogoUrl ?? "");
    setNota(row.preReservaNota ?? "");
    setModalAbierto(true);
  };

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendoLogo(true);
    try {
      setLogoUrl(await uploadService.subir(file));
    } catch {
      toast.error("No se pudo subir el logo");
    }
    setSubiendoLogo(false);
  };

  const confirmarPreReserva = async () => {
    if (modo === "empresa" && !empresa) {
      toast.error("Selecciona la empresa");
      return;
    }
    if (modo === "titulo" && !titulo.trim()) {
      toast.error("Ingresa el titulo");
      return;
    }
    const identidad = modo === "empresa" && empresa
      ? { razonSocial: empresa.nombreEmpresa, ruc: empresa.ruc ?? null, sie: empresa.idEmpresa, titulo: null }
      : { razonSocial: null, ruc: null, sie: null, titulo: titulo.trim() };
    setGuardando(true);
    try {
      if (editRow) {
        await gessService.actualizarPreReserva({
          standId: editRow.id,
          ...identidad,
          logoUrl: logoUrl || null,
          nota: nota.trim() || null,
        });
        toast.success("Pre-reserva actualizada");
      } else {
        const res = await gessService.preReservar({
          standIds: seleccionadosDisponibles.map((r) => r.id),
          ...identidad,
          logoUrl: logoUrl || null,
          nota: nota.trim() || null,
        });
        toast.success(`${res.preReservados} stand(s) pre-reservado(s)`);
      }
      setModalAbierto(false);
      setEditRow(null);
      setSeleccion(new Map());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la pre-reserva");
    }
    setGuardando(false);
  };

  const liberar = async () => {
    const ok = await confirm({
      title: "Liberar pre-reservas",
      description: `${seleccionadosPre.length} stand(s) volveran a estado Disponible y se limpiara la empresa asignada.`,
    });
    if (!ok) return;
    try {
      const res = await gessService.liberarPreReserva(seleccionadosPre.map((r) => r.id));
      toast.success(`${res.liberados} stand(s) liberado(s)`);
      setSeleccion(new Map());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron liberar");
    }
  };

  /** Exporta TODAS las paginas que cumplen los filtros (solo stands vinculados). */
  const exportar = async (formato: "csv" | "xlsx") => {
    setExportando(formato);
    try {
      const filtros = filtrosRef.current;
      const pabellonSel = pabellonesRef.current.find((item) => item.label === filtros.pabellon);
      const acumulados: GessStandDTO[] = [];
      let pagina = 1;
      let totalPaginas = 1;
      do {
        const respuesta = await gessService.list(eventoId, {
          page: pagina,
          per_page: 100,
          search: filtros.search.trim() || undefined,
          estado: filtros.estadoFiltro === UI_SENTINEL.TODOS ? undefined : filtros.estadoFiltro,
          tipo: filtros.tipo === UI_SENTINEL.TODOS ? undefined : filtros.tipo,
          planoCodigo: filtros.pabellon === UI_SENTINEL.TODOS || filtros.pabellon === SIN_PABELLON ? undefined : pabellonSel?.codigo,
          sinPabellon: filtros.pabellon === SIN_PABELLON,
        });
        acumulados.push(...respuesta.data);
        totalPaginas = respuesta.pagination.total_pages;
        pagina += 1;
      } while (pagina <= totalPaginas && acumulados.length < EXPORT_MAX_FILAS);

      /* Reporte: solo stands vinculados a un bloque del plano (excluye sueltos/mock). */
      const exportables = acumulados.filter((row) => Boolean(row.bloqueId)).slice(0, EXPORT_MAX_FILAS);
      if (exportables.length === 0) {
        toast.error("No hay stands vinculados para exportar con los filtros actuales");
        return;
      }
      const columnas: ColumnaExportacion<GessStandDTO>[] = [
        { encabezado: "Stand", valor: (r) => r.standCode },
        { encabezado: "Pabellon", valor: (r) => pabellonDe(r) },
        { encabezado: "Tipo", valor: (r) => r.tipoStand ?? "" },
        { encabezado: "Estado", valor: (r) => estadoStandBadge(r.estado)?.texto ?? r.estado ?? "" },
        { encabezado: "Empresa / Titulo", valor: (r) => r.empresa ?? r.preReservaRazonSocial ?? r.preReservaTitulo ?? "" },
        { encabezado: "RUC", valor: (r) => r.preReservaRuc ?? "" },
        { encabezado: "SIE", valor: (r) => r.preReservaSie ?? "" },
        { encabezado: "Nota", valor: (r) => (r.estado === ESTADOS_STAND.PRE_RESERVADO ? (r.preReservaNota ?? "") : "") },
        { encabezado: "Pre-reservado por", valor: (r) => r.preReservaPor ?? "" },
        { encabezado: "Fecha pre-reserva", valor: (r) => (r.preReservaAt ? dateUtils.formatDateTime(r.preReservaAt) : "") },
        { encabezado: "Actualizado", valor: (r) => dateUtils.formatDateTime(r.updatedAt) },
      ];
      if (formato === "csv") {
        exportarTablaCsv(exportables, columnas, nombreArchivoExport("pre-reservas", "csv"));
      } else {
        await exportarTablaExcel(exportables, columnas, nombreArchivoExport("pre-reservas", "xlsx"), "Pre-reservas");
      }
      toast.success(`${exportables.length} stand(s) vinculado(s) exportado(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo exportar la bandeja");
    } finally {
      setExportando(null);
    }
  };
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bookmark className="h-4 w-4" />
            Pre-reservas del evento
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={exportando !== null || loading || pagination.total === 0}>
                  <Download className={`h-3.5 w-3.5 ${exportando ? "animate-pulse" : ""}`} />
                  {exportando ? "Exportando..." : "Exportar"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel><span>Solo vinculados</span></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={exportando !== null} onSelect={() => { void exportar("xlsx"); }}>
                  <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
                  <span>Excel (.xlsx)</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={exportando !== null} onSelect={() => { void exportar("csv"); }}>
                  <FileText className="mr-2 h-3.5 w-3.5" />
                  <span>CSV (.csv)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              disabled={seleccionadosDisponibles.length === 0}
              onClick={abrirPreReserva}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Pre-reservar ({seleccionadosDisponibles.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={seleccionadosPre.length === 0}
              onClick={() => { void liberar(); }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Liberar ({seleccionadosPre.length})
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar stand o empresa"
              className="pl-8"
            />
          </div>
          <Select value={pabellon} onValueChange={(v) => cambiarFiltro({ pabellon: v })}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Pabellon" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UI_SENTINEL.TODOS}><span>Todos los pabellones</span></SelectItem>
              {pabellonesPlano.map((p) => <SelectItem key={p.label} value={p.label}><span>{p.label}</span></SelectItem>)}
              <SelectItem value={SIN_PABELLON}><span>{SIN_PABELLON}</span></SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={(v) => cambiarFiltro({ tipo: v })}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UI_SENTINEL.TODOS}><span>Todos los tipos</span></SelectItem>
              {tipos.map((t) => <SelectItem key={t} value={t}><span>{t}</span></SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={estadoFiltro} onValueChange={(v) => cambiarFiltro({ estadoFiltro: v })}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UI_SENTINEL.TODOS}><span>Todos los estados</span></SelectItem>
              <SelectItem value={ESTADOS_STAND.DISPONIBLE}><span>Disponibles</span></SelectItem>
              <SelectItem value={ESTADOS_STAND.PRE_RESERVADO}><span>Pre-reservados</span></SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={toggleTodosPagina} disabled={seleccionablesPagina.length === 0}>
            {todosPaginaSeleccionados ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {todosPaginaSeleccionados ? "Quitar seleccion de pagina" : `Seleccionar pagina (${seleccionablesPagina.length})`}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {pagination.total} stands &middot; seleccionados: {seleccion.size}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton rows={Math.min(perPage, 8)} />
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No hay stands con los filtros actuales.</p>
        ) : (
          <>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Stand</TableHead>
                  <TableHead>Pabellon</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Empresa / Titulo</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const badge = estadoStandBadge(r.estado);
                  const seleccionable = ESTADOS_SELECCIONABLES.includes(r.estado ?? "");
                  const checked = seleccion.has(r.id);
                  return (
                    <TableRow
                      key={r.id}
                      className={seleccionable ? "cursor-pointer" : "opacity-70"}
                      onClick={() => toggle(r)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          disabled={!seleccionable}
                          onCheckedChange={() => toggle(r)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Seleccionar stand ${r.standCode}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.standCode}</TableCell>
                      <TableCell className="text-xs">{pabellonDe(r)}</TableCell>
                      <TableCell className="text-xs">{r.tipoStand ?? "-"}</TableCell>
                      <TableCell>
                        {badge ? <Badge className={badge.clase}>{badge.texto}</Badge> : <span className="text-xs text-muted-foreground">{r.estado ?? "-"}</span>}
                      </TableCell>
                      <TableCell className="text-xs" title={r.preReservaRazonSocial ?? r.preReservaTitulo ?? r.empresa ?? undefined}>
                        <span className="flex items-center gap-2">
                          {r.estado === ESTADOS_STAND.PRE_RESERVADO && r.preReservaLogoUrl && (
                            <img src={r.preReservaLogoUrl} alt="" className="h-4 w-4 rounded border bg-white object-contain" />
                          )}
                          {r.empresa ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={r.preReservaNota ?? undefined}>
                        {r.estado === ESTADOS_STAND.PRE_RESERVADO ? (r.preReservaNota ?? "-") : "-"}
                      </TableCell>
                      <TableCell>
                        {r.estado === ESTADOS_STAND.PRE_RESERVADO && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Editar pre-reserva"
                            onClick={(e) => { e.stopPropagation(); abrirEditar(r); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {pagination.total} resultados &middot; pagina {pagination.page} de {pagination.totalPages || 1}
              </span>
              <Select value={String(perPage)} onValueChange={(v) => cambiarPerPage(Number(v))}>
                <SelectTrigger className="h-7 w-[72px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPCIONES.map((n) => (
                    <SelectItem key={n} value={String(n)}><span>{n}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(p) => { setPage(p); void load(p); }}
            />
          </div>
          </>
        )}
      </CardContent>

      <Dialog open={modalAbierto} onOpenChange={(open) => { if (!guardando) { setModalAbierto(open); if (!open) setEditRow(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editRow ? `Editar pre-reserva · ${editRow.standCode}` : `Pre-reservar ${seleccionadosDisponibles.length} stand(s)`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs value={modo} onValueChange={(v) => setModo(v as "empresa" | "titulo")}>
              <TabsList className="w-full">
                <TabsTrigger value="empresa" className="flex-1"><span>Empresa</span></TabsTrigger>
                <TabsTrigger value="titulo" className="flex-1"><span>Titulo</span></TabsTrigger>
              </TabsList>
            </Tabs>
            {modo === "empresa" ? (
              <EmpresaPicker seleccion={empresa} onSeleccion={setEmpresa} />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="pre-reserva-titulo">Titulo</Label>
                <Input
                  id="pre-reserva-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={200}
                  placeholder="Ej. Reservado para auspicios / bloqueo interno"
                />
                <p className="text-[11px] text-muted-foreground">Se muestra en el plano (hover) tal como lo escribas.</p>
              </div>
            )}
            <div>
              <Label className="text-xs">Logo (opcional)</Label>
              <div className="mt-1 flex items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo de la empresa" className="h-12 w-12 rounded-lg border bg-white object-contain p-1" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                  </span>
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onLogoFile(e); }} />
                <Button type="button" variant="outline" size="sm" className="rounded-full text-xs" disabled={subiendoLogo} onClick={() => logoRef.current?.click()}>
                  {subiendoLogo ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                  {logoUrl ? "Cambiar logo" : "Subir logo"}
                </Button>
                {logoUrl && (
                  <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs text-destructive" onClick={() => setLogoUrl("")}>
                    Quitar
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Se pinta en los stands pre-reservados del mapa.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pre-reserva-nota">Nota (opcional)</Label>
              <Input
                id="pre-reserva-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={300}
                placeholder="Ej. reserva previa por acuerdo comercial"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={guardando} onClick={() => setModalAbierto(false)}>Cancelar</Button>
            <Button disabled={guardando || (modo === "empresa" ? !empresa : !titulo.trim())} onClick={() => { void confirmarPreReserva(); }}>
              {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editRow ? <Pencil className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
              {editRow ? "Guardar cambios" : "Pre-reservar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </Card>
  );
}
