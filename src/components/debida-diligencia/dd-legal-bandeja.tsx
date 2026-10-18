"use client";

import { useCallback, useEffect, useState } from "react";
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
import { FileSearch, RefreshCw, Search, Scale } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DdLegalModal } from "./dd-legal-modal";
import { DdReputacionBadge } from "./dd-estado-badge";
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
  const [revisando, setRevisando] = useState<DdBandejaRowDTO | null>(null);

  const cargar = useCallback(async () => {
    try {
      const resultado = await debidaDiligenciaService.bandejaLegal({
        page,
        perPage,
        search: busqueda || undefined,
      });
      setData(resultado);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar la bandeja legal");
    } finally {
      setLoading(false);
    }
  }, [page, perPage, busqueda]);

  useEffect(() => {
    let activo = true;
    debidaDiligenciaService
      .bandejaLegal({ page, perPage, search: busqueda || undefined })
      .then((resultado) => {
        if (activo) setData(resultado);
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
  }, [page, perPage, busqueda]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Debida Diligencia
          </p>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Revisión legal
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Expedientes rechazados por Logística que requieren informe y decisión legal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`pointer-events-none text-[10px] ${BADGE_STYLES.INDIGO}`}>
            <Scale className="mr-1 h-3 w-3" />
            <span>{data.total} pendiente(s)</span>
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => { setLoading(true); void cargar(); }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold">Bandeja legal</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                    setBusqueda(e.target.value);
                    setLoading(true);
                  }}
                  placeholder="Empresa, RUC o código"
                  className="h-8 w-full pl-9 text-xs sm:w-64"
                />
              </div>
              <Select
                value={String(perPage)}
                onValueChange={(valor) => {
                  setPerPage(Number(valor));
                  setPage(1);
                  setLoading(true);
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
            <TableSkeleton rows={perPage} columns={6} />
          ) : data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <FileSearch className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Sin expedientes en revisión legal</p>
              <p className="text-xs text-muted-foreground">
                Los rechazos de Logística aparecerán aquí.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wide">Empresa</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Documentos</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Motivo de Logística</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Reputación</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide xl:table-cell">Derivado</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((fila) => (
                      <TableRow key={fila.id}>
                        <TableCell className="max-w-[260px]">
                          <p className="truncate text-xs font-semibold text-foreground">{fila.empresa.razonSocial}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">RUC {fila.empresa.ruc}</p>
                          <p className="text-[10px] text-muted-foreground">{fila.codigo}</p>
                        </TableCell>
                        <TableCell className="text-xs">
                          {fila.documentoCargados}/{fila.documentoTotal}
                        </TableCell>
                        <TableCell className="max-w-[280px] text-[11px] text-muted-foreground">
                          <p className="line-clamp-2">{fila.motivoRechazo ?? "Sin motivo registrado"}</p>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {fila.reputacionCasos > 0 ? (
                            <DdReputacionBadge estado={fila.reputacionEstado ?? DD_REPUTACION_ESTADOS.POR_REVISAR} />
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-[11px] text-muted-foreground xl:table-cell">
                          {fila.fechaEnvio ? dateUtils.format(fila.fechaEnvio) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 gap-1 text-[11px]"
                            onClick={() => setRevisando(fila)}
                          >
                            <Scale className="h-3.5 w-3.5" />
                            <span>Revisar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onPageChange={(p) => { setPage(p); setLoading(true); }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {revisando ? (
        <DdLegalModal
          fila={revisando}
          onClose={() => setRevisando(null)}
          onDone={() => {
            setRevisando(null);
            setLoading(true);
            void cargar();
          }}
        />
      ) : null}
    </div>
  );
}
