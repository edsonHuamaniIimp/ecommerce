import type { IFacturacionRepository, FacturacionListParams, FacturacionListResult, FacturacionRow, DatosComprobanteFiscal } from "@/domain/ports/facturacion-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import { DomainError } from "@/lib/server/router";
import { API_ERROR_CODES, ESTADOS_CUOTA, PERMISSIONS, TIPOS_COMPROBANTE } from "@/lib/shared/constants";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { resolverIdiomaDestinatario } from "@/application/idioma/resolver-idioma";

/** Tipos validos del comprobante fiscal (ver TIPOS_COMPROBANTE). */
const TIPOS_COMPROBANTE_FISCAL: string[] = [TIPOS_COMPROBANTE.FACTURA, TIPOS_COMPROBANTE.BOLETA];

export class FacturacionApplicationService {
  constructor(
    private readonly repo: IFacturacionRepository,
    private readonly authRepo: IAuthRepository,
  ) {}

  /** Permiso de gestion de Facturacion (o admin total). */
  autorizarGestion(permissions: string[] = []): void {
    const permitido =
      permissions.includes(PERMISSIONS.FACTURACION_VIEW) || permissions.includes(PERMISSIONS.ADMIN_FULL);
    if (!permitido) {
      throw new DomainError("Sin permiso para gestionar facturacion", API_ERROR_CODES.FORBIDDEN, 403);
    }
  }

  async listar(params: FacturacionListParams): Promise<FacturacionListResult> {
    return this.repo.listar(params);
  }

  async detalle(id: string): Promise<FacturacionRow | null> {
    return this.repo.detalle(id);
  }

  /** El plan de pago lo definio el cliente en el contrato: la configuracion no es editable. */
  private async validarConfiguracionEditable(facturacionId: string): Promise<void> {
    const fact = await this.repo.detalle(facturacionId);
    if (fact?.planCliente) {
      throw new DomainError(
        "Las cuotas las definio el cliente en el contrato; no se pueden modificar. Aqui solo se confirman los pagos.",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
  }

  async agregarCuota(facturacionId: string, monto: number, fechaVencimiento: string | null, createdBy: string): Promise<void> {
    await this.validarConfiguracionEditable(facturacionId);
    return this.repo.agregarCuota(facturacionId, monto, fechaVencimiento, createdBy);
  }

  async pagarCuota(cuotaId: string, createdBy: string, comprobante: string | null): Promise<void> {
    return this.repo.pagarCuota(cuotaId, createdBy, comprobante);
  }

  /**
   * Adjunta (o reemplaza) el comprobante fiscal (boleta/factura) de una cuota
   * pagada y notifica al cliente por correo (best-effort, en su idioma).
   */
  async adjuntarComprobanteFiscal(cuotaId: string, data: DatosComprobanteFiscal, createdBy: string): Promise<void> {
    if (!TIPOS_COMPROBANTE_FISCAL.includes(data.tipo)) {
      throw new DomainError(
        `Tipo de comprobante invalido: ${data.tipo}. Valores: ${TIPOS_COMPROBANTE_FISCAL.join(", ")}`,
        API_ERROR_CODES.VALIDATION,
        400,
      );
    }
    const fact = await this.repo.facturacionDeCuota(cuotaId);
    const cuota = fact?.cuotas.find((c) => c.id === cuotaId);
    if (!fact || !cuota) {
      throw new DomainError("Cuota no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    }
    if (cuota.estado !== ESTADOS_CUOTA.PAGADO) {
      throw new DomainError("Solo se puede adjuntar el comprobante de una cuota pagada", API_ERROR_CODES.CONFLICT, 409);
    }
    await this.repo.adjuntarComprobanteFiscal(cuotaId, data, createdBy);
    if (fact.correoSolicitante) {
      try {
        const idioma = await resolverIdiomaDestinatario(this.authRepo, fact.correoSolicitante);
        await enviarEmailPlantilla({
          to: fact.correoSolicitante,
          plantilla: "comprobante-pago",
          idioma,
          datos: { standCode: fact.standCode, tipo: data.tipo, numero: data.numero },
        });
      } catch { /* el correo no bloquea el adjuntado */ }
    }
  }

  async actualizar(id: string, data: { tipo?: string; modoPago?: string }, createdBy: string): Promise<void> {
    if (data.modoPago !== undefined) {
      await this.validarConfiguracionEditable(id);
    }
    return this.repo.actualizar(id, data, createdBy);
  }

  async eliminar(id: string, createdBy: string): Promise<void> {
    return this.repo.eliminar(id, createdBy);
  }

  async eliminarCuota(cuotaId: string, createdBy: string): Promise<void> {
    const fact = await this.repo.facturacionDeCuota(cuotaId);
    if (fact?.planCliente) {
      throw new DomainError(
        "Las cuotas las definio el cliente en el contrato; no se pueden modificar. Aqui solo se confirman los pagos.",
        API_ERROR_CODES.CONFLICT,
        409,
      );
    }
    return this.repo.eliminarCuota(cuotaId, createdBy);
  }
}
