"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
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
} from "@nrivera-iimp/ui-kit-iimp";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  History,
  RefreshCw,
  Scale,
  Search,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DdEstadoBadge, DdReputacionBadge } from "./dd-estado-badge";
import { DdHistorialDialog } from "./dd-historial-dialog";
import { DdLegalModal } from "./dd-legal-modal";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import {
  BADGE_STYLES,
  DD_PER_PAGE_DEFAULT,
  DD_REPUTACION_ESTADOS,
  PER_PAGE_OPCIONES,
} from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import type { DdBandejaResponseDTO, DdBandejaRowDTO } from "@/types/dto/debida-diligencia";

const VACIO: DdBandejaResponseDTO = {
  data: [],
  total: 0,
  page: 1,
  perPage: DD_PER_PAGE_DEFAULT,
  totalPages: 0,
  resumen: {
    total: 0,
    pendientes: 0,
    enRevision: 0,
    observadas: 0,
    aprobadas: 0,
    revalidacionPendiente: 0,
    vencidas: 0,
    rechazadas: 0,
  },
};

export function DdLegalBandeja() {
  const [data, setData] = useState<DdBandejaResponseDTO>(VACIO);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DD_PER_PAGE_DEFAULT);
  const [search, setSearch] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<DdBandejaRowDTO | null>(null);
  const [revisando, setRevisando] = useState<DdBandejaRowDTO | null>(null);
  const [historialId, setHistorialId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let activo = true;
    debidaDiligenciaService
      .bandejaLegal({ page, perPage, search: busqueda || undefined })
      .then((resultado) => {
        if (!activo) return;
        setData(resultado);
        setSeleccionado((actual) => {
          if (resultado.data.length === 0) return null;
          if (actual && resultado.data.some((fila) => fila.id === actual.id)) return actual;
          return resultado.data[0] ?? null;
        });
      })
      .catch((e) => {
        if (activo) {
          toast.error(e instanceof Error ? e.message : "No se pudo cargar la bandeja legal");
        }
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [page, perPage, busqueda, refreshKey]);

  const conHallazgos = useMemo(
    () => data.data.filter((fila) => fila.reputacionConHallazgos > 0).length,
    [data.data],
  );
  const conPendientes = useMemo(
    () => data.data.filter((fila) => fila.reputacionPendientes > 0).length,
    [data.data],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Casos con Debida Diligencia reforzada</h1>
            <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.INDIGO}`}>
              <Scale className="mr-1 h-3 w-3" />
              <span>Legal</span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Expedientes derivados por SIG con observaciones relevantes y contingencias activas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-[11px]">
            <span className="text-muted-foreground">En revisión: <strong className="text-foreground">{data.total}</strong></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-muted-foreground">Con hallazgos: <strong className="text-destructive">{conHallazgos}</strong></span>
            <span className="h-3 w-px bg-border" />
            <span className="text-muted-foreground">Pend. Comunicaciones: <strong className="text-foreground">{conPendientes}</strong></span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              setLoading(true);
              setRefreshKey((valor) => valor + 1);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_430px]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold">Matriz de casos en revisión</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setLoading(true);
                      setSearch(e.target.value);
                      setPage(1);
                      setBusqueda(e.target.value);
                    }}
                    placeholder="Empresa, RUC, vínculo o código"
                    className="h-8 w-full pl-9 text-xs sm:w-64"
                  />
                </div>
                <Select
                  value={String(perPage)}
                  onValueChange={(valor) => {
                    setLoading(true);
                    setPerPage(Number(valor));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[92px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PER_PAGE_OPCIONES.map((opcion) => (
                      <SelectItem key={opcion} value={String(opcion)}>
                        {opcion} filas
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {loading ? (
              <TableSkeleton rows={perPage} columns={7} />
            ) : data.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <FileSearch className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Sin expedientes en revisión legal</p>
                <p className="text-xs text-muted-foreground">
                  Los expedientes derivados por Logística aparecerán aquí.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader className="bg-secondary/40">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase tracking-wide">Empresa / RUC</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wide">Vínculo evaluado</TableHead>
                        <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Motivo observación</TableHead>
                        <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Reputación</TableHead>
                        <TableHead className="hidden text-[10px] uppercase tracking-wide xl:table-cell">Derivado</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wide">Estado</TableHead>
                        <TableHead className="text-right text-[10px] uppercase tracking-wide">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.data.map((fila) => {
                        const vinculo = fila.empresa.representanteLegalNombre ?? fila.beneficiarios[0]?.nombre ?? "Sin vínculo registrado";
                        const documento = fila.empresa.representanteLegalDni ?? fila.beneficiarios[0]?.documento ?? "";
                        return (
                          <TableRow
                            key={fila.id}
                            className={`cursor-pointer transition-colors ${
                              seleccionado?.id === fila.id ? "border-l-2 border-primary bg-primary/5" : "hover:bg-secondary/40"
                            }`}
                            onClick={() => setSeleccionado(fila)}
                          >
                            <TableCell className="max-w-[230px]">
                              <p className="truncate text-xs font-semibold text-foreground">{fila.empresa.razonSocial}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">RUC {fila.empresa.ruc}</p>
                              <p className="text-[10px] text-muted-foreground">{fila.codigo}</p>
                            </TableCell>
                            <TableCell className="max-w-[190px]">
                              <p className="truncate text-xs font-medium text-foreground">{vinculo}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {documento ? `Doc. ${documento}` : "Representante legal"}
                              </p>
                            </TableCell>
                            <TableCell className="hidden max-w-[220px] text-[11px] text-muted-foreground md:table-cell">
                              <p className="line-clamp-2">{fila.motivoRechazo ?? "Derivado a revisión legal"}</p>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {fila.reputacionCasos > 0 ? (
                                <DdReputacionBadge estado={fila.reputacionEstado ?? DD_REPUTACION_ESTADOS.POR_REVISAR} />
                              ) : (
                                <span className="text-[11px] text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden text-[11px] text-muted-foreground xl:table-cell">
                              {fila.fechaEnvio ? dateUtils.format(fila.fechaEnvio) : "-"}
                            </TableCell>
                            <TableCell>
                              <DdEstadoBadge estado={fila.estado} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-[11px]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSeleccionado(fila);
                                  setRevisando(fila);
                                }}
                              >
                                <Scale className="h-3.5 w-3.5" />
                                <span>Revisar</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-muted-foreground">
                    {data.total} expediente(s) · página {data.page} de {data.totalPages || 1}
                  </span>
                  <Pagination
                    page={data.page}
                    totalPages={data.totalPages}
                    onPageChange={(p) => {
                      setLoading(true);
                      setPage(p);
                    }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit xl:sticky xl:top-16">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-bold text-primary">Detalle y dictamen legal</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Expediente derivado por SIG para revisión y decisión legal.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {!seleccionado ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Scale className="h-7 w-7 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Selecciona un expediente para revisar su dictamen.</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-secondary/40 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                          {seleccionado.codigo}
                        </span>
                        <DdEstadoBadge estado={seleccionado.estado} />
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-primary">{seleccionado.empresa.razonSocial}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">RUC {seleccionado.empresa.ruc}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {seleccionado.reputacionConHallazgos > 0 ? (
                        <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.DESTRUCTIVE}`}>
                          <AlertTriangle className="h-3 w-3" />
                          <span>Riesgo reputacional</span>
                        </Badge>
                      ) : seleccionado.reputacionPendientes > 0 ? (
                        <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.WARNING}`}>
                          <Clock className="h-3 w-3" />
                          <span>Pend. Comunicaciones</span>
                        </Badge>
                      ) : (
                        <Badge className={`pointer-events-none gap-1 text-[10px] ${BADGE_STYLES.SUCCESS}`}>
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Sin hallazgos</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
                    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Vínculo observado en derivación SIG
                      </p>
                      <p className="truncate text-xs font-semibold text-foreground">
                        {seleccionado.empresa.representanteLegalNombre ?? seleccionado.beneficiarios[0]?.nombre ?? "Sin vínculo registrado"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {seleccionado.empresa.representanteLegalDni
                          ? `Documento ${seleccionado.empresa.representanteLegalDni}`
                          : seleccionado.beneficiarios[0]?.documento
                            ? `Documento ${seleccionado.beneficiarios[0].documento}`
                            : "Sin documento registrado"}
                      </p>
                    </div>
                  </div>
                  {seleccionado.beneficiarios.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Beneficiarios / socios ({seleccionado.beneficiarios.length})
                      </p>
                      {seleccionado.beneficiarios.slice(0, 3).map((beneficiario) => (
                        <p key={beneficiario.id} className="truncate text-[11px] text-foreground">
                          {beneficiario.nombre}{" "}
                          <span className="text-muted-foreground">
                            · {[beneficiario.tipoDocumento, beneficiario.documento].filter(Boolean).join(" ")}
                          </span>
                        </p>
                      ))}
                      {seleccionado.beneficiarios.length > 3 ? (
                        <p className="text-[10px] text-muted-foreground">
                          + {seleccionado.beneficiarios.length - 3} beneficiario(s) más
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Motivo de la derivación de Logística
                  </h3>
                  <p className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-[11px] text-foreground">
                    {seleccionado.motivoRechazo ?? "Sin motivo registrado."}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Derivado: {seleccionado.fechaEnvio ? dateUtils.format(seleccionado.fechaEnvio) : "-"}</span>
                    <span>Vence: {seleccionado.fechaVencimiento ? dateUtils.format(seleccionado.fechaVencimiento) : "-"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Revisión de Comunicaciones
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg border border-border bg-card p-2">
                      <p className="text-[10px] text-muted-foreground">Casos</p>
                      <p className="font-semibold text-foreground">{seleccionado.reputacionCasos}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-2">
                      <p className="text-[10px] text-muted-foreground">Pendientes</p>
                      <p className="font-semibold text-foreground">{seleccionado.reputacionPendientes}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-2">
                      <p className="text-[10px] text-muted-foreground">Con hallazgos</p>
                      <p className="font-semibold text-destructive">{seleccionado.reputacionConHallazgos}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-2">
                      <p className="text-[10px] text-muted-foreground">Sin hallazgos</p>
                      <p className="font-semibold text-success">{seleccionado.reputacionSinHallazgos}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documentos</h3>
                    <span className="font-mono text-foreground">
                      {seleccionado.documentoCargados}/{seleccionado.documentoTotal}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${seleccionado.documentoTotal > 0 ? (seleccionado.documentoCargados / seleccionado.documentoTotal) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setRevisando(seleccionado)}
                  >
                    <Scale className="h-3.5 w-3.5" />
                    <span>Revisar y dictaminar</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setHistorialId(seleccionado.id)}
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Ver historial</span>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {revisando ? (
        <DdLegalModal
          fila={revisando}
          onClose={() => setRevisando(null)}
          onDone={() => {
            setRevisando(null);
            setLoading(true);
            setRefreshKey((valor) => valor + 1);
          }}
        />
      ) : null}

      <DdHistorialDialog
        expedienteId={historialId}
        open={historialId !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setHistorialId(null);
        }}
      />
    </div>
  );
}
