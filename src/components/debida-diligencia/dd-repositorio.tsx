"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { FileText, FolderSearch, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DdImportarCarpeta } from "./dd-importar-carpeta";
import { DdRepositorioEmpresas, type EmpresaRepositorio } from "./dd-repositorio-empresas";
import { DdRepositorioFiltros } from "./dd-repositorio-filtros";
import { DdRepositorioResultados } from "./dd-repositorio-resultados";
import { DdRepositorioResumen } from "./dd-repositorio-resumen";
import { DdRevisionModal } from "./dd-revision-modal";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { ddMatrizEvaluacionService } from "@/lib/client/api/services/dd-matriz-evaluacion-service";
import {
  BADGE_STYLES,
  DD_EVENTO_TODOS,
  DD_MATRIZ_EVAL_PER_PAGE_MAX,
  DD_REPOSITORIO_AGRUPACIONES,
  DD_REPOSITORIO_AREA_ESTILOS,
  DD_REPOSITORIO_AREAS,
  DD_REPOSITORIO_FORMATO_LABELS,
  DD_REPOSITORIO_FORMATOS,
  DD_REPOSITORIO_ORDENES,
  DD_REPOSITORIO_SKELETON_COLUMNS,
  DD_REPOSITORIO_SKELETON_ROWS,
  DD_REPOSITORIO_TIPO_LABELS,
  DD_REPOSITORIO_TIPOS,
  type DdRepositorioAgrupacion,
  type DdRepositorioFormato,
  type DdRepositorioOrden,
} from "@/lib/shared/constants";
import { etiquetaCantidadVinculos } from "@/lib/shared/utils/dd-matriz-evaluacion";
import {
  ddRepositorioVista,
  type DdRepositorioCobertura,
  type DdRepositorioFiltros as Filtros,
} from "@/lib/shared/utils/dd-repositorio-vista";
import type { DdExpedienteDTO, DdMatrizEvaluacionDetalleDTO } from "@/types/dto/debida-diligencia";

/** Guia visual: que significa cada insignia, icono y tipo de archivo. */
function GuiaLectura() {
  return (
    <details className="group rounded-lg border border-border bg-card px-3 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground">
        <HelpCircle className="h-3.5 w-3.5 text-primary" />
        <span>¿Cómo leer esta vista?</span>
        <span className="ml-auto text-[10px] font-normal group-open:hidden">Mostrar guía</span>
        <span className="ml-auto hidden text-[10px] font-normal group-open:inline">Ocultar guía</span>
      </summary>
      <div className="mt-3 grid gap-4 border-t border-border pt-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tipos de archivo</p>
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">{DD_REPOSITORIO_TIPO_LABELS[DD_REPOSITORIO_TIPOS.DOCUMENTO]}:</strong>{" "}
            lo sube el cliente al formulario (ficha RUC, poderes, DNI…). Pertenece al expediente.
          </p>
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">{DD_REPOSITORIO_TIPO_LABELS[DD_REPOSITORIO_TIPOS.EVIDENCIA]}:</strong>{" "}
            lo adjuntan las áreas en la matriz, por criterio o como informe/sustento de un vínculo.
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Áreas</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(DD_REPOSITORIO_AREAS).map((area) => (
              <Badge key={area} className={`pointer-events-none text-[10px] ${DD_REPOSITORIO_AREA_ESTILOS[area] ?? BADGE_STYLES.NEUTRAL}`}>
                <span>{area}</span>
              </Badge>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Indica quién registró la evidencia.</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Formatos y marcas</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(DD_REPOSITORIO_FORMATOS).map((formato) => (
              <Badge key={formato} className={`pointer-events-none text-[10px] ${BADGE_STYLES.NEUTRAL}`}>
                <span>{DD_REPOSITORIO_FORMATO_LABELS[formato as DdRepositorioFormato]}</span>
              </Badge>
            ))}
            <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.SUCCESS}`}>
              <span>Nuevo</span>
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">“Nuevo”: cargado en las últimas 48 horas.</p>
        </div>
      </div>
    </details>
  );
}

export function DdRepositorio() {
  const [empresas, setEmpresas] = useState<EmpresaRepositorio[]>([]);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [expediente, setExpediente] = useState<DdExpedienteDTO | null>(null);
  const [detalles, setDetalles] = useState<DdMatrizEvaluacionDetalleDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [recargaDetalle, setRecargaDetalle] = useState(0);
  const [eventoId, setEventoId] = useState<string>(DD_EVENTO_TODOS);
  const [filtros, setFiltros] = useState<Filtros>(() => ddRepositorioVista.filtrosVacios());
  const [agrupacion, setAgrupacion] = useState<DdRepositorioAgrupacion>(DD_REPOSITORIO_AGRUPACIONES.VINCULO);
  const [orden, setOrden] = useState<DdRepositorioOrden>(DD_REPOSITORIO_ORDENES.RECIENTES);
  const [revisionAbierta, setRevisionAbierta] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());

  const cargarEmpresas = useCallback(async () => {
    setCargando(true);
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
            estado: fila.expedienteEstado,
            filas: [fila],
          });
        }
      }
      const lista = [...mapa.values()];
      setEmpresas(lista);
      setSeleccionadaId((previo) =>
        previo && lista.some((item) => item.expedienteId === previo) ? previo : (lista[0]?.expedienteId ?? null),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el repositorio");
    } finally {
      setCargando(false);
    }
  }, [eventoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarEmpresas();
  }, [cargarEmpresas]);

  const empresa = empresas.find((item) => item.expedienteId === seleccionadaId) ?? null;

  useEffect(() => {
    if (!empresa) return;
    let activo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargandoDetalle(true);
    Promise.all([
      debidaDiligenciaService.detalle(empresa.expedienteId),
      Promise.all(empresa.filas.map((fila) => ddMatrizEvaluacionService.detalle(fila.id))),
    ])
      .then(([exp, vinculos]) => {
        if (!activo) return;
        setExpediente(exp);
        setDetalles(vinculos);
        setAhora(Date.now());
      })
      .catch((error) => {
        if (activo) toast.error(error instanceof Error ? error.message : "No se pudieron cargar los documentos");
      })
      .finally(() => {
        if (activo) setCargandoDetalle(false);
      });
    return () => {
      activo = false;
    };
  }, [empresa, recargaDetalle]);

  const seleccionarEmpresa = (id: string) => {
    if (id === seleccionadaId) return;
    setSeleccionadaId(id);
    setExpediente(null);
    setDetalles([]);
    setFiltros(ddRepositorioVista.filtrosVacios());
  };

  const filas = useMemo(() => ddRepositorioVista.construirFilas(expediente, detalles), [expediente, detalles]);
  const filtradas = useMemo(
    () => ddRepositorioVista.ordenar(ddRepositorioVista.aplicarFiltros(filas, filtros, ahora), orden),
    [filas, filtros, ahora, orden],
  );
  const hayFiltros = ddRepositorioVista.contarFiltrosActivos(filtros) > 0;
  const vinculos = useMemo(
    () => (empresa?.filas ?? []).map((fila) => ({ id: fila.id, nombre: fila.nombre, tipo: fila.tipo })),
    [empresa],
  );
  const grupos = useMemo(
    () => ddRepositorioVista.agrupar(filtradas, agrupacion, { vinculos, incluirVinculosVacios: !hayFiltros }),
    [filtradas, agrupacion, vinculos, hayFiltros],
  );
  const coberturas = useMemo(
    () => Object.fromEntries(detalles.map((detalle) => [detalle.id, ddRepositorioVista.coberturaVinculo(detalle)])),
    [detalles],
  ) as Record<string, DdRepositorioCobertura>;
  const documentosBase = useMemo(() => ddRepositorioVista.coberturaDocumentosBase(expediente), [expediente]);
  const cargandoContenido = cargando || cargandoDetalle;
  const clavesResultado = `${seleccionadaId}|${agrupacion}|${JSON.stringify(filtros)}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <DdRepositorioEmpresas
          empresas={empresas}
          seleccionadaId={seleccionadaId}
          cargando={cargando}
          eventoId={eventoId}
          onEvento={(valor) => {
            setEventoId(valor);
            setSeleccionadaId(null);
            setExpediente(null);
            setDetalles([]);
            setFiltros(ddRepositorioVista.filtrosVacios());
          }}
          onSeleccionar={seleccionarEmpresa}
        />

        <div className="min-w-0 space-y-4">
          {cargando ? (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-lg" />
              <TableSkeleton rows={DD_REPOSITORIO_SKELETON_ROWS} columns={DD_REPOSITORIO_SKELETON_COLUMNS} />
            </div>
          ) : !empresa ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-12 text-center">
              <FolderSearch className="h-9 w-9 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Selecciona una empresa</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Elige una empresa de la lista para ver sus documentos base y las evidencias de cada vínculo.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-foreground">{empresa.razonSocial}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">RUC {empresa.ruc}</span>
                    <span>· {empresa.codigo}</span>
                    <span>· {empresa.eventoLabel}</span>
                    <span>· {etiquetaCantidadVinculos(empresa.filas.length)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setRevisionAbierta(true)}>
                    <FileText className="h-3.5 w-3.5" />
                    <span>Revisar expediente</span>
                  </Button>
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

              <DdRepositorioResumen
                filas={filas}
                documentosBase={documentosBase}
                coberturas={Object.values(coberturas)}
                ahora={ahora}
                cargando={cargandoDetalle}
                onTipo={(tipo) => setFiltros((previo) => ({ ...previo, tipo }))}
              />

              <GuiaLectura />

              {cargandoContenido ? (
                <TableSkeleton rows={DD_REPOSITORIO_SKELETON_ROWS} columns={DD_REPOSITORIO_SKELETON_COLUMNS} />
              ) : (
                <>
                  {filas.length > 0 ? (
                    <DdRepositorioFiltros
                      filas={filas}
                      filtros={filtros}
                      ahora={ahora}
                      agrupacion={agrupacion}
                      orden={orden}
                      mostrados={filtradas.length}
                      onFiltros={setFiltros}
                      onAgrupacion={setAgrupacion}
                      onOrden={setOrden}
                    />
                  ) : null}
                  {filas.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
                      <FolderSearch className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-semibold text-foreground">Este expediente aún no tiene archivos</p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        Aparecerán aquí los documentos del cliente y las evidencias que las áreas adjunten en la matriz.
                      </p>
                    </div>
                  ) : (
                    <DdRepositorioResultados
                      key={clavesResultado}
                      grupos={grupos}
                      agrupacion={agrupacion}
                      ahora={ahora}
                      coberturas={coberturas}
                      hayFiltros={hayFiltros}
                      total={filtradas.length}
                      onLimpiar={() => setFiltros(ddRepositorioVista.filtrosVacios())}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {revisionAbierta && empresa ? (
        <DdRevisionModal
          fila={{
            id: empresa.expedienteId,
            codigo: empresa.codigo,
            estado: empresa.estado,
            empresa: { razonSocial: empresa.razonSocial, ruc: empresa.ruc },
          }}
          puedeMatriz
          onClose={() => setRevisionAbierta(false)}
          onDone={() => {
            setRevisionAbierta(false);
            void cargarEmpresas();
          }}
        />
      ) : null}
    </div>
  );
}
