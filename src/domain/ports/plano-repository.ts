import type { PlanoEntity, PlanoListItem, PlanoExportJSON, PlanoBloqueEntity, PlanoTipoBloqueEntity, PlanoFurnitureEntity, PlanoSeccionEntity, SeccionOcupacion, PlanoTipoSugerido } from "../models/plano-entities";

/** Ubicacion de un bloque: plano (pabellon), bloque y macro que lo contiene (si aplica). */
export interface UbicacionBloque {
  plano: { id: string; codigo: string; nombre: string; tipo: string };
  bloque: PlanoBloqueEntity;
  macro: { id: string; codigo: string; nombre: string } | null;
}

export interface IPlanoRepository {
  listar(): Promise<PlanoListItem[]>;
  listarTiposSugeridos(): Promise<PlanoTipoSugerido[]>;
  detalle(id: string): Promise<PlanoEntity | null>;
  detallePorCodigo(codigo: string): Promise<PlanoEntity | null>;

  planosDeEvento(tipoEvento: number, codigoEvento: number): Promise<PlanoEntity[]>;

  crear(data: { codigo: string; nombre: string; descripcion?: string | null; tipo?: string }): Promise<PlanoEntity>;
  actualizarMeta(id: string, data: { nombre?: string; descripcion?: string | null; flgActivo?: boolean; tipo?: string; imagenFondo?: string | null }): Promise<PlanoEntity>;
  eliminar(id: string): Promise<void>;

  guardarLayout(
    id: string,
    data: {
      tipos: Array<Omit<PlanoTipoBloqueEntity, "id" | "planoId">>;
      bloques: Array<Omit<PlanoBloqueEntity, "id" | "planoId" | "tipoId">>;
      furniture: Array<Omit<PlanoFurnitureEntity, "id" | "planoId">>;
    },
  ): Promise<PlanoEntity>;

  guardarSecciones(id: string, secciones: Array<Omit<PlanoSeccionEntity, "id" | "planoId">>): Promise<PlanoEntity>;

  /** Persiste solo el catalogo de tipos (sin tocar bloques ni decoraciones). */
  guardarTipos(id: string, tipos: Array<Omit<PlanoTipoBloqueEntity, "id" | "planoId">>): Promise<PlanoEntity>;

  macrosQueContienen(planoHijoId: string): Promise<Array<{ id: string; codigo: string; nombre: string }>>;

  /** Resuelve en que plano (pabellon) y macro esta un bloque de stand (RF-08). */
  ubicacionDeBloque(bloqueId: string): Promise<UbicacionBloque | null>;

  findMacroConPlanoHijo(planoHijoId: string, exceptPlanoId: string): Promise<{ id: string; codigo: string; nombre: string } | null>;

  agregarSeccionDefault(macroId: string, planoHijoId: string): Promise<PlanoEntity>;

  quitarPlanoDeMacros(planoHijoId: string): Promise<void>;

  tieneEventoAsignado(codigo: string): Promise<boolean>;

  desvincularSeccionesHijas(planoHijoId: string): Promise<void>;

  ocupacionPorSecciones(planoId: string, eventoId: string): Promise<SeccionOcupacion[]>;

  exportar(id: string): Promise<PlanoExportJSON | null>;
  importar(data: PlanoExportJSON): Promise<PlanoEntity>;
}
