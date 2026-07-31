import type { IKbServiciosClient } from "@/domain/ports/kbservicios-client";
import type { IEventoRepository, EventoMetadata } from "@/domain/ports/evento-repository";
import type { EventoPadrePresalaDTO, EventoPresalaDTO } from "@/types/dto/eventos";
import { dateUtils } from "@/lib/utils/date";

const VERTICAL_BY_CODE: Record<number, string> = {
  1: "proexplo",
  2: "perumin",
  8: "difusion-minera",
  9: "eventos",
  13: "wmc",
  14: "gess",
};

function verticalFromCode(code: number, eventName: string): string {
  return VERTICAL_BY_CODE[code] ?? eventName.toLowerCase().replace(/\s+/g, "-");
}

interface ApiEvent { codeEvent: number; event: string; inicio: string; fin: string; active: boolean; }

export class PresalaApplicationService {
  constructor(
    private readonly kbApi: IKbServiciosClient,
    private readonly eventoRepo: IEventoRepository,
  ) {}

  async listarPresala(): Promise<EventoPadrePresalaDTO[]> {
    return this.fetchYCombinar((eventos) => eventos.filter((e) => e.active && e.inicio !== "0000-00-00"), true);
  }

  async listarTodas(): Promise<EventoPadrePresalaDTO[]> {
    return this.fetchYCombinar((eventos) => eventos);
  }

  private async fetchYCombinar(filter: (eventos: ApiEvent[]) => ApiEvent[], soloVisibles = false): Promise<EventoPadrePresalaDTO[]> {
    const tipos = await this.kbApi.listarTiposEvento();

    const allMetadata = await this.eventoRepo.findAllMetadata();
    const metaMap = new Map<string, EventoMetadata>();
    for (const m of allMetadata) {
      metaMap.set(`${m.tipoEvento}:${m.codigoEvento}`, m);
    }

    const result: EventoPadrePresalaDTO[] = [];
    for (const tipo of tipos) {
      try {
        const eventos = await this.kbApi.listarEventos(tipo.code);
        const filtrados = filter(eventos);
        if (filtrados.length === 0) continue;

        result.push({
          id: `api-${tipo.code}`,
          nombre: tipo.event,
          codigo: String(tipo.code),
          vertical: verticalFromCode(tipo.code, tipo.event),
          versiones: filtrados.map((ev): EventoPresalaDTO | null => {
            const meta = metaMap.get(`${tipo.code}:${ev.codeEvent}`);
            if (soloVisibles && !meta?.flgVisible) return null;
            return {
              id: meta ? `${tipo.code}-${ev.codeEvent}` : `api-${tipo.code}-${ev.codeEvent}`,
              anio: (meta?.anio && meta.anio !== "") ? meta.anio : dateUtils.extractYear(ev.inicio).toString(),
              tipoEvento: tipo.code,
              codigoEvento: ev.codeEvent,
              estado: meta?.estado ?? "active",
              fecha_inicio: new Date(ev.inicio).toISOString(),
              fecha_fin: ev.fin !== "0000-00-00" ? new Date(ev.fin).toISOString() : null,
              imagen: meta?.imagen ?? null,
              plano: meta?.plano ?? null,
              flgVisible: meta?.flgVisible ?? false,
            };
          }).filter((v): v is EventoPresalaDTO => v !== null),
        });
        if (result[result.length - 1].versiones.length === 0) result.pop();
      } catch { /* skip */ }
    }

    return result;
  }
}
