import type { ContratoApplicationService } from "@/application/contratos/contrato-service";
import type { ConfiguracionApplicationService } from "@/application/configuracion/configuracion-service";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { SgcObservacionDocumento } from "@/domain/models/sgc";
import { ALERTA_CLAVES } from "@/lib/shared/alert-templates";
import { ESTADOS_DOCUMENTO_SOLICITUD, ORIGENES_DOCUMENTO, ROLES, SGC_OBSERVACION_ESTADOS, TIPOS_DOCUMENTO_SOLICITUD } from "@/lib/shared/constants";
import { getAppUrl } from "@/lib/server/app-url";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { dateUtils } from "@/lib/shared/utils/date";
import { esObservacionSgcContrato } from "@/lib/shared/utils/solicitud-documentos";

const ADMIN_EMAIL_FALLBACK = "ext_analistaprogramador3@iimp.org.pe";

export interface ResultadoContratoObservadoSgc {
  aplica: boolean;
  auto: boolean;
  yaRegenerado: boolean;
  error: string | null;
  observacion: SgcObservacionDocumento | null;
}

function observacionContratoAbierta(observaciones: SgcObservacionDocumento[] | null | undefined): SgcObservacionDocumento | null {
  return (
    (observaciones ?? []).find(
      (o) =>
        o.status !== SGC_OBSERVACION_ESTADOS.RESOLVED &&
        o.requiresDocumentChange !== false &&
        esObservacionSgcContrato(o),
    ) ?? null
  );
}

/**
 * Regenera el contrato cuando el SGC lo observa, sin depender de una accion del
 * Asociado. Solo actua sobre contratos generados por el sistema y si aun no hay
 * una version del admin posterior a la observacion (idempotente).
 */
export async function procesarContratoObservadoSgc(params: {
  solicitudId: string;
  observaciones: SgcObservacionDocumento[] | null | undefined;
  solicitudes: ISolicitudesRepository;
  contrato?: ContratoApplicationService;
}): Promise<ResultadoContratoObservadoSgc> {
  const observacion = observacionContratoAbierta(params.observaciones);
  if (!observacion) {
    return { aplica: false, auto: false, yaRegenerado: false, error: null, observacion: null };
  }

  const detalle = await params.solicitudes.detalle(params.solicitudId).catch(() => null);
  if (!detalle) {
    return { aplica: true, auto: false, yaRegenerado: false, error: "Solicitud no encontrada", observacion };
  }

  const admin = detalle.docsAdjuntos
    .filter(
      (d) =>
        d.userId === null &&
        d.categoria === TIPOS_DOCUMENTO_SOLICITUD.CONTRATO &&
        (!d.estado || d.estado === ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO),
    )
    .sort((a, b) => (dateUtils.toMs(b.createdAt) ?? 0) - (dateUtils.toMs(a.createdAt) ?? 0))[0];

  if (admin && dateUtils.isAfter(admin.createdAt, observacion.createdAt)) {
    return { aplica: true, auto: false, yaRegenerado: true, error: null, observacion };
  }
  if (!admin || admin.origen !== ORIGENES_DOCUMENTO.GENERADO) {
    return {
      aplica: true,
      auto: false,
      yaRegenerado: false,
      error: "El contrato observado no es generado por el sistema; requiere revision manual.",
      observacion,
    };
  }
  if (!params.contrato) {
    return { aplica: true, auto: false, yaRegenerado: false, error: "Servicio de contratos no disponible", observacion };
  }
  if (dateUtils.toMs(observacion.createdAt) === null) {
    return { aplica: true, auto: false, yaRegenerado: false, error: "La observacion no tiene fecha", observacion };
  }

  try {
    await params.contrato.regenerarContratoParaSgc(params.solicitudId);
    return { aplica: true, auto: true, yaRegenerado: false, error: null, observacion };
  } catch (err) {
    return {
      aplica: true,
      auto: false,
      yaRegenerado: false,
      error: err instanceof Error ? err.message : "No se pudo regenerar el contrato",
      observacion,
    };
  }
}

/** Avisa al rol Asociado y a los correos internos configurados. */
export async function notificarContratoObservadoSgc(params: {
  solicitudId: string;
  resultado: ResultadoContratoObservadoSgc;
  solicitudes: ISolicitudesRepository;
  configuracion?: ConfiguracionApplicationService;
}): Promise<void> {
  if (!params.resultado.aplica || params.resultado.yaRegenerado) return;
  const detalle = await params.solicitudes.detalle(params.solicitudId).catch(() => null);
  if (!detalle) return;

  await params.solicitudes
    .crearAlertaRevision({
      rol: ROLES.ASOCIADO,
      solicitudId: params.solicitudId,
      clave: ALERTA_CLAVES.SGC_CONTRATO_OBSERVADO,
      datos: {
        stands: detalle.standCode,
        empresa: detalle.empresa,
        autoRegenerado: params.resultado.auto,
        motivo: params.resultado.observacion?.message ?? params.resultado.error,
      },
    })
    .catch(() => undefined);

  let destinatarios: string[] = [];
  if (params.configuracion) {
    destinatarios = await params.configuracion.obtenerNotificacionesSolicitudes().catch(() => []);
  }
  const lista = (destinatarios.length > 0 ? destinatarios : [process.env.ADMIN_EMAIL ?? ADMIN_EMAIL_FALLBACK])
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const unicos = [...new Set(lista)];
  if (unicos.length === 0) return;

  await Promise.all(
    unicos.map((to) =>
      enviarEmailPlantilla({
        to,
        plantilla: "sgc-contrato-observado",
        idioma: "es",
        datos: {
          standCode: detalle.standCode,
          empresa: detalle.empresa ?? "-",
          motivo: params.resultado.observacion?.message ?? params.resultado.error ?? "Contrato observado por el SGC",
          autoRegenerado: params.resultado.auto,
          url: `${getAppUrl()}/dashboard/solicitudes`,
        },
      }).catch(() => false),
    ),
  );
}
