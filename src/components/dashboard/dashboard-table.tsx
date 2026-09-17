"use client";

import { DataTable } from "@nrivera-iimp/ui-kit-iimp";
import type { ColumnDef } from "@tanstack/react-table";
import { TIPOS_COMPROBANTE } from "@/lib/shared/constants";
import { EstadoReservaBadge } from "@/components/estado-badge";
import { dateUtils } from "@/lib/shared/utils/date";
import type { Reserva } from "@/types/reserva";

const columns: ColumnDef<Reserva>[] = [
  {
    accessorKey: "empresaNombre",
    header: "Empresa",
    cell: ({ getValue }) => <span>{getValue() as string}</span>,
  },
  {
    accessorKey: "standIds",
    header: "Stands",
    cell: ({ getValue }) => <span>{(getValue() as string[]).length} stand(s)</span>,
  },
  {
    accessorKey: "montoTotal",
    header: "Monto",
    cell: ({ row }) => (
      <span>
        {row.original.moneda} {row.original.montoTotal.toLocaleString("en-US")}
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
    cell: ({ getValue }) => <span>{dateUtils.format(getValue() as string)}</span>,
  },
];

export function DashboardTable({ reservas }: { reservas: Reserva[] }) {
  return <DataTable columns={columns} data={reservas} />;
}
