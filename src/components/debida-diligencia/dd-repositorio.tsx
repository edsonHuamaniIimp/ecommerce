"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@nrivera-iimp/ui-kit-iimp";
import { FileText, FolderOpen, Search } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import type {
  DdDocumentoDTO,
  DdExpedienteDTO,
  DdMatrizAdjuntoDTO,
  DdMatrizEvaluacionDetalleDTO,
  DdMatrizEvaluacionFilaDTO,
} from "@/types/dto/debida-diligencia";
import { DdDocumentoBadge } from "./dd-estado-badge";
import { DdEventoSelect } from "./dd-evento-select";
import { DdImportarCarpeta } from "./dd-importar-carpeta";
import { DdEvidenciaPreviewButton } from "./dd-evidencia-preview-button";
import { DdRevisionModal } from "./dd-revision-modal";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  DD_DOCUMENTO_ESTADO_LABELS,
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTOS_REQUERIDOS,
  DD_EVENTO_TODOS,
  DD_FILTRO_TODAS,
  DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS,
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_MATRIZ_EVAL_PER_PAGE_MAX,
  DD_MATRIZ_LISTAS,
  DD_MATRIZ_TIPO_VINCULO_LABELS,
  DD_MATRIZ_TIPOS_VINCULO,
  DD_REPOSITORIO_AREAS,
  DD_REPOSITORIO_AREA_OPCIONES,
  DD_REPOSITORIO_EMPRESAS_POR_PAGINA,
  DD_REPOSITORIO_FUENTES,
  DD_REPOSITORIO_RESPONSABLE_EXPEDIENTE,
  DD_REPOSITORIO_SKELETON_COLUMNS,
  DD_REPOSITORIO_SKELETON_ROWS,
  DD_REPOSITORIO_TABS,
  DD_REPOSITORIO_TIPO_LABELS,
  DD_REPOSITORIO_TIPOS,
  type DdRepositorioArea,
  type DdRepositorioTipo,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { etiquetaCantidadVinculos } from "@/lib/shared/utils/dd-matriz-evaluacion";

interface EmpresaRepositorio {
  expedienteId: string;
  codigo: string;
  eventoLabel: string;
  razonSocial: string;
  ruc: string;
  filas: DdMatrizEvaluacionFilaDTO[];
}

interface RepositorioFila {
  id: string;
  nombre: string;
  url: string;
  mimeType: string | null;
  vinculoId: string | null;
  vinculo: string;
  area: string;
  campo: string;
  fuente: string;
  fecha: string;
  responsable: string;
  estado: string;
  tipo: DdRepositorioTipo;
}

const AREA_POR_CATEGORIA: Record<string, DdRepositorioArea> = {
  [DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_INFORME]: DD_REPOSITORIO_AREAS.SIG,
  [DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_SUSTENTO]: DD_REPOSITORIO_AREAS.SIG,
  [DD_MATRIZ_ADJUNTO_CATEGORIAS.REPUTACIONAL_SUSTENTO]: DD_REPOSITORIO_AREAS.REPUTACIONAL,
  [DD_MATRIZ_ADJUNTO_CATEGORIAS.COMPLIANCE_SUSTENTO]: DD_REPOSITORIO_AREAS.LEGAL,
};

function areaCategoria(categoria: string): DdRepositorioArea {
  if (categoria.startsWith(DD_MATRIZ_CRITERIO_PREFIJO)) return DD_REPOSITORIO_AREAS.SIG;
  return AREA_POR_CATEGORIA[categoria] ?? DD_REPOSITORIO_AREAS.MATRIZ;
}

function campoCategoria(categoria: string): string {
  if (categoria.startsWith(DD_MATRIZ_CRITERIO_PREFIJO)) {
    const codigo = categoria.slice(DD_MATRIZ_CRITERIO_PREFIJO.length);
    return DD_MATRIZ_LISTAS.find((lista) => lista.codigo === codigo)?.label ?? codigo;
  }
  return DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS[categoria as keyof typeof DD_MATRIZ_ADJUNTO_CATEGORIA_LABELS] ?? categoria;
}

function filaDocumento(documento: DdDocumentoDTO): RepositorioFila {
  const titulo = DD_DOCUMENTOS_REQUERIDOS.find((item) => item.tipo === documento.tipo)?.titulo ?? documento.tipo;
  return {
    id: `doc-${documento.id}`,
    nombre: documento.nombre,
    url: documento.url,
    mimeType: null,
    vinculoId: null,
    vinculo: DD_MATRIZ_TIPO_VINCULO_LABELS[DD_MATRIZ_TIPOS_VINCULO.EMPRESA],
    area: DD_REPOSITORIO_AREAS.DOCUMENTO_BASE,
    campo: titulo,
    fuente: DD_REPOSITORIO_FUENTES.PORTAL,
    fecha: documento.updatedAt,
    responsable: DD_REPOSITORIO_RESPONSABLE_EXPEDIENTE,
    estado: documento.estado,
    tipo: DD_REPOSITORIO_TIPOS.DOCUMENTO,
  };
}

function filaAdjunto(adjunto: DdMatrizAdjuntoDTO, detalle: DdMatrizEvaluacionDetalleDTO): RepositorioFila {
  return {
    id: `adj-${adjunto.id}`,
    nombre: adjunto.nombre,
    url: adjunto.url,
    mimeType: adjunto.mimeType,
    vinculoId: detalle.id,
    vinculo: detalle.nombre,
    area: areaCategoria(adjunto.categoria),
    campo: campoCategoria(adjunto.categoria),
    fuente: adjunto.categoria.startsWith(DD_MATRIZ_CRITERIO_PREFIJO) ? DD_REPOSITORIO_FUENTES.EVIDENCIA : DD_REPOSITORIO_FUENTES.ADJUNTO,
    fecha: adjunto.createdAt,
    responsable: adjunto.creadoPor,
    estado: DD_DOCUMENTO_ESTADO_LABELS[DD_DOCUMENTO_ESTADOS.CARGADO] ?? DD_DOCUMENTO_ESTADOS.CARGADO,
    tipo: DD_REPOSITORIO_TIPOS.EVIDENCIA,
  };
}

function ArchivosTabla({ filas }: { filas: RepositorioFila[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px] uppercase">Archivo / enlace</TableHead>
            <TableHead className="text-[10px] uppercase">Área</TableHead>
            <TableHead className="text-[10px] uppercase">Campo</TableHead>
            <TableHead className="text-[10px] uppercase">Fuente</TableHead>
            <TableHead className="text-[10px] uppercase">Fecha</TableHead>
            <TableHead className="text-[10px] uppercase">Estado</TableHead>
            <TableHead className="text-right text-[10px] uppercase">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <TableRow key={fila.id}>
              <TableCell className="max-w-[280px]">
                <p className="truncate text-xs font-medium text-foreground">{fila.nombre}</p>
                <p className="text-[10px] text-muted-foreground">{DD_REPOSITORIO_TIPO_LABELS[fila.tipo]}</p>
              </TableCell>
              <TableCell className="text-xs">{fila.area}</TableCell>
              <TableCell className="max-w-[220px] truncate text-xs">{fila.campo}</TableCell>
              <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">{fila.fuente}</TableCell>
              <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">{dateUtils.format(fila.fecha)}</TableCell>
              <TableCell>
                {fila.tipo === DD_REPOSITORIO_TIPOS.DOCUMENTO ? (
                  <DdDocumentoBadge estado={fila.estado} />
                ) : (
                  <Badge className="pointer-events-none border-emerald-200 bg-emerald-50 text-[9px] text-emerald-800">
                    <span>{fila.estado}</span>
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DdEvidenciaPreviewButton url={fila.url} nombre={fila.nombre} mimeType={fila.mimeType} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DdRepositorio() {
  const [empresas, setEmpresas] = useState<EmpresaRepositorio[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expediente, setExpediente] = useState<DdExpedienteDTO | null>(null);
  const [detalles, setDetalles] = useState<DdMatrizEvaluacionDetalleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [recargaDetalle, setRecargaDetalle] = useState(0);
  const [search, setSearch] = useState("");
  const [eventoId, setEventoId] = useState<string>(DD_EVENTO_TODOS);
  const [paginaEmpresas, setPaginaEmpresas] = useState(1);
  const [tab, setTab] = useState<string>(DD_REPOSITORIO_TABS.TODOS);
  const [area, setArea] = useState<string>(DD_FILTRO_TODAS);
  const [revisionAbierta, setRevisionAbierta] = useState(false);

  const cargarEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      const primera = await ddMatrizEvaluacionService.listar({
        eventoId,
        porEmpresa: true,
        page: 1,
        perPage: DD_MATRIZ_EVAL_PER_PAGE_MAX,
      });
      const siguientes = await Promise.all(
        Array.from({ length: Math.max(0, primera.totalPages - 1) }, (_, indice) =>
          ddMatrizEvaluacionService.listar({
            eventoId,
            porEmpresa: true,
            page: indice + 2,
            perPage: DD_MATRIZ_EVAL_PER_PAGE_MAX,
          }),
        ),
      );
      const mapa = new Map<string, EmpresaRepositorio>();
      for (const fila of [primera, ...siguientes].flatMap((respuesta) => respuesta.data)) {
        const actual = mapa.get(fila.expedienteId);
        if (actual) actual.filas.push(fila);
        else {
          mapa.set(fila.expedienteId, {
            expedienteId: fila.expedienteId,
            codigo: fila.codigo,
            eventoLabel: fila.eventoLabel,
            razonSocial: fila.empresaRazonSocial,
            ruc: fila.empresaRuc,
            filas: [fila],
          });
        }
      }
      const lista = [...mapa.values()];
      setEmpresas(lista);
      setSelectedId((previo) => (previo && lista.some((item) => item.expedienteId === previo) ? previo : null));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el repositorio");
    } finally {
      setLoading(false);
    }
  }, [eventoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarEmpresas();
  }, [cargarEmpresas]);

  const empresa = empresas.find((item) => item.expedienteId === selectedId) ?? null;

  useEffect(() => {
    if (!empresa) return;
    let activo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingDetalle(true);
    Promise.all([
      debidaDiligenciaService.detalle(empresa.expedienteId),
      Promise.all(empresa.filas.map((fila) => ddMatrizEvaluacionService.detalle(fila.id))),
    ])
      .then(([exp, vinculos]) => {
        if (!activo) return;
        setExpediente(exp);
        setDetalles(vinculos);
      })
      .catch((error) => {
        if (activo) toast.error(error instanceof Error ? error.message : "No se pudieron cargar los documentos");
      })
      .finally(() => { if (activo) setLoadingDetalle(false); });
    return () => { activo = false; };
  }, [empresa, recargaDetalle]);

  const filas = useMemo<RepositorioFila[]>(() => {
    const documentos = (expediente?.documentos ?? []).map(filaDocumento);
    const evidencias = detalles.flatMap((detalle) =>
      detalle.adjuntos.map((adjunto) => filaAdjunto(adjunto, detalle)),
    );
    return [...documentos, ...evidencias];
  }, [detalles, expediente]);

  const empresasFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return empresas.filter((item) =>
      !term || [item.razonSocial, item.ruc, item.codigo].join(" ").toLowerCase().includes(term),
    );
  }, [empresas, search]);

  const totalPaginasEmpresas = Math.max(1, Math.ceil(empresasFiltradas.length / DD_REPOSITORIO_EMPRESAS_POR_PAGINA));
  const paginaEmpresasActual = Math.min(paginaEmpresas, totalPaginasEmpresas);
  const empresasPagina = empresasFiltradas.slice(
    (paginaEmpresasActual - 1) * DD_REPOSITORIO_EMPRESAS_POR_PAGINA,
    paginaEmpresasActual * DD_REPOSITORIO_EMPRESAS_POR_PAGINA,
  );

  useEffect(() => {
    if (loading || !search.trim()) return;
    if (empresasFiltradas.length === 0) return;
    const seleccionadaVisible = empresasFiltradas.some((item) => item.expedienteId === selectedId);
    const primera = empresasFiltradas[0];
    if (!seleccionadaVisible && primera) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(primera.expedienteId);
    }
  }, [empresasFiltradas, loading, search, selectedId]);

  const filasFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    const empresaCoincide = Boolean(
      term &&
      empresa &&
      [empresa.razonSocial, empresa.ruc, empresa.codigo].join(" ").toLowerCase().includes(term),
    );
    return filas.filter((fila) => {
      if (area !== DD_FILTRO_TODAS && fila.area !== area) return false;
      if (!term || empresaCoincide) return true;
      return [fila.nombre, fila.vinculo, fila.area, fila.campo, fila.fuente]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [area, empresa, filas, search]);

  const filtradas = useMemo(() => {
    if (tab === DD_REPOSITORIO_TABS.DOCUMENTOS) return filasFiltradas.filter((fila) => fila.tipo === DD_REPOSITORIO_TIPOS.DOCUMENTO);
    if (tab === DD_REPOSITORIO_TABS.EVIDENCIAS) return filasFiltradas.filter((fila) => fila.tipo === DD_REPOSITORIO_TIPOS.EVIDENCIA);
    return filasFiltradas;
  }, [filasFiltradas, tab]);

  const totalDocumentosBase = filasFiltradas.filter((fila) => fila.tipo === DD_REPOSITORIO_TIPOS.DOCUMENTO).length;
  const totalEvidencias = filasFiltradas.filter((fila) => fila.tipo === DD_REPOSITORIO_TIPOS.EVIDENCIA).length;
  const documentosBaseVisibles = filtradas.filter((fila) => fila.tipo === DD_REPOSITORIO_TIPOS.DOCUMENTO);
  const gruposVinculo = (empresa?.filas ?? []).map((fila) => ({
    fila,
    documentos: filtradas.filter((filaDocumento) => filaDocumento.vinculoId === fila.id),
  }));
  const totalEvidenciasVisibles = gruposVinculo.reduce((total, grupo) => total + grupo.documentos.length, 0);
  const sinResultados = documentosBaseVisibles.length === 0 && totalEvidenciasVisibles === 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-[10px] uppercase text-muted-foreground">Empresas</p>{loading ? <Skeleton className="mt-1 h-5 w-10" /> : <p className="text-xl font-bold">{empresas.length}</p>}</div><FolderOpen className="h-5 w-5 text-primary" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-[10px] uppercase text-muted-foreground">Documentos base</p>{loading || loadingDetalle ? <Skeleton className="mt-1 h-5 w-10" /> : <p className="text-xl font-bold">{expediente?.documentos.length ?? 0}</p>}</div><FileText className="h-5 w-5 text-primary" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-[10px] uppercase text-muted-foreground">Evidencias de matriz</p>{loading || loadingDetalle ? <Skeleton className="mt-1 h-5 w-10" /> : <p className="text-xl font-bold">{detalles.reduce((total, detalle) => total + detalle.adjuntos.length, 0)}</p>}</div><FolderOpen className="h-5 w-5 text-primary" /></CardContent></Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(evento) => { setSearch(evento.target.value); setPaginaEmpresas(1); }} placeholder="Buscar empresa, RUC, archivo o campo..." className="h-8 pl-8 text-xs" />
            </div>
            <DdEventoSelect
              value={eventoId}
              incluirTodos
              onChange={(valor) => {
                setEventoId(valor);
                setSearch("");
                setPaginaEmpresas(1);
                setSelectedId(null);
                setExpediente(null);
                setDetalles([]);
              }}
            />
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Área" /></SelectTrigger>
              <SelectContent>
                {DD_REPOSITORIO_AREA_OPCIONES.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}><span>{opcion.label}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={!empresa} onClick={() => setRevisionAbierta(true)}>
              <FileText className="h-3.5 w-3.5" /><span>Revisar expediente</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Empresas en DD ({empresasFiltradas.length})</p>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: DD_REPOSITORIO_EMPRESAS_POR_PAGINA }).map((_, indice) => <Skeleton key={indice} className="h-[68px] rounded-lg" />)}
              </div>
            ) : empresasFiltradas.length === 0 ? <p className="text-xs text-muted-foreground">Sin empresas.</p> : empresasPagina.map((item) => (
              <button key={item.expedienteId} type="button" onClick={() => setSelectedId(item.expedienteId)} className={`w-full rounded-lg border p-3 text-left transition ${selectedId === item.expedienteId ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"}`}>
                <p className="truncate text-xs font-semibold text-foreground">{item.razonSocial}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">RUC {item.ruc}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{item.eventoLabel} · {etiquetaCantidadVinculos(item.filas.length)} · {item.codigo}</p>
              </button>
            ))}
            {!loading && empresasFiltradas.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border pt-2">
                <span className="text-[10px] text-muted-foreground">
                  {empresasFiltradas.length} empresas · página {paginaEmpresasActual} de {totalPaginasEmpresas}
                </span>
                <Pagination page={paginaEmpresasActual} totalPages={totalPaginasEmpresas} onPageChange={setPaginaEmpresas} />
              </div>
            ) : null}
          </div>

          <div className="min-w-0 space-y-3">
            {loading ? (
              <div className="rounded-lg border border-border p-4"><TableSkeleton rows={DD_REPOSITORIO_SKELETON_ROWS} columns={DD_REPOSITORIO_SKELETON_COLUMNS} /></div>
            ) : empresa ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/40 p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{empresa.razonSocial}</p>
                    <p className="text-[11px] text-muted-foreground">{empresa.eventoLabel} · {empresa.codigo} · RUC {empresa.ruc}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="pointer-events-none text-[10px]"><span>{etiquetaCantidadVinculos(empresa.filas.length)}</span></Badge>
                    <DdImportarCarpeta
                      key={empresa.expedienteId}
                      empresa={{
                        id: empresa.expedienteId,
                        razonSocial: empresa.razonSocial,
                        ruc: empresa.ruc,
                        codigo: empresa.codigo,
                      }}
                      vinculos={empresa.filas.map((fila) => ({ id: fila.id, nombre: fila.nombre, tipo: fila.tipo }))}
                      onImported={() => setRecargaDetalle((valor) => valor + 1)}
                      soloBoton
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bandeja documental</p>
                      <p className="text-[10px] text-muted-foreground">Filtra los documentos base y las evidencias del expediente.</p>
                    </div>
                    <Tabs value={tab} onValueChange={setTab}>
                      <TabsList className="grid w-full grid-cols-3 sm:w-auto">
                        <TabsTrigger value={DD_REPOSITORIO_TABS.TODOS}>
                          <span>Todos</span>
                          <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">{filasFiltradas.length}</span>
                        </TabsTrigger>
                        <TabsTrigger value={DD_REPOSITORIO_TABS.DOCUMENTOS}>
                          <span>Documentos base</span>
                          <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">{totalDocumentosBase}</span>
                        </TabsTrigger>
                        <TabsTrigger value={DD_REPOSITORIO_TABS.EVIDENCIAS}>
                          <span>Evidencias</span>
                          <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">{totalEvidencias}</span>
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                {loadingDetalle ? (
                  <div className="rounded-lg border border-border p-4"><TableSkeleton rows={DD_REPOSITORIO_SKELETON_ROWS} columns={DD_REPOSITORIO_SKELETON_COLUMNS} /></div>
                ) : (
                  <>
                    {tab !== DD_REPOSITORIO_TABS.EVIDENCIAS && documentosBaseVisibles.length > 0 ? (
                      <div className="overflow-hidden rounded-lg border border-border bg-card">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                          <div>
                            <p className="text-xs font-semibold text-foreground">Documentos base del expediente</p>
                            <p className="text-[10px] text-muted-foreground">No pertenecen a un vínculo de la matriz.</p>
                          </div>
                          <Badge className="pointer-events-none text-[9px]"><span>{documentosBaseVisibles.length} documento(s)</span></Badge>
                        </div>
                        <ArchivosTabla filas={documentosBaseVisibles} />
                      </div>
                    ) : null}

                    {tab !== DD_REPOSITORIO_TABS.DOCUMENTOS ? (
                      <div className="overflow-hidden rounded-lg border border-border bg-card">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                          <div>
                            <p className="text-xs font-semibold text-foreground">Evidencias por vínculo</p>
                            <p className="text-[10px] text-muted-foreground">Abre un vínculo para revisar sus documentos y evidencias.</p>
                          </div>
                          <Badge className="pointer-events-none text-[9px]"><span>{totalEvidenciasVisibles} en total</span></Badge>
                        </div>
                        <Accordion type="multiple" className="divide-y divide-border">
                          {gruposVinculo.map(({ fila, documentos }) => {
                            const tipo = DD_MATRIZ_TIPO_VINCULO_LABELS[fila.tipo as keyof typeof DD_MATRIZ_TIPO_VINCULO_LABELS] ?? fila.tipo;
                            return (
                              <AccordionItem key={fila.id} value={fila.id} className="border-0">
                                <AccordionTrigger className="border-l-4 border-l-primary/30 bg-secondary/50 px-3 py-3 transition-colors hover:bg-secondary/70 hover:no-underline data-[state=open]:border-l-primary data-[state=open]:bg-primary/5">
                                  <div className="flex w-full flex-wrap items-center justify-between gap-2 pr-4 text-left">
                                    <div className="min-w-0">
                                      <p className="truncate text-[11px] font-semibold text-foreground">{fila.nombre}</p>
                                      <p className="text-[10px] text-muted-foreground">{tipo}</p>
                                    </div>
                                    <Badge className={`pointer-events-none text-[9px] ${documentos.length > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                                      <span>{documentos.length > 0 ? `${documentos.length} documento${documentos.length === 1 ? "" : "s"}` : "Sin documentos"}</span>
                                    </Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-0">
                                  {documentos.length === 0 ? (
                                    <p className="border-t border-border px-3 py-4 text-xs text-muted-foreground">Sin documentos para este filtro.</p>
                                  ) : (
                                    <ArchivosTabla filas={documentos} />
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>
                    ) : null}

                    {sinResultados ? (
                      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Sin documentos o evidencias para este filtro.</div>
                    ) : null}
                  </>
                )}
              </>
            ) : <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Selecciona una empresa.</div>}
          </div>

        </CardContent>
      </Card>

      {revisionAbierta && empresa ? (
        <DdRevisionModal
          fila={{ id: empresa.expedienteId, codigo: empresa.codigo, estado: "en_revision", empresa: { razonSocial: empresa.razonSocial, ruc: empresa.ruc } }}
          puedeMatriz
          onClose={() => setRevisionAbierta(false)}
          onDone={() => { setRevisionAbierta(false); void cargarEmpresas(); }}
        />
      ) : null}
    </div>
  );
}





