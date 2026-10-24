import type { IEventoRepository } from "@/domain/ports/evento-repository";
import type { EventoEntity, ModalInfoConfig } from "@/domain/models/entities";
import { DomainError } from "@/lib/server/router";
import { API_ERROR_CODES } from "@/lib/shared/constants";

export class EventoApplicationService {
  constructor(private readonly repo: IEventoRepository) {}

  async listarPresala() {
    const now = new Date();
    return this.repo.findPadresConVersiones({ estado: "active", flgActivo: true, flgVisible: true, fechaVigente: now });
  }

  async listarTodas(activos?: boolean) {
    return this.repo.findAll(activos);
  }

  /**
   * Catalogo local de eventos para filtros internos (DD, bandejas, panel).
   * No depende del API externo de presala y no duplica opciones.
   */
  async listarCatalogoLocal() {
    const padres = await this.repo.findPadresConVersiones({});
    return padres
      .map((padre) => {
        const vistos = new Set<string>();
        const versiones = padre.versiones
          .filter((version) => {
            if (vistos.has(version.id)) return false;
            vistos.add(version.id);
            return true;
          })
          .sort((a, b) => b.anio.localeCompare(a.anio))
          .map((version) => ({
            id: version.id,
            anio: version.anio,
            tipoEvento: version.tipoEvento,
            codigoEvento: version.codigoEvento,
            estado: version.estado,
            fecha_inicio: version.fechaInicio?.toISOString() ?? null,
            fecha_fin: version.fechaFin?.toISOString() ?? null,
            imagen: version.imagen,
            plano: version.plano,
            flgVisible: version.flgVisible,
            modal_info: null,
          }));
        return { ...padre, versiones };
      })
      .filter((padre) => padre.versiones.length > 0);
  }

  async obtenerPorId(id: string) {
    return this.repo.findById(id);
  }

  async crear(data: { eventoPadreId: string; anio: string; fechaInicio?: string; fechaFin?: string }) {
    return this.repo.create({
      eventoPadreId: data.eventoPadreId,
      anio: data.anio,
      fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : undefined,
      fechaFin: data.fechaFin ? new Date(data.fechaFin) : undefined,
    });
  }

  async actualizar(data: {
    id?: string;
    tipo_evento?: number;
    codigo_evento?: number;
    estado?: string;
    anio?: string;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    flg_activo?: boolean;
    flg_visible?: boolean;
    plano?: string;
    imagen?: string;
    modal_info?: ModalInfoConfig | null;
  }) {
    const mapped: Partial<Pick<EventoEntity, "estado" | "anio" | "fechaInicio" | "fechaFin" | "flgActivo" | "flgVisible" | "plano" | "imagen">> = {};
    if (data.estado !== undefined) mapped.estado = data.estado;
    if (data.anio !== undefined) mapped.anio = data.anio;
    if (data.fecha_inicio !== undefined) mapped.fechaInicio = data.fecha_inicio ? new Date(data.fecha_inicio) : null;
    if (data.fecha_fin !== undefined) mapped.fechaFin = data.fecha_fin ? new Date(data.fecha_fin) : null;
    if (data.flg_activo !== undefined) mapped.flgActivo = data.flg_activo;
    if (data.flg_visible !== undefined) mapped.flgVisible = data.flg_visible;
    if (data.plano !== undefined) mapped.plano = data.plano;
    if (data.imagen !== undefined) mapped.imagen = data.imagen;

    const tipoEvento = data.tipo_evento;
    const codigoEvento = data.codigo_evento;

    // Un mapa 3D solo puede estar asignado a un evento a la vez ("" desasigna, no valida)
    if (data.plano !== undefined && data.plano && tipoEvento !== undefined && codigoEvento !== undefined) {
      const dueno = await this.repo.findEventoPorPlano(data.plano, tipoEvento, codigoEvento);
      if (dueno) {
        throw new DomainError(
          `El mapa "${data.plano}" ya esta asignado al evento ${dueno.tipoEvento}/${dueno.codigoEvento}. Desasigna el mapa de ese evento primero.`,
          API_ERROR_CODES.CONFLICT,
          409,
        );
      }
    }

    if (tipoEvento !== undefined && codigoEvento !== undefined) {
      return this.repo.upsertByTipoCodigo(tipoEvento, codigoEvento, {
        imagen: data.imagen,
        flgVisible: data.flg_visible,
        plano: data.plano,
        modalInfo: data.modal_info,
      });
    }
    if (data.id) return this.repo.update(data.id, mapped);
    throw new Error("Se requiere id o (tipoEvento + codigoEvento)");
  }

  /** Config del modal informativo mostrado al entrar a /mapa. */
  async obtenerModalInfo(tipoEvento: number, codigoEvento: number): Promise<ModalInfoConfig | null> {
    return this.repo.findModalInfo(tipoEvento, codigoEvento);
  }
}
