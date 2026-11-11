import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type { IReportesSolicitudesRepository } from "@/domain/ports/reportes-solicitudes-repository";
import type { BloqueMapaReporte, EmpresaPaisReporte, MapaPabellonesReporte, PabellonMapaReporte, ReporteExportacion, ReporteExportacionSolicitud, ReporteExportacionStand, ReporteSolicitudesPreReservas, ReporteStandRegistro, ResumenPaisSolicitudes } from "@/domain/models/reportes";
import { resolverPrecioStand } from "@/lib/shared/utils/precio-stand";
import { codigoComercialStand } from "@/lib/shared/utils/stand-codigo";
import { estadoSolicitudConSgc } from "@/lib/shared/utils/estado-solicitud";
import { isSgcEnabled } from "@/lib/server/sgc-config";
import { ESTADOS_STAND, REPORTES_SIN_PAIS, REPORTES_TIPOS_REGISTRO, TIPOS_PLANO } from "@/lib/shared/constants";

interface FilaExportacion {
  solicitud_id: string;
  email: string | null;
  user_id: string | null;
  estado: string | null;
  flg_activo: boolean;
  created_at: Date;
  updated_at: Date;
  stand_id: string | null;
  stand_code: string | null;
  bloque_id: string | null;
  pabellon: string | null;
  tipo_stand: string | null;
  medidas: string | null;
  raw_data: unknown;
  stand_empresa: string | null;
  razon_social: string | null;
  ruc: string | null;
  pais: string | null;
  usuario_nombre: string | null;
  usuario_apellidos: string | null;
  usuario_empresa: string | null;
}

interface FilaResumenPais {
  pais: string;
  empresas: number;
  solicitudes: number;
}

interface FilaStandRegistro {
  tipo: string;
  stand_code: string | null;
  bloque_id: string | null;
  pabellon: string | null;
  empresa: string | null;
  tipo_stand: string | null;
  medidas: string | null;
  raw_data: unknown;
  ruc: string | null;
  sie: string | null;
  estado: string | null;
  email: string | null;
  fecha: Date | null;
  nota: string | null;
  revisiones: unknown;
  sgc_lifecycle_status: string | null;
  sgc_devolucion_requiere_cambio: boolean | null;
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
        COALESCE(NULLIF(e.pais, ''), ${REPORTES_SIN_PAIS}) AS pais,
        COUNT(DISTINCT COALESCE(sb.empresa, sb.email, sb.id::text))::int AS empresas,
        COUNT(DISTINCT sb.id)::int AS solicitudes
      FROM sol_base sb
      LEFT JOIN empresa e ON e.id = sb.empresa_id
      GROUP BY 1
      ORDER BY solicitudes DESC, empresas DESC, pais ASC
    `);

    return filas.map((fila) => ({
      pais: fila.pais === REPORTES_SIN_PAIS ? null : fila.pais,
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
        COALESCE(NULLIF(e.pais, ''), ${REPORTES_SIN_PAIS}) AS pais,
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
      GROUP BY e.id, COALESCE(NULLIF(e.pais, ''), ${REPORTES_SIN_PAIS}), e.ruc, e.tipo_documento, e.estado, e.datos_validados_en,
        COALESCE(e.razon_social, sb.company_name, sb.email, 'Sin empresa')
      ORDER BY solicitudes DESC, razon_social ASC
    `);

    return filas.map((fila) => ({
      empresaId: fila.empresa_id,
      pais: fila.pais === REPORTES_SIN_PAIS ? null : fila.pais,
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

  async mapaPabellones(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<MapaPabellonesReporte> {
    const filtroActivo = params.incluirInactivas ? Prisma.empty : Prisma.sql`AND s.flg_activo = true`;
    const filtroEvento = params.eventoId
      ? Prisma.sql`AND gs.evento_id = ${params.eventoId}`
      : Prisma.empty;

    const base = Prisma.sql`
      WITH rel AS (
        SELECT s.id AS solicitud_id, s.email, s.user_id, s.gess_stand_id
        FROM solicitud s
        WHERE true ${filtroActivo}
        UNION
        SELECT s.id AS solicitud_id, s.email, s.user_id, ss.gess_stand_id
        FROM solicitud s
        JOIN solicitud_stand ss ON ss.solicitud_id = s.id
        WHERE true ${filtroActivo}
      ),
      base AS (
        SELECT
          r.solicitud_id,
          r.email,
          r.user_id,
          gs.id AS stand_id,
          gs.bloque_id,
          gs.stand_code,
          gs.pabellon,
          p.codigo AS plan_codigo,
          p.nombre AS plano_nombre,
          COALESCE(NULLIF(e.pais, ''), ${REPORTES_SIN_PAIS}) AS pais,
          COALESCE(e.id::text, r.email, r.solicitud_id::text) AS empresa_key
        FROM rel r
        LEFT JOIN gess_stand gs ON gs.id = r.gess_stand_id
        LEFT JOIN plano_bloque pb
          ON COALESCE(to_jsonb(pb)->>'bloque_id', to_jsonb(pb)->>'bloqueId') = gs.bloque_id
          AND COALESCE((to_jsonb(pb)->>'flg_activo')::boolean, true) = true
        LEFT JOIN plano p ON p.id = pb.plano_id AND p.tipo <> ${TIPOS_PLANO.MACRO}
        LEFT JOIN LATERAL (
          SELECT ur.empresa_id
          FROM user_role ur
          WHERE ur.user_id = r.user_id AND ur.empresa_id IS NOT NULL
          LIMIT 1
        ) ur ON true
        LEFT JOIN empresa e ON e.id = ur.empresa_id
        WHERE true ${filtroEvento}
      )
    `;

    const [filasPabellon, filasBloque] = await Promise.all([
      prisma.$queryRaw<Array<{
        plan_codigo: string | null;
        plano_nombre: string | null;
        pabellon: string | null;
        pais: string;
        solicitudes: number;
        empresas: number;
      }>>(Prisma.sql`
        ${base}
        SELECT
          plan_codigo,
          plano_nombre,
          pabellon,
          pais,
          COUNT(DISTINCT solicitud_id)::int AS solicitudes,
          COUNT(DISTINCT empresa_key)::int AS empresas
        FROM base
        WHERE stand_id IS NOT NULL
        GROUP BY plan_codigo, plano_nombre, pabellon, pais
        ORDER BY plan_codigo NULLS LAST, pabellon, solicitudes DESC
      `),
      prisma.$queryRaw<Array<{
        plan_codigo: string;
        bloque_id: string;
        stand_code: string | null;
        pais: string;
        solicitudes: number;
        empresas: number;
      }>>(Prisma.sql`
        ${base}
        SELECT
          plan_codigo,
          bloque_id,
          MIN(stand_code) AS stand_code,
          pais,
          COUNT(DISTINCT solicitud_id)::int AS solicitudes,
          COUNT(DISTINCT empresa_key)::int AS empresas
        FROM base
        WHERE stand_id IS NOT NULL AND plan_codigo IS NOT NULL AND bloque_id IS NOT NULL
        GROUP BY plan_codigo, bloque_id, pais
        ORDER BY plan_codigo, bloque_id, solicitudes DESC
      `),
    ]);

    const pabellones = new Map<string, PabellonMapaReporte>();
    for (const fila of filasPabellon) {
      const key = `${fila.plan_codigo ?? ""}|${fila.pabellon ?? ""}`;
      const actual = pabellones.get(key) ?? {
        planoCodigo: fila.plan_codigo,
        planoNombre: fila.plano_nombre,
        pabellon: fila.pabellon,
        empresas: 0,
        solicitudes: 0,
        paises: [],
      };
      actual.empresas += fila.empresas;
      actual.solicitudes += fila.solicitudes;
      actual.paises.push({
        pais: fila.pais === REPORTES_SIN_PAIS ? null : fila.pais,
        empresas: fila.empresas,
        solicitudes: fila.solicitudes,
      });
      pabellones.set(key, actual);
    }

    const bloques = new Map<string, BloqueMapaReporte>();
    for (const fila of filasBloque) {
      const key = `${fila.plan_codigo}|${fila.bloque_id}`;
      const actual = bloques.get(key) ?? {
        planoCodigo: fila.plan_codigo,
        bloqueId: fila.bloque_id,
        standCode: fila.stand_code,
        empresas: 0,
        solicitudes: 0,
        paises: [],
      };
      actual.empresas += fila.empresas;
      actual.solicitudes += fila.solicitudes;
      actual.paises.push({
        pais: fila.pais === REPORTES_SIN_PAIS ? null : fila.pais,
        empresas: fila.empresas,
        solicitudes: fila.solicitudes,
      });
      bloques.set(key, actual);
    }

    return {
      pabellones: [...pabellones.values()].map((fila) => ({
        ...fila,
        paises: fila.paises.sort((a, b) => b.solicitudes - a.solicitudes),
      })),
      bloques: [...bloques.values()].map((fila) => ({
        ...fila,
        paises: fila.paises.sort((a, b) => b.solicitudes - a.solicitudes),
      })),
    };
  }
  async exportacion(params: { eventoId?: string; incluirInactivas?: boolean }): Promise<ReporteExportacion> {
    const filtroActivo = params.incluirInactivas ? Prisma.empty : Prisma.sql`AND s.flg_activo = true`;
    const filtroEvento = params.eventoId ? Prisma.sql`AND gs.evento_id = ${params.eventoId}` : Prisma.empty;
    const filas = await prisma.$queryRaw<FilaExportacion[]>(Prisma.sql`
      WITH rel AS (
        SELECT s.id AS solicitud_id, s.email, s.user_id, s.gess_stand_id
        FROM solicitud s
        WHERE true ${filtroActivo}
        UNION
        SELECT s.id AS solicitud_id, s.email, s.user_id, ss.gess_stand_id
        FROM solicitud s
        JOIN solicitud_stand ss ON ss.solicitud_id = s.id
        WHERE true ${filtroActivo}
      ),
      base AS (
        SELECT
          s.id AS solicitud_id,
          s.email,
          s.user_id,
          s.estado,
          s.flg_activo,
          s.created_at,
          s.updated_at,
          gs.id AS stand_id,
          gs.stand_code,
          gs.bloque_id,
          gs.pabellon,
          gs.tipo_stand,
          gs.medidas,
          gs.raw_data,
          gs.empresa AS stand_empresa,
          e.razon_social,
          e.ruc,
          NULLIF(e.pais, '') AS pais,
          ur.nombre AS usuario_nombre,
          ur.apellidos AS usuario_apellidos,
          ur.nombre_empresa AS usuario_empresa
        FROM rel r
        JOIN solicitud s ON s.id = r.solicitud_id
        LEFT JOIN gess_stand gs ON gs.id = r.gess_stand_id
        LEFT JOIN LATERAL (
          SELECT x.empresa_id, x.nombre, x.apellidos, x.nombre_empresa
          FROM user_role x
          WHERE x.user_id = r.user_id
          LIMIT 1
        ) ur ON true
        LEFT JOIN empresa e ON e.id = ur.empresa_id
        WHERE true ${filtroEvento}
      )
      SELECT * FROM base ORDER BY created_at DESC, solicitud_id, stand_code
    `);

    const solicitudes = new Map<string, ReporteExportacionSolicitud>();
    const stands = new Map<string, ReporteExportacionStand>();

    for (const fila of filas) {
      const empresa = fila.razon_social ?? fila.stand_empresa ?? fila.usuario_empresa ?? null;
      const usuario = [fila.usuario_nombre, fila.usuario_apellidos].filter(Boolean).join(" ") || null;
      let solicitud = solicitudes.get(fila.solicitud_id);
      if (!solicitud) {
        solicitud = {
          id: fila.solicitud_id,
          empresa,
          ruc: fila.ruc,
          pais: fila.pais,
          estado: fila.estado,
          activa: fila.flg_activo,
          createdAt: fila.created_at.toISOString(),
          updatedAt: fila.updated_at.toISOString(),
          usuario,
          email: fila.email,
          standCodes: [],
          pabellones: [],
          tipoStand: null,
          precio: 0,
        };
        solicitudes.set(fila.solicitud_id, solicitud);
      } else {
        solicitud.empresa ??= empresa;
        solicitud.ruc ??= fila.ruc;
        solicitud.pais ??= fila.pais;
        solicitud.usuario ??= usuario;
        solicitud.email ??= fila.email;
      }

      const claveStand = fila.stand_id ? `${fila.solicitud_id}|${fila.stand_id}` : `${fila.solicitud_id}|sin-stand`;
      if (!stands.has(claveStand)) {
        const precio = fila.stand_id ? resolverPrecioStand({ tipoStand: fila.tipo_stand, medidas: fila.medidas, rawData: fila.raw_data }) : 0;
        const standCode = fila.stand_code ? codigoComercialStand(fila.stand_code) : null;
        stands.set(claveStand, {
          solicitudId: fila.solicitud_id,
          empresa,
          ruc: fila.ruc,
          pais: fila.pais,
          standCode,
          bloqueId: fila.bloque_id,
          pabellon: fila.pabellon,
          estadoSolicitud: fila.estado,
          activa: fila.flg_activo,
          tipoStand: fila.tipo_stand,
          precio,
        });
        solicitud.precio += precio;
        if (standCode && !solicitud.standCodes.includes(standCode)) solicitud.standCodes.push(standCode);
        if (fila.pabellon && !solicitud.pabellones.includes(fila.pabellon)) solicitud.pabellones.push(fila.pabellon);
        solicitud.tipoStand ??= fila.tipo_stand;
      }
    }

    return {
      empresas: await this.empresasPorPais(params),
      solicitudes: [...solicitudes.values()],
      stands: [...stands.values()],
    };
  }

  async exportacionSolicitudesPreReservas(params: { eventoId?: string }): Promise<ReporteSolicitudesPreReservas> {
    const filtroEvento = params.eventoId
      ? Prisma.sql`AND gs.evento_id = ${params.eventoId}`
      : Prisma.empty;

    const filas = await prisma.$queryRaw<FilaStandRegistro[]>(Prisma.sql`
      WITH rel AS (
        SELECT s.id AS solicitud_id, s.email, s.user_id, s.gess_stand_id
        FROM solicitud s
        WHERE s.flg_activo = true
        UNION
        SELECT s.id AS solicitud_id, s.email, s.user_id, ss.gess_stand_id
        FROM solicitud s
        JOIN solicitud_stand ss ON ss.solicitud_id = s.id
        WHERE s.flg_activo = true
      ),
      solicitudes AS (
        SELECT
          ${REPORTES_TIPOS_REGISTRO.SOLICITUD}::text AS tipo,
          gs.stand_code,
          gs.bloque_id,
          COALESCE(NULLIF(p.nombre, ''), NULLIF(gs.pabellon, '')) AS pabellon,
          COALESCE(
            NULLIF(e.razon_social, ''),
            NULLIF(gs.empresa, ''),
            NULLIF(ur.nombre_empresa, ''),
            s.email
          ) AS empresa,
          gs.tipo_stand,
          gs.medidas,
          gs.raw_data,
          e.ruc,
          NULL::text AS sie,
          s.estado,
          s.email,
          s.created_at AS fecha,
          NULL::text AS nota,
          rev.revisiones,
          se.lifecycle_status AS sgc_lifecycle_status,
          se.devolucion_requiere_cambio AS sgc_devolucion_requiere_cambio
        FROM rel r
        JOIN solicitud s ON s.id = r.solicitud_id
        JOIN gess_stand gs ON gs.id = r.gess_stand_id
        LEFT JOIN LATERAL (
          SELECT x.empresa_id, x.nombre_empresa
          FROM user_role x
          WHERE x.user_id = r.user_id
          LIMIT 1
        ) ur ON true
        LEFT JOIN empresa e ON e.id = ur.empresa_id
        LEFT JOIN LATERAL (
          SELECT json_agg(json_build_object('area', rv.area, 'estado', rv.estado)) AS revisiones
          FROM revision rv
          WHERE rv.solicitud_id = s.id
        ) rev ON true
        LEFT JOIN sgc_expediente se ON se.solicitud_id = s.id
        LEFT JOIN LATERAL (
          SELECT p.nombre
          FROM plano_bloque pb
          JOIN plano p ON p.id = pb.plano_id
          WHERE COALESCE(to_jsonb(pb)->>'bloque_id', to_jsonb(pb)->>'bloqueId') = gs.bloque_id
            AND COALESCE((to_jsonb(pb)->>'flg_activo')::boolean, true) = true
            AND p.tipo <> ${TIPOS_PLANO.MACRO}
          LIMIT 1
        ) p ON true
        WHERE true ${filtroEvento}
      ),
      pre_reservas AS (
        SELECT
          ${REPORTES_TIPOS_REGISTRO.PRE_RESERVA}::text AS tipo,
          gs.stand_code,
          gs.bloque_id,
          COALESCE(NULLIF(p.nombre, ''), NULLIF(gs.pabellon, '')) AS pabellon,
          COALESCE(
            NULLIF(gs.pre_reserva_razon_social, ''),
            NULLIF(gs.pre_reserva_titulo, ''),
            NULLIF(gs.empresa, '')
          ) AS empresa,
          gs.tipo_stand,
          gs.medidas,
          gs.raw_data,
          gs.pre_reserva_ruc AS ruc,
          gs.pre_reserva_sie AS sie,
          gs.estado,
          NULL::text AS email,
          gs.pre_reserva_at AS fecha,
          gs.pre_reserva_nota AS nota,
          NULL::json AS revisiones,
          NULL::text AS sgc_lifecycle_status,
          NULL::boolean AS sgc_devolucion_requiere_cambio
        FROM gess_stand gs
        LEFT JOIN LATERAL (
          SELECT p.nombre
          FROM plano_bloque pb
          JOIN plano p ON p.id = pb.plano_id
          WHERE COALESCE(to_jsonb(pb)->>'bloque_id', to_jsonb(pb)->>'bloqueId') = gs.bloque_id
            AND COALESCE((to_jsonb(pb)->>'flg_activo')::boolean, true) = true
            AND p.tipo <> ${TIPOS_PLANO.MACRO}
          LIMIT 1
        ) p ON true
        WHERE gs.estado = ${ESTADOS_STAND.PRE_RESERVADO}
          ${filtroEvento}
      )
      SELECT * FROM solicitudes
      UNION ALL
      SELECT * FROM pre_reservas
      ORDER BY pabellon NULLS LAST, stand_code NULLS LAST, tipo
    `);

    return filas.map((fila): ReporteStandRegistro => {
      const revisiones = Array.isArray(fila.revisiones)
        ? (fila.revisiones as Array<{ area: string; estado: string }>)
        : [];
      const estado = fila.tipo === REPORTES_TIPOS_REGISTRO.SOLICITUD
        ? estadoSolicitudConSgc(
            fila.estado,
            revisiones,
            {
              lifecycleStatus: fila.sgc_lifecycle_status,
              devolucionRequiereCambio: fila.sgc_devolucion_requiere_cambio,
            },
            isSgcEnabled(),
          )
        : null;

      return {
        tipo: fila.tipo as ReporteStandRegistro["tipo"],
        standCode: fila.stand_code ? codigoComercialStand(fila.stand_code) : null,
        bloqueId: fila.bloque_id,
        pabellon: fila.pabellon,
        tipoStand: fila.tipo_stand,
        empresa: fila.empresa,
        precio: resolverPrecioStand({
          tipoStand: fila.tipo_stand,
          medidas: fila.medidas,
          rawData: fila.raw_data,
        }),
        ruc: fila.ruc,
        sie: fila.sie,
        estado,
        email: fila.email,
        fecha: fila.fecha ? fila.fecha.toISOString() : null,
        nota: fila.nota,
      };
    });
  }

}

