import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { IPlanogessClient } from "@/domain/ports/planogess-client";
import type { GessStand } from "@/types/reserva";

export class GessApplicationService {
  constructor(
    private readonly repo: IGessRepository,
    private readonly api: IPlanogessClient,
  ) {}

  async listar(eventoId: string, params: { page: number; perPage: number; search?: string; estado?: string }) {
    return this.repo.findAllPaginated(eventoId, params);
  }

  async findByBloque(bloqueId: string) {
    return this.repo.findByBloque(bloqueId);
  }

  async vincular(id: string, bloqueId: string | null) {
    return this.repo.update(id, { bloqueId });
  }

  async actualizarStand(id: string, data: { documentos?: string[]; imagenes?: string[]; estado?: string }) {
    return this.repo.update(id, data);
  }

  async sync(eventoId: string, tipoEvento: number, codigoEvento: number, seleccionadas?: Record<string, unknown>[]) {
    const rows = seleccionadas && seleccionadas.length > 0
      ? seleccionadas
      : await this.api.fetchStands(tipoEvento, codigoEvento);

    let creados = 0;
    let actualizados = 0;

    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const uid = String(r.uid ?? r.UID ?? r.codigo ?? r.stand ?? "");
      if (!uid) continue;

      const tipo = String(r.type ?? r.tipo ?? r.tipo_stand ?? "");
      const medidas = tipo
        ? tipo.startsWith("PREFERENCIAL") ? "3000.00 US$"
        : tipo.startsWith("ESTANDAR_01") ? "2000.00 US$"
        : tipo.startsWith("ESTANDAR_02") ? "2500.00 US$"
        : tipo.startsWith("ISLAS") ? "ISLA" : ""
        : "";

      const exists = await this.repo.findByStandApiId(eventoId, uid);
      const data = {
        eventoId, standApiId: uid, standCode: uid,
        tipoStand: tipo || null, medidas: medidas || null,
        estado: String(r.status ?? r.estado ?? "") || null,
        empresa: String(r.company ?? r.empresa ?? r.razon_social ?? "") || null,
        pabellon: String(r.x ?? r.pos_x ?? "") + "," + String(r.y ?? r.pos_y ?? ""),
        rawData: row,
      };

      if (exists) {
        await this.repo.update(exists.id, data as never);
        actualizados++;
      } else {
        await this.repo.create(data as never);
        creados++;
      }
    }

    return { creados, actualizados, total: rows.length };
  }
}
