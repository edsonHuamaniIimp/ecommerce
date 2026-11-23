import {
  API_ERROR_CODES,
  MAX_FACTURACION_PROGRAMADA_POR_CORRIDA,
  TIPOS_SOLICITUD,
} from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import type { IFacturacionRepository } from "@/domain/ports/facturacion-repository";
import type {
  FacturacionProgramadaEntity,
  IFacturacionProgramadaRepository,
} from "@/domain/ports/facturacion-programada-repository";
import type { ReservaIimpArchivoInput } from "@/domain/ports/reserva-iimp-client";
import type {
  RequisitosFacturacionInput,
  SolicitarFacturaApplicationService,
} from "./solicitar-factura-service";
import { normalizarLinkArchivoIImp } from "./validar-archivo-iimp";

export interface ResultadoEjecucionProgramadas {
  procesadas: number;
  ejecutadas: number;
  errores: number;
}

/**
 * Solicitud de factura **programada** (solo solicitudes internas): Facturacion guarda
 * los requisitos y documentos con una fecha y hora; el cron registra la solicitud
 * de factura en el SIE cuando esa fecha llega (mismo flujo que "Solicitar factura").
 */
export class FacturacionProgramadaApplicationService {
  constructor(
    private readonly repo: IFacturacionProgramadaRepository,
    private readonly facturacion: IFacturacionRepository,
    private readonly solicitarFactura: SolicitarFacturaApplicationService,
  ) {}

  async programar(
    cuotaId: string,
    fechaProgramada: string,
    archivos: ReservaIimpArchivoInput[],
    requisitos: RequisitosFacturacionInput | null,
    usuario: string | null,
  ): Promise<FacturacionProgramadaEntity> {
    const fecha = new Date(fechaProgramada);
    if (Number.isNaN(fecha.getTime())) {
      throw new DomainError("La fecha y hora programadas no son validas", API_ERROR_CODES.VALIDATION, 400);
    }
    if (fecha.getTime() <= Date.now()) {
      throw new DomainError("La fecha y hora programadas deben ser posteriores a este momento", API_ERROR_CODES.VALIDATION, 400);
    }
    if (!requisitos) {
      throw new DomainError("Declara al menos un requisito o marca 'Ninguna de las anteriores'", API_ERROR_CODES.VALIDATION, 400);
    }
    const fact = await this.facturacion.facturacionDeCuota(cuotaId);
    if (!fact) throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    if (fact.tipoSolicitud !== TIPOS_SOLICITUD.RESERVA_EMPRESA) {
      throw new DomainError("Solo las solicitudes internas permiten programar la factura", API_ERROR_CODES.CONFLICT, 409);
    }
    if (fact.iimpContrato) {
      throw new DomainError(`La solicitud de factura ya fue registrada (contrato ${fact.iimpContrato})`, API_ERROR_CODES.CONFLICT, 409);
    }
    const normalizados = this.solicitarFactura.normalizarRequisitos(requisitos);
    const lista = archivos
      .filter((a) => a.link?.trim())
      .map((a) => ({ ...a, link: normalizarLinkArchivoIImp(a.link) }));
    return this.repo.programar({
      solicitudId: fact.solicitudId,
      cuotaId,
      fechaProgramada: fecha,
      requisitos: normalizados,
      archivos: lista,
      createdBy: usuario,
    });
  }

  async cancelar(solicitudId: string): Promise<void> {
    const cancelada = await this.repo.cancelar(solicitudId);
    if (cancelada === 0) {
      throw new DomainError("No hay una solicitud programada para cancelar", API_ERROR_CODES.NOT_FOUND, 404);
    }
  }

  vigentes(solicitudIds: string[]): Promise<FacturacionProgramadaEntity[]> {
    return this.repo.vigentesPorSolicitudes(solicitudIds);
  }

  /** Cron: registra las solicitudes de factura cuya fecha programada ya llego. */
  async ejecutarVencidas(): Promise<ResultadoEjecucionProgramadas> {
    const vencidas = await this.repo.listarVencidas(new Date(), MAX_FACTURACION_PROGRAMADA_POR_CORRIDA);
    let ejecutadas = 0;
    let errores = 0;
    let procesadas = 0;
    for (const tarea of vencidas) {
      /* Si Facturacion ya la registro a mano, la tarea deja de tener sentido. */
      const fact = await this.facturacion.facturacionDeCuota(tarea.cuotaId).catch(() => null);
      if (fact?.iimpContrato) {
        await this.repo.cancelar(tarea.solicitudId);
        continue;
      }
      if (!(await this.repo.tomar(tarea.id))) continue;
      procesadas += 1;
      try {
        await this.solicitarFactura.solicitarComoStaff(
          tarea.cuotaId,
          Array.isArray(tarea.archivos) ? (tarea.archivos as ReservaIimpArchivoInput[]) : [],
          (tarea.requisitos ?? null) as RequisitosFacturacionInput | null,
        );
        await this.repo.marcarEjecutada(tarea.id);
        ejecutadas += 1;
      } catch (e) {
        errores += 1;
        await this.repo.marcarError(tarea.id, e instanceof Error ? e.message : "Error al registrar la solicitud de factura");
      }
    }
    return { procesadas, ejecutadas, errores };
  }
}
