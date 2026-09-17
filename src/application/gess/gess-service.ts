import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { IPlanogessClient } from "@/domain/ports/planogess-client";
import type { IPlanoRepository } from "@/domain/ports/plano-repository";
import { ESTADOS_STAND } from "@/lib/shared/constants";

const TIPO_STAND_POR_NOMBRE: Record<string, string> = {
  Preferencial: "PREFERENCIAL",
  "Estandar A": "ESTANDAR_01",
  "Estandar B": "ESTANDAR_02",
  Columna: "ESTANDAR_02",
  "Isla Grande": "ISLAS",
};

/** Precios reales del catalogo GESS (replica de data real de otro evento) */
const PRECIOS_REALES: Record<string, string> = {
  PREFERENCIAL: "3000.00 US$",
  ESTANDAR_01: "2000.00 US$",
  ESTANDAR_02: "2500.00 US$",
  ISLAS: "ISLA",
  ISLA: "ISLA",
  INSTITUCIONAL: "2000.00 US$",
  ALAMEDA: "1500.00 US$",
  ESTANDAR: "2000.00 US$",
};

const PRECIO_DEFAULT = "2000.00 US$";

function tipoStandDesdeNombre(nombre: string, fallback: string): string {
  const match = Object.keys(TIPO_STAND_POR_NOMBRE).find((k) => nombre.includes(k));
  return match ? TIPO_STAND_POR_NOMBRE[match] ?? fallback : fallback;
}

function medidasDesdeTipo(tipo: string): string {
  if (!tipo) return PRECIO_DEFAULT;
  return PRECIOS_REALES[tipo.toUpperCase()] ?? PRECIO_DEFAULT;
}

export class GessApplicationService {
  constructor(
    private readonly repo: IGessRepository,
    private readonly api: IPlanogessClient,
    private readonly planoRepo: IPlanoRepository,
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
      const medidas = medidasDesdeTipo(tipo);

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

  /**
   * Genera stands demo (replica el formato y precios de la data real del API KBEventos)
   * y los persiste en gess_stand, vinculados a los bloques de los planos del evento.
   * Util para eventos sin datos en el API.
   */
  async mockup(eventoId: string, tipoEvento: number, codigoEvento: number) {
    const planos = await this.planoRepo.planosDeEvento(tipoEvento, codigoEvento);
    const bloques = planos.flatMap((p) =>
      p.bloques.map((b) => {
        const tipo = p.tipos.find((t) => t.codigo === b.tipoCodigo);
        const tipoStand = tipo ? tipoStandDesdeNombre(tipo.nombre, "ESTANDAR_01") : "ESTANDAR_01";
        return {
          bloqueId: b.bloqueId,
          tipoStand,
          medidas: medidasDesdeTipo(tipoStand),
          plan: p.codigo,
          x: b.x,
          z: b.z,
        };
      }),
    );

    let creados = 0;
    let actualizados = 0;
    for (const b of bloques) {
      const exists = await this.repo.findByStandApiId(eventoId, b.bloqueId);
      const data = {
        eventoId,
        standApiId: b.bloqueId,
        standCode: b.bloqueId,
        tipoStand: b.tipoStand,
        medidas: b.medidas,
        estado: ESTADOS_STAND.DISPONIBLE,
        empresa: null,
        pabellon: `${b.x},${b.z}`,
        bloqueId: b.bloqueId,
        rawData: { mock: true, tipoEvento, codigoEvento, plan: b.plan },
      };
      if (exists) {
        await this.repo.update(exists.id, data as never);
        actualizados++;
      } else {
        await this.repo.create(data as never);
        creados++;
      }
    }

    return { creados, actualizados, total: bloques.length, planos: planos.map((p) => p.codigo) };
  }
}
