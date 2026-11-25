import "server-only";

import { prisma } from "@/lib/server/db";
import {
  DD_AUDITORIA_TIPO,
  DD_ESTADOS,
  DD_HISTORIAL_TIPOS,
  DD_OBSERVACION_AREAS,
} from "@/lib/shared/constants";

/**
 * Pasa la DD de "Documentacion recibida" a "En revision" cuando SIG empieza a trabajarla.
 * La condicion va en el WHERE: si la DD ya esta en revision (o mas adelante) no se toca,
 * asi nunca retrocede aunque dos personas actuen a la vez. Devuelve true si hubo cambio.
 */
export async function iniciarRevisionSiRecibida(
  expedienteId: string,
  actor: string,
  motivo: string,
): Promise<boolean> {
  const { count } = await prisma.debidaDiligencia.updateMany({
    where: { id: expedienteId, estado: DD_ESTADOS.DOCUMENTACION_RECIBIDA },
    data: { estado: DD_ESTADOS.EN_REVISION, actualizadoPor: actor },
  });
  if (count === 0) return false;
  const expediente = await prisma.debidaDiligencia.findUnique({ where: { id: expedienteId }, select: { codigo: true } });
  await prisma.debidaDiligenciaHistorial.create({
    data: {
      expedienteId,
      tipo: DD_HISTORIAL_TIPOS.INICIO_REVISION,
      area: DD_OBSERVACION_AREAS.LOGISTICA,
      estado: DD_ESTADOS.EN_REVISION,
      titulo: "SIG inició la revisión",
      detalle: motivo.slice(0, 1500),
      actor,
    },
  });
  await prisma.auditLog.create({
    data: {
      tipo: DD_AUDITORIA_TIPO,
      entidad: expediente?.codigo ?? expedienteId,
      actor,
      mensaje: `SIG inició la revisión: ${motivo}`.slice(0, 1000),
      metadata: { accion: "inicio_revision", desde: DD_ESTADOS.DOCUMENTACION_RECIBIDA, hacia: DD_ESTADOS.EN_REVISION },
    },
  });
  return true;
}
