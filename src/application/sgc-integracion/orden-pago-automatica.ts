import { ESTADOS_SOLICITUD } from "@/lib/shared/constants";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";

/**
 * "Aprobado el contrato = orden de facturacion generada": deja la solicitud en
 * `pendiente_pago` y crea la Facturacion con el plan de cuotas del contrato.
 * La usan el webhook del SGC (`workflow.approved` con `finalization=active`) y
 * el bypass admin. Best-effort: un fallo no propaga ni revierte la aprobacion.
 */
export async function habilitarOrdenPagoAutomatica(
  solicitudes: ISolicitudesRepository,
  solicitudId: string,
): Promise<void> {
  try {
    const detalle = await solicitudes.detalle(solicitudId);
    if (!detalle) return;
    if (detalle.estado === ESTADOS_SOLICITUD.PENDIENTE_PAGO || detalle.estado === ESTADOS_SOLICITUD.PAGADO) return;
    await solicitudes.marcarOrdenPago(solicitudId);
  } catch (err) {
    console.error(
      "[sgc] No se pudo generar la orden de pago automatica:",
      err instanceof Error ? err.message : err,
    );
  }
}
