import 'server-only';

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type { IPlanoRepository, UbicacionBloque } from "@/domain/ports/plano-repository";
import type { PlanoEntity, PlanoListItem, PlanoExportJSON, PlanoBloqueEntity, PlanoTipoBloqueEntity, PlanoFurnitureEntity, PlanoSeccionEntity, SeccionOcupacion, PlanoTipoSugerido } from "@/domain/models/plano-entities";
import { AMBITOS_TIPO_BLOQUE, ESTADOS_STAND, ESTADOS_STAND_LEGACY, FORMAS_BLOQUE, TIPOS_BLOQUE_GLOBALES, TIPOS_PLANO } from "@/lib/shared/constants";
import { normalizarCodigoTipo, planSincronizacionCatalogo } from "@/lib/shared/utils/catalogo-tipos";
import { seccionPuntosUtils } from "@/lib/shared/utils/seccion-puntos";

interface PlanoTipoRow {
  id: string;
  planoId: string;
  codigo: string;
  label: string;
  nombre: string;
  w: number;
  d: number;
  h: number;
  color: string;
  ambito: string;
  forma: string;
  flgActivo: boolean;
}

interface PlanoBloqueRow {
  id: string;
  planoId: string;
  tipoId: string | null;
  bloqueId: string;
  tipoCodigo: string;
  tipologia: string | null;
  x: number;
  z: number;
  rotY: number;
  orden: number;
  flgActivo: boolean;
}

interface PlanoFurnitureRow {
  id: string;
  planoId: string;
  refId: string;
  tipo: string;
  x: number;
  z: number;
  rotY: number;
  config: unknown;
  flgActivo: boolean;
}

interface PlanoSeccionRow {
  id: string;
  planoId: string;
  codigo: string;
  nombre: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotacion: number;
  puntos: unknown;
  color: string;
  planoHijoId: string | null;
  orden: number;
}

interface PlanoRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  imagenFondo: string | null;
  config: unknown;
  flgActivo: boolean;
  tipos: PlanoTipoRow[];
  bloques: PlanoBloqueRow[];
  furniture: PlanoFurnitureRow[];
  secciones: PlanoSeccionRow[];
  createdAt: Date;
  updatedAt: Date;
}

function mapTipo(r: PlanoTipoRow): PlanoTipoBloqueEntity {
  return {
    id: r.id,
    planoId: r.planoId,
    codigo: r.codigo,
    label: r.label,
    nombre: r.nombre,
    w: r.w,
    d: r.d,
    h: r.h,
    color: r.color,
    ambito: r.ambito ?? AMBITOS_TIPO_BLOQUE.INTERNO,
    forma: r.forma ?? FORMAS_BLOQUE.BLOQUE,
    flgActivo: r.flgActivo,
  };
}

function mapBloque(r: PlanoBloqueRow): PlanoBloqueEntity {
  return {
    id: r.id,
    planoId: r.planoId,
    tipoId: r.tipoId ?? null,
    bloqueId: r.bloqueId,
    tipoCodigo: r.tipoCodigo,
    tipologia: r.tipologia ?? null,
    x: r.x,
    z: r.z,
    rotY: r.rotY,
    orden: r.orden,
    flgActivo: r.flgActivo,
  };
}

function mapFurniture(r: PlanoFurnitureRow): PlanoFurnitureEntity {
  return {
    id: r.id,
    planoId: r.planoId,
    refId: r.refId,
    tipo: r.tipo,
    x: r.x,
    z: r.z,
    rotY: r.rotY,
    config: r.config ?? null,
    flgActivo: r.flgActivo,
  };
}

function mapSeccion(r: PlanoSeccionRow): PlanoSeccionEntity {
  return {
    id: r.id,
    planoId: r.planoId,
    codigo: r.codigo,
    nombre: r.nombre,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    rotacion: r.rotacion ?? 0,
    puntos: seccionPuntosUtils.esPoligono(r.puntos) ? r.puntos : null,
    color: r.color,
    planoHijoId: r.planoHijoId ?? null,
    orden: r.orden,
  };
}

function mapPlano(r: PlanoRow): PlanoEntity {
  return {
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    descripcion: r.descripcion ?? null,
    tipo: r.tipo ?? TIPOS_PLANO.SIMPLE,
    imagenFondo: r.imagenFondo ?? null,
    config: r.config ?? null,
    flgActivo: r.flgActivo,
    tipos: r.tipos.map(mapTipo),
    bloques: r.bloques.map(mapBloque),
    furniture: r.furniture.map(mapFurniture),
    secciones: r.secciones.map(mapSeccion),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

const FULL_INCLUDE = {
  tipos: true,
  bloques: { orderBy: { orden: "asc" as const } },
  furniture: true,
  secciones: { orderBy: { orden: "asc" as const } },
};

export class PlanoPrismaRepository implements IPlanoRepository {
  async listar(): Promise<PlanoListItem[]> {
    const [rows, asignaciones] = await Promise.all([
      prisma.plano.findMany({
        include: { _count: { select: { bloques: true, tipos: true } } },
        orderBy: { codigo: "asc" },
      }),
      prisma.eventoMetadata.findMany({ select: { plano: true, tipoEvento: true, codigoEvento: true } }),
    ]);
    const asignMap = new Map<string, { tipoEvento: number; codigoEvento: number }>();
    for (const a of asignaciones) {
      if (a.plano) asignMap.set(a.plano, { tipoEvento: a.tipoEvento, codigoEvento: a.codigoEvento });
    }
    const tiposGlobales = TIPOS_BLOQUE_GLOBALES.USAR_CATALOGO
      ? await prisma.tipoBloqueGlobal.count({ where: { flgActivo: true } })
      : null;
    return rows.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      tipo: r.tipo,
      bloquesCount: r._count.bloques,
      tiposCount: tiposGlobales ?? r._count.tipos,
      flgActivo: r.flgActivo,
      eventoAsignado: asignMap.get(r.codigo) ?? null,
      updatedAt: r.updatedAt,
    }));
  }

  async listarTiposSugeridos(): Promise<PlanoTipoSugerido[]> {
    if (TIPOS_BLOQUE_GLOBALES.USAR_CATALOGO) return this.listarTiposSugeridosDesdeCatalogo();
    const rows = await prisma.planoTipoBloque.findMany({
      where: { flgActivo: true },
      include: {
        _count: { select: { bloques: true } },
        plano: { select: { codigo: true } },
      },
      orderBy: { plano: { updatedAt: "desc" } },
      take: 500,
    });
    const map = new Map<string, PlanoTipoSugerido>();
    for (const r of rows) {
      const key = r.codigo.trim().toUpperCase();
      const existente = map.get(key);
      if (existente) {
        existente.planosCount += 1;
        existente.bloquesCount += r._count.bloques;
        continue;
      }
      map.set(key, {
        codigo: r.codigo,
        label: r.label,
        nombre: r.nombre,
        w: r.w,
        d: r.d,
        h: r.h,
        color: r.color,
        ambito: r.ambito ?? AMBITOS_TIPO_BLOQUE.INTERNO,
        forma: r.forma ?? FORMAS_BLOQUE.BLOQUE,
        planoCodigo: r.plano.codigo,
        planosCount: 1,
        bloquesCount: r._count.bloques,
      });
    }
    return [...map.values()].sort((a, b) => b.bloquesCount - a.bloquesCount || a.codigo.localeCompare(b.codigo));
  }

  private async listarTiposSugeridosDesdeCatalogo(): Promise<PlanoTipoSugerido[]> {
    const [rows, bloquesPorCodigo, planosPorCodigo] = await Promise.all([
      prisma.tipoBloqueGlobal.findMany({
        where: { flgActivo: true },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      prisma.planoBloque.groupBy({ by: ["tipoCodigo"], _count: { _all: true } }),
      prisma.planoTipoBloque.groupBy({ by: ["codigo"], _count: { _all: true } }),
    ]);
    const bloques = new Map(bloquesPorCodigo.map((r) => [r.tipoCodigo.trim().toUpperCase(), r._count._all]));
    const planos = new Map(planosPorCodigo.map((r) => [r.codigo.trim().toUpperCase(), r._count._all]));
    return rows
      .map((r): PlanoTipoSugerido => {
        const key = r.codigo.trim().toUpperCase();
        return {
          codigo: r.codigo,
          label: r.label,
          nombre: r.nombre,
          w: r.w,
          d: r.d,
          h: r.h,
          color: r.color,
          ambito: r.ambito ?? AMBITOS_TIPO_BLOQUE.INTERNO,
          forma: r.forma ?? FORMAS_BLOQUE.BLOQUE,
          planoCodigo: "catalogo-global",
          planosCount: planos.get(key) ?? 0,
          bloquesCount: bloques.get(key) ?? 0,
        };
      })
      .sort((a, b) => b.bloquesCount - a.bloquesCount || a.codigo.localeCompare(b.codigo));
  }

  async detalle(id: string): Promise<PlanoEntity | null> {
    const r = await prisma.plano.findUnique({ where: { id }, include: FULL_INCLUDE });
    if (!r) return null;
    const entidad = mapPlano(r);
    return TIPOS_BLOQUE_GLOBALES.USAR_CATALOGO ? { ...entidad, tipos: await this.tiposDesdeCatalogo(entidad.id) } : entidad;
  }

  async detallePorCodigo(codigo: string): Promise<PlanoEntity | null> {
    const r = await prisma.plano.findUnique({ where: { codigo }, include: FULL_INCLUDE });
    if (!r) return null;
    const entidad = mapPlano(r);
    return TIPOS_BLOQUE_GLOBALES.USAR_CATALOGO ? { ...entidad, tipos: await this.tiposDesdeCatalogo(entidad.id) } : entidad;
  }

  private async tiposDesdeCatalogo(planoId: string): Promise<PlanoTipoBloqueEntity[]> {
    const rows = await prisma.tipoBloqueGlobal.findMany({ orderBy: { codigo: "asc" } });
    return rows.map((g) => ({
      id: g.id,
      planoId,
      codigo: g.codigo,
      label: g.label,
      nombre: g.nombre,
      w: g.w,
      d: g.d,
      h: g.h,
      color: g.color,
      ambito: g.ambito,
      forma: g.forma ?? FORMAS_BLOQUE.BLOQUE,
      flgActivo: g.flgActivo,
    }));
  }

  private async usoGlobalTipos(tx: Prisma.TransactionClient): Promise<Map<string, number>> {
    const rows = await tx.planoBloque.groupBy({ by: ["tipoCodigo"], _count: { _all: true } });
    return new Map(rows.map((r) => [normalizarCodigoTipo(r.tipoCodigo), r._count._all]));
  }

  private async sincronizarCatalogo(
    tx: Prisma.TransactionClient,
    tipos: Array<Omit<PlanoTipoBloqueEntity, "id" | "planoId">>,
  ): Promise<void> {
    const existentes = await tx.tipoBloqueGlobal.findMany();
    const codigoAlmacenado = new Map(existentes.map((e) => [normalizarCodigoTipo(e.codigo), e.codigo]));
    const plan = planSincronizacionCatalogo(
      existentes.map((e) => ({ codigo: e.codigo, label: e.label, nombre: e.nombre, w: e.w, d: e.d, h: e.h, color: e.color, ambito: e.ambito, forma: e.forma ?? FORMAS_BLOQUE.BLOQUE, flgActivo: e.flgActivo })),
      tipos.map((t) => ({ codigo: t.codigo, label: t.label, nombre: t.nombre, w: t.w, d: t.d, h: t.h, color: t.color, ambito: t.ambito, forma: t.forma ?? FORMAS_BLOQUE.BLOQUE, flgActivo: t.flgActivo })),
      await this.usoGlobalTipos(tx),
    );
    for (const t of plan.altas) {
      await tx.tipoBloqueGlobal.create({ data: { ...t, codigo: normalizarCodigoTipo(t.codigo), forma: t.forma ?? FORMAS_BLOQUE.BLOQUE } });
    }
    for (const t of plan.cambios) {
      const original = codigoAlmacenado.get(normalizarCodigoTipo(t.codigo));
      if (!original) continue;
      await tx.tipoBloqueGlobal.update({
        where: { codigo: original },
        data: { codigo: normalizarCodigoTipo(t.codigo), label: t.label, nombre: t.nombre, w: t.w, d: t.d, h: t.h, color: t.color, ambito: t.ambito, forma: t.forma ?? FORMAS_BLOQUE.BLOQUE, flgActivo: t.flgActivo },
      });
    }
    if (plan.desactivar.length > 0) {
      await tx.tipoBloqueGlobal.updateMany({ where: { codigo: { in: plan.desactivar } }, data: { flgActivo: false } });
    }
  }

  async planosDeEvento(tipoEvento: number, codigoEvento: number): Promise<PlanoEntity[]> {
    const meta = await prisma.eventoMetadata.findUnique({
      where: { tipoEvento_codigoEvento: { tipoEvento, codigoEvento } },
      select: { plano: true },
    });
    if (!meta?.plano) return [];

    const principal = await this.detallePorCodigo(meta.plano);
    if (!principal) return [];

    if (principal.tipo !== TIPOS_PLANO.MACRO) return [principal];

    const hijoIds = principal.secciones
      .map((s) => s.planoHijoId)
      .filter((v): v is string => !!v);
    if (hijoIds.length === 0) return [principal];

    const hijos = await prisma.plano.findMany({
      where: { id: { in: hijoIds }, flgActivo: true },
      include: FULL_INCLUDE,
    });
    const hijosMap = new Map<string, PlanoRow>(hijos.map((h): [string, PlanoRow] => [h.id, h]));
    const hijosEntity = principal.secciones
      .map((s) => (s.planoHijoId ? hijosMap.get(s.planoHijoId) : undefined))
      .filter((v): v is PlanoRow => !!v)
      .map(mapPlano);

    return [principal, ...hijosEntity];
  }

  async crear(data: { codigo: string; nombre: string; descripcion?: string | null; tipo?: string }): Promise<PlanoEntity> {
    const r = await prisma.plano.create({
      data: { codigo: data.codigo, nombre: data.nombre, descripcion: data.descripcion ?? null, tipo: data.tipo ?? TIPOS_PLANO.SIMPLE },
      include: FULL_INCLUDE,
    });
    return mapPlano(r);
  }

  async actualizarMeta(id: string, data: { nombre?: string; descripcion?: string | null; flgActivo?: boolean; tipo?: string; imagenFondo?: string | null }): Promise<PlanoEntity> {
    const r = await prisma.plano.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
        ...(data.flgActivo !== undefined && { flgActivo: data.flgActivo }),
        ...(data.tipo !== undefined && { tipo: data.tipo }),
        ...(data.imagenFondo !== undefined && { imagenFondo: data.imagenFondo }),
      },
      include: FULL_INCLUDE,
    });
    return mapPlano(r);
  }

  async eliminar(id: string): Promise<void> {
    await prisma.plano.delete({ where: { id } });
  }

  async guardarLayout(
    id: string,
    data: {
      tipos: Array<Omit<PlanoTipoBloqueEntity, "id" | "planoId">>;
      bloques: Array<Omit<PlanoBloqueEntity, "id" | "planoId" | "tipoId">>;
      furniture: Array<Omit<PlanoFurnitureEntity, "id" | "planoId">>;
    },
  ): Promise<PlanoEntity> {
    await prisma.$transaction(async (tx) => {
      await tx.planoTipoBloque.deleteMany({ where: { planoId: id } });
      const tipoIdMap = new Map<string, string>();
      for (const t of data.tipos) {
        const created = await tx.planoTipoBloque.create({
          data: { planoId: id, codigo: t.codigo, label: t.label, nombre: t.nombre, w: t.w, d: t.d, h: t.h, color: t.color, ambito: t.ambito, forma: t.forma ?? FORMAS_BLOQUE.BLOQUE, flgActivo: t.flgActivo },
        });
        tipoIdMap.set(t.codigo, created.id);
      }

      await tx.planoBloque.deleteMany({ where: { planoId: id } });
      for (const b of data.bloques) {
        await tx.planoBloque.create({
          data: {
            planoId: id,
            tipoId: tipoIdMap.get(b.tipoCodigo) ?? null,
            bloqueId: b.bloqueId,
            tipoCodigo: b.tipoCodigo,
            tipologia: b.tipologia ?? null,
            x: b.x,
            z: b.z,
            rotY: b.rotY,
            orden: b.orden,
            flgActivo: b.flgActivo,
          },
        });
      }
      if (TIPOS_BLOQUE_GLOBALES.USAR_CATALOGO) await this.sincronizarCatalogo(tx, data.tipos);

      await tx.planoFurniture.deleteMany({ where: { planoId: id } });
      for (const f of data.furniture) {
        await tx.planoFurniture.create({
          data: { planoId: id, refId: f.refId, tipo: f.tipo, x: f.x, z: f.z, rotY: f.rotY, config: (f.config as never) ?? undefined, flgActivo: f.flgActivo },
        });
      }
    });

    const result = await this.detalle(id);
    if (!result) throw new Error("Plano no encontrado despues de guardar");
    return result;
  }

  async guardarTipos(id: string, tipos: Array<Omit<PlanoTipoBloqueEntity, "id" | "planoId">>): Promise<PlanoEntity> {
    await prisma.$transaction(async (tx) => {
      await tx.planoTipoBloque.deleteMany({ where: { planoId: id } });
      const tipoIdMap = new Map<string, string>();
      for (const t of tipos) {
        const created = await tx.planoTipoBloque.create({
          data: { planoId: id, codigo: t.codigo, label: t.label, nombre: t.nombre, w: t.w, d: t.d, h: t.h, color: t.color, ambito: t.ambito, forma: t.forma ?? FORMAS_BLOQUE.BLOQUE, flgActivo: t.flgActivo },
        });
        tipoIdMap.set(t.codigo, created.id);
      }
      // Relink de bloques por tipoCodigo (tipoId es redundante para queries pero se mantiene consistente).
      const bloques = await tx.planoBloque.findMany({ where: { planoId: id }, select: { id: true, tipoCodigo: true } });
      for (const b of bloques) {
        await tx.planoBloque.update({ where: { id: b.id }, data: { tipoId: tipoIdMap.get(b.tipoCodigo) ?? null } });
      }
      if (TIPOS_BLOQUE_GLOBALES.USAR_CATALOGO) await this.sincronizarCatalogo(tx, tipos);
    });
    const result = await this.detalle(id);
    if (!result) throw new Error("Plano no encontrado despues de guardar tipos");
    return result;
  }

  async guardarSecciones(id: string, secciones: Array<Omit<PlanoSeccionEntity, "id" | "planoId">>): Promise<PlanoEntity> {
    await prisma.$transaction(async (tx) => {
      await tx.planoSeccion.deleteMany({ where: { planoId: id } });
      for (const s of secciones) {
        await tx.planoSeccion.create({
          data: {
            planoId: id,
            codigo: s.codigo,
            nombre: s.nombre,
            x: s.x,
            y: s.y,
            w: s.w,
            h: s.h,
            rotacion: s.rotacion,
            puntos: (s.puntos && s.puntos.length >= 3 ? s.puntos : null) as never,
            color: s.color,
            planoHijoId: s.planoHijoId,
            orden: s.orden,
          },
        });
      }
    });
    const result = await this.detalle(id);
    if (!result) throw new Error("Plano no encontrado despues de guardar secciones");
    return result;
  }

  async macrosQueContienen(planoHijoId: string): Promise<Array<{ id: string; codigo: string; nombre: string }>> {
    const secciones = await prisma.planoSeccion.findMany({
      where: { planoHijoId },
      select: { plano: { select: { id: true, codigo: true, nombre: true, tipo: true } } },
    });
    const vistos = new Set<string>();
    const macros: Array<{ id: string; codigo: string; nombre: string }> = [];
    for (const s of secciones) {
      if (s.plano.tipo !== TIPOS_PLANO.MACRO) continue;
      if (vistos.has(s.plano.id)) continue;
      vistos.add(s.plano.id);
      macros.push({ id: s.plano.id, codigo: s.plano.codigo, nombre: s.plano.nombre });
    }
    return macros;
  }

  async findMacroConPlanoHijo(planoHijoId: string, exceptPlanoId: string): Promise<{ id: string; codigo: string; nombre: string } | null> {
    const seccion = await prisma.planoSeccion.findFirst({
      where: { planoHijoId, plano: { id: { not: exceptPlanoId }, tipo: TIPOS_PLANO.MACRO } },
      select: { plano: { select: { id: true, codigo: true, nombre: true } } },
    });
    return seccion ? seccion.plano : null;
  }

  /**
   * RF-08: resuelve en que plano (pabellon) esta un bloque de stand y su macro.
   * Prefiere el pabellon (plano no macro) sobre cualquier macro que contenga el bloque.
   */
  async ubicacionDeBloque(bloqueId: string): Promise<UbicacionBloque | null> {
    const bloques = await prisma.planoBloque.findMany({
      where: { bloqueId, flgActivo: true, plano: { flgActivo: true } },
      include: { plano: { select: { id: true, codigo: true, nombre: true, tipo: true } } },
    });
    if (bloques.length === 0) return null;

    const elegido = bloques.find((b) => b.plano.tipo !== TIPOS_PLANO.MACRO) ?? bloques[0];
    if (!elegido) return null;
    const macro = await this.findMacroConPlanoHijo(elegido.planoId, elegido.planoId);

    return {
      plano: elegido.plano,
      bloque: {
        id: elegido.id,
        planoId: elegido.planoId,
        tipoId: elegido.tipoId,
        bloqueId: elegido.bloqueId,
        tipoCodigo: elegido.tipoCodigo,
        tipologia: elegido.tipologia,
        x: elegido.x,
        z: elegido.z,
        rotY: elegido.rotY,
        orden: elegido.orden,
        flgActivo: elegido.flgActivo,
      },
      macro,
    };
  }

  async agregarSeccionDefault(macroId: string, planoHijoId: string): Promise<PlanoEntity> {
    const [macro, hijo] = await Promise.all([
      prisma.plano.findUnique({ where: { id: macroId }, include: { secciones: { orderBy: { orden: "asc" } } } }),
      prisma.plano.findUnique({ where: { id: planoHijoId }, select: { codigo: true, nombre: true } }),
    ]);
    if (!macro || !hijo) throw new Error("Macro o plano hijo no encontrado");

    const colores = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
    await prisma.planoSeccion.create({
      data: {
        planoId: macroId,
        codigo: hijo.codigo,
        nombre: hijo.nombre,
        x: 0.35,
        y: 0.35,
        w: 0.15,
        h: 0.12,
        rotacion: 0,
        color: colores[macro.secciones.length % colores.length],
        planoHijoId,
        orden: macro.secciones.length,
      },
    });

    const result = await this.detalle(macroId);
    if (!result) throw new Error("Macro no encontrado despues de agregar seccion");
    return result;
  }

  async quitarPlanoDeMacros(planoHijoId: string): Promise<void> {
    await prisma.planoSeccion.deleteMany({ where: { planoHijoId } });
  }

  async tieneEventoAsignado(codigo: string): Promise<boolean> {
    const meta = await prisma.eventoMetadata.findFirst({ where: { plano: codigo }, select: { tipoEvento: true } });
    return meta !== null;
  }

  async desvincularSeccionesHijas(planoHijoId: string): Promise<void> {
    await prisma.planoSeccion.updateMany({ where: { planoHijoId }, data: { planoHijoId: null } });
  }

  async ocupacionPorSecciones(planoId: string, eventoId: string): Promise<SeccionOcupacion[]> {
    const plano = await prisma.plano.findUnique({
      where: { id: planoId },
      include: { secciones: true },
    });
    if (!plano) return [];

    const resultado: SeccionOcupacion[] = [];
    for (const seccion of plano.secciones) {
      if (!seccion.planoHijoId) {
        resultado.push({ seccionCodigo: seccion.codigo, total: 0, disponibles: 0, pctDisponible: 0 });
        continue;
      }
      const bloquesHijo = await prisma.planoBloque.findMany({
        where: { planoId: seccion.planoHijoId, flgActivo: true },
        select: { bloqueId: true },
      });
      const bloqueIds = bloquesHijo.map((b) => b.bloqueId);
      if (bloqueIds.length === 0) {
        resultado.push({ seccionCodigo: seccion.codigo, total: 0, disponibles: 0, pctDisponible: 0 });
        continue;
      }
      const stands = await prisma.gessStand.findMany({
        where: { eventoId, bloqueId: { in: bloqueIds } },
        select: { estado: true },
      });
      const total = stands.length;
      const disponibles = stands.filter(
        (s) => !s.estado || s.estado === ESTADOS_STAND.DISPONIBLE || (s.estado !== ESTADOS_STAND.EN_EVALUACION && s.estado !== ESTADOS_STAND.RESERVADO && s.estado !== ESTADOS_STAND_LEGACY.RESERVADO && s.estado !== ESTADOS_STAND_LEGACY.EN_EVALUACION),
      ).length;
      resultado.push({
        seccionCodigo: seccion.codigo,
        total,
        disponibles,
        pctDisponible: total > 0 ? Math.round((disponibles / total) * 100) : 0,
      });
    }
    return resultado;
  }

  async exportar(id: string): Promise<PlanoExportJSON | null> {
    const plano = await this.detalle(id);
    if (!plano) return null;

    const hijoIds = plano.secciones.map((s) => s.planoHijoId).filter((v): v is string => !!v);
    const hijos = hijoIds.length > 0
      ? await prisma.plano.findMany({ where: { id: { in: hijoIds } }, select: { id: true, codigo: true } })
      : [];
    const codigoPorId = new Map(hijos.map((h) => [h.id, h.codigo]));

    return {
      codigo: plano.codigo,
      nombre: plano.nombre,
      descripcion: plano.descripcion,
      tipo: plano.tipo,
      imagenFondo: plano.imagenFondo,
      tipos: plano.tipos.map((t) => ({ codigo: t.codigo, label: t.label, nombre: t.nombre, w: t.w, d: t.d, h: t.h, color: t.color, ambito: t.ambito, forma: t.forma, flgActivo: t.flgActivo })),
      bloques: plano.bloques.map((b) => ({ bloqueId: b.bloqueId, tipoCodigo: b.tipoCodigo, tipologia: b.tipologia, x: b.x, z: b.z, rotY: b.rotY, orden: b.orden, flgActivo: b.flgActivo })),
      furniture: plano.furniture.map((f) => ({ refId: f.refId, tipo: f.tipo, x: f.x, z: f.z, rotY: f.rotY, ...(f.config ? { config: f.config } : {}), flgActivo: f.flgActivo })),
      secciones: plano.secciones.map((s) => ({
        codigo: s.codigo, nombre: s.nombre, x: s.x, y: s.y, w: s.w, h: s.h,
        rotacion: s.rotacion, color: s.color,
        ...(seccionPuntosUtils.esPoligono(s.puntos) ? { puntos: s.puntos } : {}),
        planoHijoId: s.planoHijoId,
        planoHijoCodigo: s.planoHijoId ? (codigoPorId.get(s.planoHijoId) ?? null) : null,
        orden: s.orden,
      })),
    };
  }

  async importar(data: PlanoExportJSON): Promise<PlanoEntity> {
    const existing = await prisma.plano.findUnique({ where: { codigo: data.codigo } });
    const plano = existing
      ? await this.actualizarMeta(existing.id, { nombre: data.nombre, descripcion: data.descripcion, tipo: data.tipo, imagenFondo: data.imagenFondo ?? null })
      : await this.crear({ codigo: data.codigo, nombre: data.nombre, descripcion: data.descripcion, tipo: data.tipo });

    await this.guardarLayout(plano.id, {
      tipos: data.tipos.map((t) => ({ ...t, ambito: t.ambito ?? AMBITOS_TIPO_BLOQUE.INTERNO, forma: t.forma ?? FORMAS_BLOQUE.BLOQUE, flgActivo: t.flgActivo ?? true })),
      bloques: data.bloques.map((b) => ({ ...b, tipologia: (b as { tipologia?: string | null }).tipologia ?? null, flgActivo: b.flgActivo ?? true })),
      furniture: data.furniture.map((f) => ({ ...f, config: f.config ?? null, flgActivo: f.flgActivo ?? true })),
    });

    if (plano.tipo === "macro" && Array.isArray(data.secciones) && data.secciones.length > 0) {
      const planosDisponibles = await prisma.plano.findMany({ select: { id: true, codigo: true } });
      const idPorCodigo = new Map(planosDisponibles.map((p) => [p.codigo, p.id]));
      const secciones = data.secciones.map((s) => {
        const sec = s as { planoHijoCodigo?: string | null };
        return {
          codigo: s.codigo, nombre: s.nombre, x: s.x, y: s.y, w: s.w, h: s.h,
          rotacion: s.rotacion, color: s.color, orden: s.orden,
          planoHijoId: sec.planoHijoCodigo ? (idPorCodigo.get(sec.planoHijoCodigo) ?? null) : null,
        };
      });
      await this.guardarSecciones(plano.id, secciones);
    }

    return this.detalle(plano.id) as Promise<PlanoEntity>;
  }
}

export const planoRepo = new PlanoPrismaRepository();
