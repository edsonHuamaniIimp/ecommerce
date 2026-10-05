import 'server-only';

import type { IPlanoRepository, UbicacionBloque } from "@/domain/ports/plano-repository";
import type { PlanoEntity, PlanoListItem, PlanoExportJSON, SeccionOcupacion, PlanoSeccionEntity, PlanoTipoSugerido } from "@/domain/models/plano-entities";
import { DomainError } from "@/lib/server/router";
import { API_ERROR_CODES, TIPOLOGIAS_STAND, TIPOS_PLANO } from "@/lib/shared/constants";
import { seccionPuntosUtils } from "@/lib/shared/utils/seccion-puntos";
import { tsCodegenUtils } from "@/lib/shared/utils/ts-codegen";

export class PlanoApplicationService {
  constructor(private readonly repo: IPlanoRepository) {}

  async listar(): Promise<PlanoListItem[]> {
    return this.repo.listar();
  }

  /** Tipos de bloque existentes en otros planos, para reutilizarlos como sugerencia. */
  async tiposSugeridos(): Promise<PlanoTipoSugerido[]> {
    return this.repo.listarTiposSugeridos();
  }

  /** RF-08: ubicacion de un bloque de stand (plano/pabellon + macro) para el recorte. */
  async ubicacionDeBloque(bloqueId: string): Promise<UbicacionBloque | null> {
    const id = bloqueId?.trim();
    if (!id) throw new DomainError("bloqueId requerido", API_ERROR_CODES.VALIDATION, 400);
    return this.repo.ubicacionDeBloque(id);
  }

  async detalle(id: string): Promise<PlanoEntity> {
    const plano = await this.repo.detalle(id);
    if (!plano) throw new DomainError("Plano no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    return plano;
  }

  async detallePorCodigo(codigo: string): Promise<PlanoEntity | null> {
    return this.repo.detallePorCodigo(codigo);
  }

  /** Conjunto de planos en alcance para un evento (macro + hijos, o simple) */
  async planosDeEvento(tipoEvento: number, codigoEvento: number): Promise<PlanoEntity[]> {
    return this.repo.planosDeEvento(tipoEvento, codigoEvento);
  }
  async crear(data: { codigo: string; nombre: string; descripcion?: string | null; tipo?: string }): Promise<PlanoEntity> {
    if (!/^[a-z0-9-]+$/.test(data.codigo)) {
      throw new DomainError("El codigo solo puede contener minusculas, numeros y guiones", API_ERROR_CODES.VALIDATION, 400);
    }
    const existing = await this.repo.detallePorCodigo(data.codigo);
    if (existing) throw new DomainError("Ya existe un plano con ese codigo", API_ERROR_CODES.CONFLICT, 409);
    return this.repo.crear(data);
  }

  async actualizarMeta(id: string, data: { nombre?: string; descripcion?: string | null; flgActivo?: boolean; tipo?: string; imagenFondo?: string | null }): Promise<PlanoEntity> {
    await this.detalle(id);
    return this.repo.actualizarMeta(id, data);
  }

  async eliminar(id: string): Promise<void> {
    const plano = await this.detalle(id);

    if (await this.repo.tieneEventoAsignado(plano.codigo)) {
      throw new DomainError(`El mapa "${plano.codigo}" esta asignado a un evento. Desasignalo del evento antes de eliminarlo.`, API_ERROR_CODES.CONFLICT, 409);
    }

    await this.repo.desvincularSeccionesHijas(id);
    await this.repo.eliminar(id);
  }

  async guardarLayout(id: string, data: Parameters<IPlanoRepository["guardarLayout"]>[1]): Promise<PlanoEntity> {
    await this.detalle(id);

    const ids = data.bloques.map((b) => b.bloqueId);
    const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
    if (dupes.length > 0) {
      throw new DomainError(`BloqueIds duplicados: ${[...new Set(dupes)].join(", ")}`, API_ERROR_CODES.VALIDATION, 400);
    }

    const tipoCodigos = new Set(data.tipos.map((t) => t.codigo));
    const sinTipo = data.bloques.filter((b) => !tipoCodigos.has(b.tipoCodigo));
    if (sinTipo.length > 0) {
      throw new DomainError(`Bloques con tipo inexistente: ${sinTipo.map((b) => b.bloqueId).join(", ")}`, API_ERROR_CODES.VALIDATION, 400);
    }

    return this.repo.guardarLayout(id, data);
  }

  async guardarTipos(id: string, tipos: Parameters<IPlanoRepository["guardarTipos"]>[1]): Promise<PlanoEntity> {
    const plano = await this.detalle(id);
    const codigos = tipos.map((t) => t.codigo.trim().toUpperCase());
    const dupes = codigos.filter((v, i) => codigos.indexOf(v) !== i);
    if (dupes.length > 0) {
      throw new DomainError(`Codigos de tipo duplicados: ${[...new Set(dupes)].join(", ")}`, API_ERROR_CODES.VALIDATION, 400);
    }
    const codigosSet = new Set(tipos.map((t) => t.codigo));
    const huerfanos = plano.bloques.filter((b) => b.flgActivo !== false && !codigosSet.has(b.tipoCodigo));
    if (huerfanos.length > 0) {
      throw new DomainError(`Hay bloques activos con tipo inexistente: ${huerfanos.map((b) => b.bloqueId).join(", ")}`, API_ERROR_CODES.VALIDATION, 400);
    }
    return this.repo.guardarTipos(id, tipos);
  }

  async guardarSecciones(id: string, secciones: Array<Omit<PlanoSeccionEntity, "id" | "planoId">>): Promise<PlanoEntity> {
    const plano = await this.detalle(id);
    if (plano.tipo !== TIPOS_PLANO.MACRO) {
      throw new DomainError("Solo los planos tipo macro tienen secciones", API_ERROR_CODES.VALIDATION, 400);
    }
    const codigos = secciones.map((s) => s.codigo);
    const dupes = codigos.filter((v, i) => codigos.indexOf(v) !== i);
    if (dupes.length > 0) {
      throw new DomainError(`Codigos de seccion duplicados: ${[...new Set(dupes)].join(", ")}`, API_ERROR_CODES.VALIDATION, 400);
    }

    const usados = new Map<string, string>();
    for (const seccion of secciones) {
      if (!seccion.planoHijoId) continue;
      const previo = usados.get(seccion.planoHijoId);
      if (previo) {
        throw new DomainError(
          `El plano 3D esta asignado a dos secciones del macro (${previo} y ${seccion.codigo}). Cada pabellon debe tener un plano distinto.`,
          API_ERROR_CODES.VALIDATION,
          400,
        );
      }
      usados.set(seccion.planoHijoId, seccion.codigo);
      const otroMacro = await this.repo.findMacroConPlanoHijo(seccion.planoHijoId, id);
      if (otroMacro) {
        throw new DomainError(
          `El plano hijo ya esta asignado al macro "${otroMacro.codigo}". Un plano 3D solo puede pertenecer a un macro a la vez.`,
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
    }

    /* Secciones libres: los puntos mandan; se derivan bbox y rotacion 0 (rotacion horneada). */
    const normalizadas = secciones.map((s) => {
      if (!seccionPuntosUtils.esPoligono(s.puntos)) return { ...s, puntos: null };
      const puntos = seccionPuntosUtils.limitar(s.puntos);
      return { ...s, puntos, ...seccionPuntosUtils.bbox(puntos), rotacion: 0 };
    });

    return this.repo.guardarSecciones(id, normalizadas);
  }

  async macrosQueContienen(planoId: string): Promise<Array<{ id: string; codigo: string; nombre: string }>> {
    return this.repo.macrosQueContienen(planoId);
  }

  async asignarAMacro(macroId: string, planoHijoId: string): Promise<PlanoEntity> {
    const [macro, hijo] = await Promise.all([this.detalle(macroId), this.detalle(planoHijoId)]);
    if (macro.tipo !== TIPOS_PLANO.MACRO) {
      throw new DomainError("El destino debe ser un plano tipo macro", API_ERROR_CODES.VALIDATION, 400);
    }
    if (hijo.tipo === TIPOS_PLANO.MACRO) {
      throw new DomainError("No se puede asignar un macro dentro de otro macro", API_ERROR_CODES.VALIDATION, 400);
    }
    const otroMacro = await this.repo.findMacroConPlanoHijo(planoHijoId, macroId);
    if (otroMacro) {
      throw new DomainError(
        `El plano "${hijo.codigo}" ya pertenece al macro "${otroMacro.codigo}". Desasignalo de ahi primero.`,
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    return this.repo.agregarSeccionDefault(macroId, planoHijoId);
  }

  async quitarDeMacros(planoHijoId: string): Promise<void> {
    await this.repo.quitarPlanoDeMacros(planoHijoId);
  }

  async ocupacion(id: string, eventoId: string): Promise<SeccionOcupacion[]> {
    await this.detalle(id);
    return this.repo.ocupacionPorSecciones(id, eventoId);
  }

  async exportar(id: string): Promise<PlanoExportJSON> {
    const json = await this.repo.exportar(id);
    if (!json) throw new DomainError("Plano no encontrado", API_ERROR_CODES.NOT_FOUND, 404);
    return json;
  }

  async importar(data: PlanoExportJSON): Promise<PlanoEntity> {
    if (!data.codigo || !data.nombre) {
      throw new DomainError("El archivo debe incluir codigo y nombre", API_ERROR_CODES.VALIDATION, 400);
    }
    if (!Array.isArray(data.tipos) || !Array.isArray(data.bloques)) {
      throw new DomainError("Formato de archivo invalido (tipos/bloques)", API_ERROR_CODES.VALIDATION, 400);
    }
    return this.repo.importar(data);
  }

  async exportarTypeScript(id: string): Promise<{ bloques: string; tipos: string; construccion: string; index: string; registrySnippet: string }> {
    const plano = await this.detalle(id);
    const tiposActivos = plano.tipos.filter((t) => t.flgActivo !== false);
    const bloquesActivos = plano.bloques.filter((b) => b.flgActivo !== false);
    const furnitureActiva = plano.furniture.filter((f) => f.flgActivo !== false);
    const constName = tsCodegenUtils.toConstName(plano.codigo);
    const unionTypes = tsCodegenUtils.toUnionType(tiposActivos.map((t) => t.codigo));
    const tiposConCodigo = (t: { codigo: string; label: string; nombre: string; w: number; d: number; h: number; color: string; forma?: string }) =>
      `  ${t.codigo}: { w: ${t.w}, d: ${t.d}, h: ${t.h}, color: "${t.color}"${t.forma && t.forma !== "bloque" ? `, forma: "${t.forma}"` : ""} },`;
    const labelsConCodigo = (t: { codigo: string; label: string; nombre: string }) =>
      `  ${t.codigo}: { label: "${t.label}", nombre: "${t.nombre}" },`;

    const tipos = `export interface Dim { w: number; d: number; h: number; color: string; forma?: string; }

export const DIMENSIONES: Record<string, Dim> = {
${tiposActivos.map(tiposConCodigo).join("\n")}
};

export type BlockType = ${unionTypes};

export interface Item { id: string; dim: Dim; type: BlockType; tipologia?: string; rotY?: number; x: number; z: number; }

export const BLOCK_LABEL: Record<BlockType, { label: string; nombre: string }> = {
${tiposActivos.map(labelsConCodigo).join("\n")}
};
`;

    const bloques = `export const ${constName}_BLOQUE_IDS = [
${bloquesActivos.map((b) => `  "${b.bloqueId}",`).join("\n")}
] as const;

export type ${constName}BloqueId = (typeof ${constName}_BLOQUE_IDS)[number];
`;

    const itemLines = bloquesActivos.map((b) =>
      `    { id: "${b.bloqueId}", dim: DIMENSIONES.${b.tipoCodigo}, type: "${b.tipoCodigo}", tipologia: "${b.tipologia ?? TIPOLOGIAS_STAND.SIMPLE}", rotY: ${b.rotY ?? 0}, x: ${b.x}, z: ${b.z} },`,
    );
    const furnitureLines = furnitureActiva.map((f) => {
      const config = f.config ? `, config: ${JSON.stringify(f.config)}` : "";
      return `    { id: "${f.refId}", type: "${f.tipo}" as const, x: ${f.x}, z: ${f.z}, rotY: ${f.rotY}${config} },`;
    });

    const construccion = `import { DIMENSIONES, type Item } from "./tipos";

export function buildItems(): Item[] {
  return [
${itemLines.join("\n")}
  ];
}

export function buildFurniture() {
  return [
${furnitureLines.join("\n")}
  ];
}

export function computeBounds(items: Item[]) {
  if (items.length === 0) return { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x - it.dim.w / 2);
    maxX = Math.max(maxX, it.x + it.dim.w / 2);
    minZ = Math.min(minZ, it.z - it.dim.d / 2);
    maxZ = Math.max(maxZ, it.z + it.dim.d / 2);
  }
  return { minX: minX - 4, maxX: maxX + 4, minZ: minZ - 4, maxZ: maxZ + 4 };
}
`;

    const index = `export { buildItems, buildFurniture, computeBounds } from "./construccion";
export type { Item, BlockType } from "./tipos";
export { BLOCK_LABEL, DIMENSIONES } from "./tipos";
export { ${constName}_BLOQUE_IDS } from "./bloques";
`;

    const registrySnippet = `  ${plano.codigo}: {
    id: "${plano.codigo}",
    nombre: "${plano.nombre}",
    descripcion: "${plano.descripcion ?? ""}",
    buildItems: ${plano.codigo}BuildItems,
    computeBounds: ${plano.codigo}ComputeBounds,
    buildFurniture: ${plano.codigo}BuildFurniture,
    bloqueIds: ${constName}_BLOQUE_IDS,
    blockLabel: ${plano.codigo}Labels,
  },`;

    return { bloques, tipos, construccion, index, registrySnippet };
  }
}
