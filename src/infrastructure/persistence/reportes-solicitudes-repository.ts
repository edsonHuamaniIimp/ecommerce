import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type { IReportesSolicitudesRepository } from "@/domain/ports/reportes-solicitudes-repository";
import type { ResumenPaisSolicitudes } from "@/domain/models/reportes";

interface FilaResumenPais {
  pais: string;
  empresas: number;
  solicitudes: number;
}

export class ReportesSolicitudesPrismaRepository implements IReportesSolicitudesRepository {
  async resumenPorPais(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<ResumenPaisSolicitudes[]> {
    const filtroActivo = params.incluirInactivas ? Prisma.empty : Prisma.sql`AND s.flg_activo = true`;
    const filtroEvento = params.eventoId
      ? Prisma.sql`AND (
          EXISTS (SELECT 1 FROM gess_stand gs_evento WHERE gs_evento.id = s.gess_stand_id AND gs_evento.evento_id = ${params.eventoId})
          OR EXISTS (
            SELECT 1
            FROM solicitud_stand ss_evento
            JOIN gess_stand gs_evento2 ON gs_evento2.id = ss_evento.gess_stand_id
            WHERE ss_evento.solicitud_id = s.id AND gs_evento2.evento_id = ${params.eventoId}
          )
        )`
      : Prisma.empty;

    const filas = await prisma.$queryRaw<FilaResumenPais[]>(Prisma.sql`
      WITH sol_base AS (
        SELECT
          s.id,
          s.email,
          COALESCE(
            (SELECT gs.empresa FROM gess_stand gs WHERE gs.id = s.gess_stand_id),
            (SELECT gs.empresa FROM solicitud_stand ss JOIN gess_stand gs ON gs.id = ss.gess_stand_id WHERE ss.solicitud_id = s.id ORDER BY ss.id LIMIT 1),
            (SELECT ur.nombre_empresa FROM user_role ur WHERE ur.user_id = s.user_id AND ur.nombre_empresa IS NOT NULL LIMIT 1)
          ) AS empresa,
          (SELECT ur.empresa_id FROM user_role ur WHERE ur.user_id = s.user_id AND ur.empresa_id IS NOT NULL LIMIT 1) AS empresa_id
        FROM solicitud s
        WHERE true ${filtroActivo} ${filtroEvento}
      )
      SELECT
        COALESCE(e.pais, 'SIN_PAIS') AS pais,
        COUNT(DISTINCT COALESCE(sb.empresa, sb.email, sb.id::text))::int AS empresas,
        COUNT(DISTINCT sb.id)::int AS solicitudes
      FROM sol_base sb
      LEFT JOIN empresa e ON e.id = sb.empresa_id
      GROUP BY 1
      ORDER BY solicitudes DESC, empresas DESC, pais ASC
    `);

    return filas.map((fila) => ({
      pais: fila.pais === "SIN_PAIS" ? null : fila.pais,
      empresas: fila.empresas,
      solicitudes: fila.solicitudes,
    }));
  }
}
