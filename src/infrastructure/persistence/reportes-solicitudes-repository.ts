import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type { IReportesSolicitudesRepository } from "@/domain/ports/reportes-solicitudes-repository";
import type { EmpresaPaisReporte, ResumenPaisSolicitudes } from "@/domain/models/reportes";

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
        COALESCE(NULLIF(e.pais, ''), 'SIN_PAIS') AS pais,
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

  async empresasPorPais(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<EmpresaPaisReporte[]> {
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

    const filas = await prisma.$queryRaw<Array<{
      empresa_id: string | null;
      pais: string;
      ruc: string | null;
      tipo_documento: string | null;
      razon_social: string;
      estado: string | null;
      datos_validados_en: Date | null;
      solicitudes: number;
      solicitudes_activas: number;
      solicitudes_inactivas: number;
    }>>(Prisma.sql`
      WITH sol_base AS (
        SELECT
          s.id,
          s.email,
          s.flg_activo,
          COALESCE(
            (SELECT gs.empresa FROM gess_stand gs WHERE gs.id = s.gess_stand_id),
            (SELECT gs.empresa FROM solicitud_stand ss JOIN gess_stand gs ON gs.id = ss.gess_stand_id WHERE ss.solicitud_id = s.id ORDER BY ss.id LIMIT 1),
            (SELECT ur.nombre_empresa FROM user_role ur WHERE ur.user_id = s.user_id AND ur.nombre_empresa IS NOT NULL LIMIT 1)
          ) AS company_name,
          (SELECT ur.empresa_id FROM user_role ur WHERE ur.user_id = s.user_id AND ur.empresa_id IS NOT NULL LIMIT 1) AS empresa_id
        FROM solicitud s
        WHERE true ${filtroActivo} ${filtroEvento}
      )
      SELECT
        e.id AS empresa_id,
        COALESCE(NULLIF(e.pais, ''), 'SIN_PAIS') AS pais,
        e.ruc,
        e.tipo_documento,
        COALESCE(e.razon_social, sb.company_name, sb.email, 'Sin empresa') AS razon_social,
        e.estado,
        e.datos_validados_en,
        COUNT(DISTINCT sb.id)::int AS solicitudes,
        COUNT(DISTINCT sb.id) FILTER (WHERE sb.flg_activo)::int AS solicitudes_activas,
        COUNT(DISTINCT sb.id) FILTER (WHERE NOT sb.flg_activo)::int AS solicitudes_inactivas
      FROM sol_base sb
      LEFT JOIN empresa e ON e.id = sb.empresa_id
      GROUP BY e.id, COALESCE(NULLIF(e.pais, ''), 'SIN_PAIS'), e.ruc, e.tipo_documento, e.estado, e.datos_validados_en,
        COALESCE(e.razon_social, sb.company_name, sb.email, 'Sin empresa')
      ORDER BY solicitudes DESC, razon_social ASC
    `);

    return filas.map((fila) => ({
      empresaId: fila.empresa_id,
      pais: fila.pais === "SIN_PAIS" ? null : fila.pais,
      ruc: fila.ruc,
      tipoDocumento: fila.tipo_documento,
      razonSocial: fila.razon_social,
      estado: fila.estado,
      solicitudes: fila.solicitudes,
      solicitudesActivas: fila.solicitudes_activas,
      solicitudesInactivas: fila.solicitudes_inactivas,
      datosValidadosEn: fila.datos_validados_en ? fila.datos_validados_en.toISOString() : null,
    }));
  }
}
