"use client";

import { DataTable } from "@nrivera-iimp/ui-kit-iimp";
import type { ColumnDef } from "@tanstack/react-table";
import { TIPOS_COMPROBANTE } from "@/lib/shared/constants";
import { EstadoReservaBadge } from "@/components/estado-badge";
import { dateUtils } from "@/lib/shared/utils/date";
import { numberUtils } from "@/lib/shared/utils/number";
import type { Reserva } from "@/types/reserva";

const columns: ColumnDef<Reserva>[] = [
  {
    accessorKey: "id",
    header: "Codigo",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs font-semibold text-primary">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "empresaNombre",
    header: "Empresa / RUC",
    cell: ({ row }) => (
      <span className="flex flex-col">
        <span className="font-medium">{row.original.empresaNombre}</span>
        {row.original.facturacion?.ruc && (
          <span className="text-[11px] text-muted-foreground">RUC: {row.original.facturacion.ruc}</span>
        )}
      </span>
    ),
  },
  {
    accessorKey: "standIds",
    header: "Stands",
    cell: ({ row }) => <span>{row.original.standIds.length} stand(s)</span>,
  },
  {
    accessorKey: "montoTotal",
    header: "Monto",
    cell: ({ row }) => (
      <span className="font-semibold text-primary">
        {numberUtils.monto(row.original.montoTotal, row.original.moneda)}
      </span>
    ),
  },
  {
    accessorKey: "facturacion",
    header: "Comprobante",
    cell: ({ getValue }) => {
      const f = getValue() as Reserva["facturacion"];
      return <span>{f.tipoComprobante === TIPOS_COMPROBANTE.FACTURA ? "Factura" : "Boleta"}</span>;
    },
  },
  {
    accessorKey: "estado",
    header: "Estado",
    cell: ({ getValue }) => <EstadoReservaBadge estado={getValue() as Reserva["estado"]} />,
  },
  {
    accessorKey: "creadoEn",
    header: "Fecha",
    cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{dateUtils.format(getValue() as string)}</span>,
  },
];

export function DashboardTable({ reservas }: { reservas: Reserva[] }) {
  if (reservas.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        <span>No hay reservas registradas para este evento.</span>
      </p>
    );
  }
  return <DataTable columns={columns} data={reservas} />;
}
