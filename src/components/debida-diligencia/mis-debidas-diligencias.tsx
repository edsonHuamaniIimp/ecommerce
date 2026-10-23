"use client";

import { useEffect, useState } from "react";
import {
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
} from "@nrivera-iimp/ui-kit-iimp";
import { History, Search, ShieldCheck } from "lucide-react";
import { PaginaDashboard } from "@/components/dashboard/pagina-dashboard";
import { Pagination } from "@/components/shared/pagination";
import { DdEstadoBadge, DdVigenciaBadge } from "./dd-estado-badge";
import { DdEventoSelect } from "./dd-evento-select";
import { DdHistorialDialog } from "./dd-historial-dialog";
import { useSesion } from "@/hooks/use-sesion";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { dateUtils } from "@/lib/shared/utils/date";
import { ddUtils } from "@/lib/shared/utils/debida-diligencia";
import {
  DD_ESTADOS,
  DD_ESTADO_LABELS,
  DD_PER_PAGE_DEFAULT,
} from "@/lib/shared/constants";
import type { DdMisExpedientesResponseDTO } from "@/types/dto/debida-diligencia";

const ESTADOS = [
  DD_ESTADOS.BORRADOR,
  DD_ESTADOS.EN_REVISION,
  DD_ESTADOS.EN_LEGAL,
  DD_ESTADOS.OBSERVADA,
  DD_ESTADOS.APROBADA,
  DD_ESTADOS.RECHAZADA,
];

const VACIO: DdMisExpedientesResponseDTO = {
  items: [],
  pagination: { page: 1, perPage: DD_PER_PAGE_DEFAULT, total: 0, totalPages: 0 },
};

/** Historial de todas las DD de la empresa del cliente. */
export function MisDebidasDiligencias() {
  const { session } = useSesion();
  const [data, setData] = useState<DdMisExpedientesResponseDTO>(VACIO);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [page, setPage] = useState(1);
  const [historialId, setHistorialId] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    debidaDiligenciaService
      .misExpedientes({
        page,
        perPage: DD_PER_PAGE_DEFAULT,
        search: search.trim() || undefined,
        estado: estado || undefined,
        eventoId: eventoId || undefined,
      })
      .then((resultado) => {
        if (activo) setData(resultado);
      })
      .catch(() => {
        if (activo) setData(VACIO);
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [estado, eventoId, page, search]);

  return (
    <PaginaDashboard
      titulo="Mis debidas diligencias"
      descripcion="Consulta todas las evaluaciones realizadas a tu empresa, su vigencia y el historial de cada expediente."
      cargando={loading && data.items.length === 0}
      tieneEvento={Boolean(session?.eventoId)}
      accion={
        <Badge className="pointer-events-none gap-1 bg-primary/10 text-[11px] text-primary">
          <ShieldCheck className="h-3 w-3" />
          <span>{data.pagination.total} registros</span>
        </Badge>
      }
    >
      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setLoading(true);
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por código de expediente..."
                className="h-8 pl-8 text-xs"
              />
            </div>
            <DdEventoSelect
              value={eventoId}
              onChange={(id) => {
                setLoading(true);
                setEventoId(id);
                setPage(1);
              }}
            />
            <Select
              value={estado || "todos"}
              onValueChange={(valor) => {
                setLoading(true);
                setEstado(valor === "todos" ? "" : valor);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[170px] border-border text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {DD_ESTADO_LABELS[valor] ?? valor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {loading && data.items.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : data.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
              <ShieldCheck className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">No hay debidas diligencias con estos filtros.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Puedes iniciar una nueva desde Mi debida diligencia.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wide">Expediente</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Evento</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide md:table-cell">Vínculos</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide">Estado</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Inicio</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Fin de DD</TableHead>
                      <TableHead className="hidden text-[10px] uppercase tracking-wide lg:table-cell">Cese</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((expediente) => (
                      <TableRow key={expediente.id}>
                        <TableCell className="max-w-[220px]">
                          <p className="font-mono text-xs font-semibold text-foreground">{expediente.codigo}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {expediente.empresa.razonSocial}
                          </p>
                        </TableCell>
                        <TableCell className="max-w-[220px] text-xs">
                          <p className="truncate font-medium text-foreground">{expediente.evento.nombre}</p>
                          <p className="text-[11px] text-muted-foreground">{expediente.evento.anio}</p>
                        </TableCell>
                        <TableCell className="hidden max-w-[220px] truncate text-xs md:table-cell">
                          {ddUtils.etiquetaVinculos(expediente.tipoRelacionComercial) || "—"}
                        </TableCell>
                        <TableCell>
                          <DdEstadoBadge estado={expediente.estado} />
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                          {expediente.fechaEnvio ? dateUtils.format(expediente.fechaEnvio) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                          {expediente.fechaRevision ? dateUtils.format(expediente.fechaRevision) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                          <div className="space-y-1">
                            <span>{expediente.fechaVencimiento ? dateUtils.format(expediente.fechaVencimiento) : "—"}</span>
                            <DdVigenciaBadge
                              estado={expediente.estado}
                              fechaVencimiento={expediente.fechaVencimiento}
                              fechaAprobacion={expediente.fechaAprobacion}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-[11px]"
                            onClick={() => setHistorialId(expediente.id)}
                          >
                            <History className="h-3.5 w-3.5" />
                            <span>Ver historial</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                onPageChange={(nuevaPagina) => {
                  setLoading(true);
                  setPage(nuevaPagina);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      <DdHistorialDialog
        expedienteId={historialId}
        open={historialId !== null}
        onOpenChange={(abierto) => { if (!abierto) setHistorialId(null); }}
      />
    </PaginaDashboard>
  );
}
