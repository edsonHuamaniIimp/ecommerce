import type { IGessRepository } from "@/domain/ports/gess-repository";
import { ESTADOS_STAND, ESTADOS_STAND_LEGACY, MONEDAS } from "@/lib/shared/constants";
import type { EstadisticasEventoDTO } from "@/types/dto/dashboard/estadisticas-evento.dto";

const ESTADISTICAS_VACIAS: EstadisticasEventoDTO = {
  totalStands: 0,
  reservados: 0,
  disponibles: 0,
  enProceso: 0,
  montoTotal: 0,
  moneda: MONEDAS.US_DOLAR,
};

export class DashboardApplicationService {
  constructor(private readonly gessRepo: IGessRepository) {}

  /** Ocupacion y recaudacion del evento activo (Panel de Control). */
  async estadisticasEvento(eventoId: string): Promise<EstadisticasEventoDTO> {
    if (!eventoId) return ESTADISTICAS_VACIAS;

    const stands = await this.gessRepo.findByEvento(eventoId);
    const totalStands = stands.length;
    const reservados = stands.filter((s) => s.estado === ESTADOS_STAND_LEGACY.RESERVADO).length;
    const enProceso = stands.filter(
      (s) => s.estado === ESTADOS_STAND.EN_EVALUACION || s.estado === ESTADOS_STAND_LEGACY.EN_EVALUACION,
    ).length;
    const disponibles = totalStands - reservados - enProceso;

    const montoTotal = stands
      .filter((s) => s.estado === ESTADOS_STAND_LEGACY.RESERVADO)
      .reduce((acc, s) => {
        const monto = s.medidas?.replace(MONEDAS.US_DOLAR, "").trim() ?? "0";
        return acc + (parseFloat(monto) || 0);
      }, 0);

    return { totalStands, reservados, disponibles, enProceso, montoTotal, moneda: MONEDAS.US_DOLAR };
  }
}
