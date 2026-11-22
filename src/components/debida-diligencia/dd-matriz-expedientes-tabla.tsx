"use client";

import Link from "next/link";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nrivera-iimp/ui-kit-iimp";
import { AlertTriangle, Eye } from "lucide-react";
import { DdEstadoBadge } from "./dd-estado-badge";
import { DdMatrizResultadoFinalBadge } from "./dd-matriz-badges";
import { BADGE_STYLES, DD_RUTAS } from "@/lib/shared/constants";
import { dateUtils } from "@/lib/shared/utils/date";
import { etiquetaCantidadVinculos } from "@/lib/shared/utils/dd-matriz-evaluacion";
import type { DdMatrizAreaResumen, DdMatrizExpedienteResumen } from "@/lib/shared/utils/dd-matriz-expediente-resumen";

const ESTILO_AREA: Record<DdMatrizAreaResumen["estado"], string> = {
  pendiente: BADGE_STYLES.NEUTRAL,
  parcial: BADGE_STYLES.INFO,
  observado: BADGE_STYLES.WARNING,
  aceptado: BADGE_STYLES.SUCCESS,
};

const ETIQUETA_AREA: Record<DdMatrizAreaResumen["estado"], string> = {
  pendiente: "Pendiente",
  parcial: "En curso",
  observado: "Observado",
  aceptado: "Aceptado",
};

function Area({ resumen }: { resumen: DdMatrizAreaResumen }) {
  return (
    <div className="space-y-0.5">
      <Badge className={`pointer-events-none text-[9px] ${ESTILO_AREA[resumen.estado]}`}>
        <span>{ETIQUETA_AREA[resumen.estado]}</span>
      </Badge>
      <p className="text-[10px] text-muted-foreground">
        {resumen.evaluados}/{resumen.total} vínculos
      </p>
    </div>
  );
}

interface Props {
  expedientes: DdMatrizExpedienteResumen[];
}

/** Vista extendida: un registro por expediente (empresa) con solo los indicadores clave. */
export function DdMatrizExpedientesTabla({ expedientes }: Props) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px] uppercase tracking-wide">Empresa</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide">Expediente</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide">Estado</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide">Vínculos</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide">SIG</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide">Comunicaciones</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wide">Legal</TableHead>
            <TableHead className="text-center text-[10px] uppercase tracking-wide">Conclusión final</TableHead>
            <TableHead className="text-center text-[10px] uppercase tracking-wide">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expedientes.map((expediente) => (
            <TableRow key={expediente.expedienteId}>
              <TableCell className="max-w-[280px]">
                <p className="truncate text-xs font-semibold text-foreground" title={expediente.empresaRazonSocial}>
                  {expediente.empresaRazonSocial}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">RUC {expediente.empresaRuc}</p>
              </TableCell>
              <TableCell>
                <p className="font-mono text-[11px] font-medium text-foreground">{expediente.codigo}</p>
                <p className="text-[10px] text-muted-foreground">
                  {expediente.eventoLabel} · {dateUtils.format(expediente.fechaIngreso)}
                </p>
              </TableCell>
              <TableCell>
                <DdEstadoBadge estado={expediente.expedienteEstado} />
              </TableCell>
              <TableCell>
                <p className="text-xs font-medium text-foreground">{etiquetaCantidadVinculos(expediente.totalVinculos)}</p>
                {expediente.vinculosObservados > 0 ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{expediente.vinculosObservados} con observaciones</span>
                  </p>
                ) : null}
              </TableCell>
              <TableCell>
                <Area resumen={expediente.sig} />
              </TableCell>
              <TableCell>
                <Area resumen={expediente.comunicaciones} />
              </TableCell>
              <TableCell>
                <Area resumen={expediente.legal} />
              </TableCell>
              <TableCell className="text-center">
                <DdMatrizResultadoFinalBadge valor={expediente.conclusionFinal} />
              </TableCell>
              <TableCell className="text-center">
                <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-[11px]">
                  <Link href={`${DD_RUTAS.MATRIZ}/${expediente.empresaVinculoId}`} title="Abrir la empresa en la matriz">
                    <Eye className="h-3.5 w-3.5" />
                    <span>Abrir</span>
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
