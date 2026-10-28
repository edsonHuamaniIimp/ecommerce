import type { IFacturacionRepository, FacturacionListResult, FacturacionRow, ClienteIdent, CuotaUpdate } from "@/domain/ports/facturacion-repository";
import { DomainError } from "@/lib/server/router";
import { API_ERROR_CODES } from "@/lib/shared/constants";
import { nombreFacturaIimp, urlDocumentoSie, urlFacturaIimp } from "@/lib/server/facturas-pdf";

/** Tolerancia para comparar montos decimales. */
const EPS = 0.001;

/**
 * Vista de pagos del exhibidor (cliente). Aplica SIEMPRE validacion de propiedad:
 * solo opera sobre facturaciones cuya solicitud pertenece al usuario.
 */
export class PagosApplicationService {
  constructor(private readonly repo: IFacturacionRepository) {}

  async listar(
    ident: ClienteIdent,
    params: { page: number; perPage: number; empresaId?: string },
  ): Promise<FacturacionListResult> {
    return this.repo.listarPorCliente({ ...ident, ...params });
  }

  /** URL y nombre del comprobante fiscal de una cuota propia. */
  async factura(cuotaId: string, ident: ClienteIdent): Promise<{ url: string; nombre: string }> {
    const { cuota } = await this.cuotaPropia(cuotaId, ident);
    if (cuota.documentoSieAnulado) {
      throw new DomainError(
        "La factura de esta cuota fue anulada o rechazada por el IIMP",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    if (cuota.comprobanteFiscal?.url) {
      return {
        url: cuota.comprobanteFiscal.url,
        nombre: `${cuota.comprobanteFiscal.tipo}-${cuota.comprobanteFiscal.numero}.pdf`,
      };
    }
    if (cuota.iimpDocumento) {
      const url = urlFacturaIimp(cuota.iimpDocumento);
      if (!url) {
        throw new DomainError(
          "La descarga de facturas del IIMP no esta configurada",
          API_ERROR_CODES.SERVICE_UNAVAILABLE,
          503,
        );
      }
      return { url, nombre: nombreFacturaIimp(cuota.iimpDocumento) };
    }
    /* Documento notificado por el SIE (solo nombre): se resuelve contra el repositorio del IIMP. */
    if (cuota.documentoSie) {
      const url = urlDocumentoSie(cuota.documentoSie);
      if (!url) {
        throw new DomainError(
          "La descarga de facturas del IIMP no esta configurada",
          API_ERROR_CODES.SERVICE_UNAVAILABLE,
          503,
        );
      }
      return { url, nombre: cuota.documentoSie };
    }
    throw new DomainError(
      "La factura aun no fue emitida o publicada",
      API_ERROR_CODES.NOT_FOUND,
      404,
    );
  }

  async detalle(id: string, ident: ClienteIdent): Promise<FacturacionRow> {
    const row = await this.repo.detalle(id);
    if (!row) throw new DomainError("Facturacion no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    await this.exigirPropiedad(id, ident);
    return row;
  }

  async agregarCuota(facturacionId: string, monto: number, fechaVencimiento: string | null, ident: ClienteIdent): Promise<void> {
    await this.exigirPropiedad(facturacionId, ident);
    const fact = await this.repo.detalle(facturacionId);
    if (!fact) throw new DomainError("Facturacion no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    this.exigirPlanEditable(fact.planCliente);
    const suma = fact.cuotas.reduce((s, c) => s + c.monto, 0) + monto;
    if (suma > fact.montoTotal + EPS) {
      throw new DomainError(
        `La suma de las cuotas (${suma.toFixed(2)}) supera el monto total (${fact.montoTotal.toFixed(2)})`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    await this.repo.agregarCuota(facturacionId, monto, fechaVencimiento, this.autor(ident));
  }

  async actualizarCuota(cuotaId: string, data: CuotaUpdate, ident: ClienteIdent): Promise<void> {
    const { fact, cuota } = await this.cuotaPropia(cuotaId, ident);
    this.exigirPlanEditable(fact.planCliente);
    this.exigirSinVoucher(cuota.comprobante);
    if (data.monto !== undefined) {
      const sumaOtras = fact.cuotas.reduce((s, c) => s + (c.id === cuotaId ? 0 : c.monto), 0);
      const suma = sumaOtras + data.monto;
      if (suma > fact.montoTotal + EPS) {
        throw new DomainError(
          `La suma de las cuotas (${suma.toFixed(2)}) supera el monto total (${fact.montoTotal.toFixed(2)})`,
          API_ERROR_CODES.VALIDATION,
          400,
        );
      }
    }
    await this.repo.actualizarCuota(cuotaId, data, this.autor(ident));
  }

  async eliminarCuota(cuotaId: string, ident: ClienteIdent): Promise<void> {
    const { fact, cuota } = await this.cuotaPropia(cuotaId, ident);
    this.exigirPlanEditable(fact.planCliente);
    this.exigirSinVoucher(cuota.comprobante);
    await this.repo.eliminarCuota(cuotaId, this.autor(ident));
  }

  /** Adjunta (o reemplaza) el voucher de pago del exhibidor en una cuota propia. */
  async adjuntarVoucher(cuotaId: string, comprobante: string, ident: ClienteIdent): Promise<void> {
    await this.cuotaPropia(cuotaId, ident);
    await this.repo.adjuntarVoucher(cuotaId, comprobante, this.autor(ident));
  }

  private async exigirPropiedad(facturacionId: string, ident: ClienteIdent): Promise<void> {
    if (!(await this.repo.esPropietario(facturacionId, ident))) {
      throw new DomainError("Sin acceso a esta facturacion", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  /** Cuota propia (valida propiedad) junto con su facturacion. */
  private async cuotaPropia(cuotaId: string, ident: ClienteIdent): Promise<{ fact: FacturacionRow; cuota: FacturacionRow["cuotas"][number] }> {
    if (!(await this.repo.esPropietarioDeCuota(cuotaId, ident))) {
      throw new DomainError("Sin acceso a esta cuota", API_ERROR_CODES.FORBIDDEN, 403);
    }
    const fact = await this.repo.facturacionDeCuota(cuotaId);
    if (!fact) throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    const cuota = fact.cuotas.find((c) => c.id === cuotaId);
    if (!cuota) throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    return { fact, cuota };
  }

  /** Bloquea edicion/eliminacion de cuotas que ya tienen voucher adjunto. */
  private exigirSinVoucher(comprobante: string | null): void {
    if (comprobante) {
      throw new DomainError(
        "La cuota ya tiene un voucher adjunto y esta pendiente de confirmacion",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
  }

  /**
   * El plan lo definio el cliente en el contrato (`solicitud.plan_cuotas`): la configuracion
   * de cuotas no es editable desde "Mis pagos" (solo adjuntar vouchers de pago).
   */
  private exigirPlanEditable(planCliente: boolean): void {
    if (planCliente) {
      throw new DomainError(
        "Las cuotas las definio el cliente en el contrato; no se pueden modificar. Aqui solo puedes adjuntar el voucher del pago.",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
  }

  private autor(ident: ClienteIdent): string {
    return ident.email ?? ident.userId ?? "cliente";
  }
}
