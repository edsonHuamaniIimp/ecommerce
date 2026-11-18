import {
  API_ERROR_CODES,
  AUTORES_SISTEMA,
  ESTADOS_PAGO_EXTERNO,
  MAX_DOCUMENTO_FACTURACION,
  MAX_JUSTIFICACION_FACTURACION,
  ROLES,
  type EstadoPagoExterno,
} from "@/lib/shared/constants";
import { DomainError } from "@/lib/server/router";
import { ALERTA_CLAVES } from "@/lib/shared/alert-templates";
import { getAppUrl } from "@/lib/server/app-url";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { resolverIdiomaDestinatario } from "@/application/idioma/resolver-idioma";
import { dateUtils } from "@/lib/shared/utils/date";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IFacturacionRepository } from "@/domain/ports/facturacion-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { NotificacionFacturaRequestDTO, NotificacionFacturaResponseDTO } from "@/types/dto/facturacion";

/**
 * API entrante (M2M) del sistema de facturacion: registra, contra una cuota de la
 * reserva IIMP, el **nombre del documento** (factura/boleta) y su **estado de pago**
 * codificado (`0` PAGADA, `1` PENDIENTE, `2` ANULADA). La cuota se localiza por
 * `NumeroSolicitud` (o contrato) + numero de cuota.
 * Con PAGADA la cuota pasa a pagada y, si no quedan pendientes, se cierra la
 * facturacion y la solicitud (mismo efecto que confirmar el pago a mano).
 * Con ANULADA el documento de la cuota se limpia (vuelve a pendiente de documento).
 */
export class NotificacionFacturaApplicationService {
  constructor(
    private readonly solicitudes: Pick<ISolicitudesRepository, "findSolicitudIdPorNumeroIImp" | "findSolicitudIdPorContrato" | "crearAlertaRol">,
    private readonly facturacion: Pick<IFacturacionRepository, "findFacturacionIdPorSolicitud" | "detalle" | "registrarNotificacionFactura">,
    private readonly auth: IAuthRepository,
  ) {}

  async registrar(input: NotificacionFacturaRequestDTO): Promise<NotificacionFacturaResponseDTO> {
    const estadoPago = this.validar(input);
    const documento = input.documento.trim();
    const fechaEmision = this.validarFechaEmision(input.fechaEmision);

    const solicitudId = input.numeroSolicitud?.trim()
      ? await this.solicitudes.findSolicitudIdPorNumeroIImp(input.numeroSolicitud)
      : await this.solicitudes.findSolicitudIdPorContrato(input.contrato ?? "");
    if (!solicitudId) {
      throw new DomainError("No existe una solicitud para el numero de solicitud o contrato indicado", API_ERROR_CODES.NOT_FOUND, 404);
    }

    const facturacionId = await this.facturacion.findFacturacionIdPorSolicitud(solicitudId);
    if (!facturacionId) {
      throw new DomainError("La solicitud no tiene una facturacion activa", API_ERROR_CODES.NOT_FOUND, 404);
    }

    const facturacion = await this.facturacion.detalle(facturacionId);
    if (!facturacion) {
      throw new DomainError("La solicitud no tiene una facturacion activa", API_ERROR_CODES.NOT_FOUND, 404);
    }
    const cuota = facturacion.cuotas.find((c) => c.numero === input.cuota);
    if (!cuota) {
      throw new DomainError(`La facturacion no tiene la cuota ${input.cuota}`, API_ERROR_CODES.NOT_FOUND, 404);
    }

    await this.facturacion.registrarNotificacionFactura(
      cuota.id,
      {
        documento,
        estadoPago,
        ...(estadoPago !== ESTADOS_PAGO_EXTERNO.ANULADA && fechaEmision ? { fechaEmision } : {}),
        justificacion: (input.justificacion ?? "").trim() || null,
      },
      AUTORES_SISTEMA.IIMP,
    );

    /*
     * Aviso al cliente de que la factura ya esta disponible. Solo cuando el
     * documento es nuevo o cambio su fecha de emision (evita correos repetidos
     * en reintentos del SIE); nunca en anulaciones/rechazos.
     */
    if (estadoPago !== ESTADOS_PAGO_EXTERNO.ANULADA && facturacion.correoSolicitante) {
      const esNuevaFactura =
        documento !== cuota.documentoSie ||
        (fechaEmision !== null && fechaEmision !== cuota.documentoSieFechaEmision);
      if (esNuevaFactura) {
        try {
          const idioma = await resolverIdiomaDestinatario(this.auth, facturacion.correoSolicitante);
          await enviarEmailPlantilla({
            to: facturacion.correoSolicitante,
            plantilla: "facturacion-factura-disponible",
            idioma,
            datos: {
              razonSocial: facturacion.empresaFacturacion ?? "su empresa",
              standCodes: facturacion.standCode,
              numero: documento,
              fechaEmision,
            },
          });
        } catch {
          /* El correo no bloquea la notificacion M2M. */
        }
      }
    }

    /* Anulacion o rechazo (mismo codigo 2): alerta operativa a Facturacion para reemitir. */
    if (estadoPago === ESTADOS_PAGO_EXTERNO.ANULADA) {
      await this.solicitudes
        .crearAlertaRol({
          rol: ROLES.ADMIN,
          tipo: "facturacion",
          clave: ALERTA_CLAVES.FACTURA_ANULADA_RECHAZADA,
          datos: { cuota: cuota.numero, documento },
          url: `${getAppUrl()}/dashboard/solicitudes`,
        })
        .catch(() => undefined);
    }

    return {
      cuotaId: cuota.id,
      numero: cuota.numero,
      documento,
      estadoPago,
      fechaEmision: estadoPago === ESTADOS_PAGO_EXTERNO.ANULADA ? null : fechaEmision,
    };
  }

  /** Fecha de emision opcional de la factura (YYYY-MM-DD, no futura). */
  private validarFechaEmision(valor: string | null | undefined): string | null {
    const fecha = (valor ?? "").trim();
    if (!fecha) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !dateUtils.isValid(fecha)) {
      throw new DomainError("fechaEmision debe ser una fecha valida (YYYY-MM-DD)", API_ERROR_CODES.VALIDATION, 400);
    }
    if (fecha > dateUtils.todayLimaInputValue()) {
      throw new DomainError("fechaEmision no puede ser futura", API_ERROR_CODES.VALIDATION, 400);
    }
    return fecha;
  }

  private validar(input: NotificacionFacturaRequestDTO): EstadoPagoExterno {
    if (!input.numeroSolicitud?.trim() && !input.contrato?.trim()) {
      throw new DomainError("numeroSolicitud o contrato es obligatorio", API_ERROR_CODES.VALIDATION, 400);
    }
    if (!Number.isInteger(input.cuota) || input.cuota < 1) {
      throw new DomainError("cuota debe ser un entero mayor a 0", API_ERROR_CODES.VALIDATION, 400);
    }
    const documento = (input.documento ?? "").trim();
    if (!documento) throw new DomainError("documento es obligatorio", API_ERROR_CODES.VALIDATION, 400);
    if (documento.length > MAX_DOCUMENTO_FACTURACION) {
      throw new DomainError(`documento no puede superar ${MAX_DOCUMENTO_FACTURACION} caracteres`, API_ERROR_CODES.VALIDATION, 400);
    }
    const validos: number[] = [ESTADOS_PAGO_EXTERNO.PAGADA, ESTADOS_PAGO_EXTERNO.PENDIENTE, ESTADOS_PAGO_EXTERNO.ANULADA];
    if (!Number.isInteger(input.estadoPago) || !validos.includes(input.estadoPago)) {
      throw new DomainError("estadoPago debe ser 0 (PAGADA), 1 (PENDIENTE) o 2 (ANULADA/RECHAZADA)", API_ERROR_CODES.VALIDATION, 400);
    }
    const justificacion = (input.justificacion ?? "").trim();
    if (input.estadoPago === ESTADOS_PAGO_EXTERNO.ANULADA && !justificacion) {
      throw new DomainError("justificacion es obligatoria cuando estadoPago es 2 (ANULADA/RECHAZADA)", API_ERROR_CODES.VALIDATION, 400);
    }
    if (justificacion.length > MAX_JUSTIFICACION_FACTURACION) {
      throw new DomainError(`justificacion no puede superar ${MAX_JUSTIFICACION_FACTURACION} caracteres`, API_ERROR_CODES.VALIDATION, 400);
    }
    return input.estadoPago as EstadoPagoExterno;
  }
}
