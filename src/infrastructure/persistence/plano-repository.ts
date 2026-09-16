import 'server-only';

import { prisma } from "@/lib/server/db";
import type { IPlanoRepository } from "@/domain/ports/plano-repository";
import type { PlanoEntity, PlanoListItem, PlanoExportJSON, PlanoBloqueEntity, PlanoTipoBloqueEntity, PlanoFurnitureEntity, PlanoSeccionEntity, SeccionOcupacion } from "@/domain/models/plano-entities";
import { ESTADOS_STAND, TIPOS_PLANO } from "@/lib/shared/constants";

function mapTipo(r: Record<string, unknown>): PlanoTipoBloqueEntity {
  return {
    id: r.id as string,
    planoId: r.planoId as string,
    codigo: r.codigo as string,
    label: r.label as string,
    nombre: r.nombre as string,
    w: r.w as number,
    d: r.d as number,
    h: r.h as number,
    color: r.color as string,
  };
}

function mapBloque(r: Record<string, unknown>): PlanoBloqueEntity {
  return {
    id: r.id as string,
    planoId: r.planoId as string,
    tipoId: (r.tipoId as string | null) ?? null,
    bloqueId: r.bloqueId as string,
    tipoCodigo: r.tipoCodigo as string,
    tipologia: (r.tipologia as string | null) ?? null,
    x: r.x as number,
    z: r.z as number,
    rotY: r.rotY as number,
    orden: r.orden as number,
    flgActivo: r.flgActivo as boolean,
  };
}

function mapFurniture(r: Record<string, unknown>): PlanoFurnitureEntity {
  return {
    id: r.id as string,
    planoId: r.planoId as string,
    refId: r.refId as string,
    tipo: r.tipo as string,
    x: r.x as number,
    z: r.z as number,
    rotY: r.rotY as number,
    config: r.config ?? null,
  };
}

function mapSeccion(r: Record<string, unknown>): PlanoSeccionEntity {
  return {
    id: r.id as string,
    planoId: r.planoId as string,
    codigo: r.codigo as string,
    nombre: r.nombre as string,
    x: r.x as number,
    y: r.y as number,
    w: r.w as number,
    h: r.h as number,
    rotacion: (r.rotacion as number) ?? 0,
    color: r.color as string,
    planoHijoId: (r.planoHijoId as string | null) ?? null,
    orden: r.orden as number,
  };
}

function mapPlano(r: Record<string, unknown>): PlanoEntity {
  return {
    id: r.id as string,
    codigo: r.codigo as string,
    nombre: r.nombre as string,
    descripcion: (r.descripcion as string | null) ?? null,
    tipo: (r.tipo as string) ?? TIPOS_PLANO.SIMPLE,
    imagenFondo: (r.imagenFondo as string | null) ?? null,
    config: r.config ?? null,
    flgActivo: r.flgActivo as boolean,
    tipos: ((r.tipos as Record<string, unknown>[]) ?? []).map(mapTipo),
    bloques: ((r.bloques as Record<string, unknown>[]) ?? []).map(mapBloque),
    furniture: ((r.furniture as Record<string, unknown>[]) ?? []).map(mapFurniture),
    secciones: ((r.secciones as Record<string, unknown>[]) ?? []).map(mapSeccion),
    createdAt: r.createdAt as Date,
    updatedAt: r.updatedAt as Date,
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
    return rows.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      tipo: r.tipo,
      bloquesCount: r._count.bloques,
      tiposCount: r._count.tipos,
      flgActivo: r.flgActivo,
      eventoAsignado: asignMap.get(r.codigo) ?? null,
      updatedAt: r.updatedAt,
    }));
  }

  async detalle(id: string): Promise<PlanoEntity | null> {
    const r = await prisma.plano.findUnique({ where: { id }, include: FULL_INCLUDE });
    return r ? mapPlano(r as unknown as Record<string, unknown>) : null;
  }

  async detallePorCodigo(codigo: string): Promise<PlanoEntity | null> {
    const r = await prisma.plano.findUnique({ where: { codigo }, include: FULL_INCLUDE });
    return r ? mapPlano(r as unknown as Record<string, unknown>) : null;
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
    const hijosMap = new Map(hijos.map((h) => [h.id, h as unknown as Record<string, unknown>]));
    const hijosEntity = principal.secciones
      .map((s) => (s.planoHijoId ? hijosMap.get(s.planoHijoId) : undefined))
      .filter((v): v is Record<string, unknown> => !!v)
      .map(mapPlano);

    return [principal, ...hijosEntity];
  }

  async crear(data: { codigo: string; nombre: string; descripcion?: string | null; tipo?: string }): Promise<PlanoEntity> {
    const r = await prisma.plano.create({
      data: { codigo: data.codigo, nombre: data.nombre, descripcion: data.descripcion ?? null, tipo: data.tipo ?? TIPOS_PLANO.SIMPLE },
      include: FULL_INCLUDE,
    });
    return mapPlano(r as unknown as Record<string, unknown>);
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
    return mapPlano(r as unknown as Record<string, unknown>);
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
          data: { planoId: id, codigo: t.codigo, label: t.label, nombre: t.nombre, w: t.w, d: t.d, h: t.h, color: t.color },
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

      await tx.planoFurniture.deleteMany({ where: { planoId: id } });
      for (const f of data.furniture) {
        await tx.planoFurniture.create({
          data: { planoId: id, refId: f.refId, tipo: f.tipo, x: f.x, z: f.z, rotY: f.rotY, config: (f.config as never) ?? undefined },
        });
      }
    });

    const result = await this.detalle(id);
    if (!result) throw new Error("Plano no encontrado despues de guardar");
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
        (s) => !s.estado || s.estado === "disponible" || (s.estado !== ESTADOS_STAND.EN_EVALUACION && s.estado !== ESTADOS_STAND.RESERVADO && s.estado !== "Reservado" && s.estado !== "En evaluacion"),
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
    return {
      codigo: plano.codigo,
      nombre: plano.nombre,
      descripcion: plano.descripcion,
      tipos: plano.tipos.map((t) => ({ codigo: t.codigo, label: t.label, nombre: t.nombre, w: t.w, d: t.d, h: t.h, color: t.color })),
      bloques: plano.bloques.map((b) => ({ bloqueId: b.bloqueId, tipoCodigo: b.tipoCodigo, tipologia: b.tipologia, x: b.x, z: b.z, rotY: b.rotY, orden: b.orden })),
      furniture: plano.furniture.map((f) => ({ refId: f.refId, tipo: f.tipo, x: f.x, z: f.z, rotY: f.rotY, ...(f.config ? { config: f.config } : {}) })),
    };
  }

  async importar(data: PlanoExportJSON): Promise<PlanoEntity> {
    const existing = await prisma.plano.findUnique({ where: { codigo: data.codigo } });
    const plano = existing
      ? await this.actualizarMeta(existing.id, { nombre: data.nombre, descripcion: data.descripcion })
      : await this.crear({ codigo: data.codigo, nombre: data.nombre, descripcion: data.descripcion });

    return this.guardarLayout(plano.id, {
      tipos: data.tipos,
      bloques: data.bloques.map((b) => ({ ...b, tipologia: (b as { tipologia?: string | null }).tipologia ?? null, flgActivo: true })),
      furniture: data.furniture.map((f) => ({ ...f, config: f.config ?? null })),
    });
  }
}

export const planoRepo = new PlanoPrismaRepository();
