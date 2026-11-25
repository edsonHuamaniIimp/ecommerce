import "server-only";

import { prisma } from "@/lib/server/db";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { dateUtils } from "@/lib/shared/utils/date";
import { ALERTA_TIPOS, DD_RUTAS, PERMISSIONS, ROLES } from "@/lib/shared/constants";
import type {
  DdNotificacionAprobada,
  DdNotificacionObservada,
  DdNotificacionRecibida,
  DdNotificacionRechazada,
  IDebidaDiligenciaNotificacionPort,
} from "@/domain/ports/debida-diligencia-notificacion";

/** Adaptador de notificaciones por correo y campana interna del modulo DD. */
export class DebidaDiligenciaNotificacion implements IDebidaDiligenciaNotificacionPort {
  async expedienteRecibido(datos: DdNotificacionRecibida): Promise<void> {
    await enviarEmailPlantilla({
      plantilla: "dd-recibida",
      to: datos.to,
      idioma: null,
      datos: { codigo: datos.codigo, razonSocial: datos.razonSocial, etapa: datos.etapa },
    }).catch(() => undefined);
  }

  async expedienteObservado(datos: DdNotificacionObservada): Promise<void> {
    await enviarEmailPlantilla({
      plantilla: "dd-observada",
      to: datos.to,
      idioma: null,
      datos: {
        codigo: datos.codigo,
        razonSocial: datos.razonSocial,
        observaciones: datos.observaciones,
      },
    }).catch(() => undefined);
  }

  async expedienteAprobado(datos: DdNotificacionAprobada): Promise<void> {
    await enviarEmailPlantilla({
      plantilla: "dd-aprobada",
      to: datos.to,
      idioma: null,
      datos: {
        codigo: datos.codigo,
        razonSocial: datos.razonSocial,
        fechaVencimiento: datos.fechaVencimiento
          ? dateUtils.format(datos.fechaVencimiento)
          : "",
      },
    }).catch(() => undefined);
  }

  async expedienteRechazado(datos: DdNotificacionRechazada): Promise<void> {
    await enviarEmailPlantilla({
      plantilla: "dd-rechazada",
      to: datos.to,
      idioma: null,
      datos: {
        codigo: datos.codigo,
        razonSocial: datos.razonSocial,
        motivo: datos.motivo ?? "",
      },
    }).catch(() => undefined);
  }

  async notificarLegal(datos: {
    codigo: string;
    razonSocial: string;
    motivo: string | null;
    reenvio?: boolean;
  }): Promise<void> {
    try {
      const candidatos = await prisma.userRole.findMany({
        where: {
          flgActivo: true,
          role: {
            OR: [
              { nombre: ROLES.LEGAL },
              { permisos: { has: PERMISSIONS.DD_LEGAL } },
              { permisos: { has: PERMISSIONS.ADMIN_FULL } },
            ],
          },
        },
        select: { userId: true, email: true },
      });
      const usuarios = [...new Map(candidatos.map((usuario) => [usuario.userId, usuario])).values()];
      if (usuarios.length === 0) return;
      await prisma.alerta.createMany({
        data: usuarios.map((usuario) => ({
          userId: usuario.userId,
          tipo: ALERTA_TIPOS.DD_LEGAL,
          titulo: datos.reenvio
            ? "Debida diligencia subsanada: revisión legal pendiente"
            : "Debida diligencia derivada a Legal",
          mensaje: datos.reenvio
            ? `${datos.razonSocial} (${datos.codigo}) subsanó la observación de Legal y requiere una nueva revisión.`
            : `${datos.razonSocial} (${datos.codigo}) requiere revisión legal.${datos.motivo ? ` Motivo: ${datos.motivo}` : ""}`,
          url: DD_RUTAS.LEGAL,
        })),
      });
      await Promise.all(
        usuarios.map((usuario) =>
          enviarEmailPlantilla({
            plantilla: "dd-legal-revision",
            to: usuario.email,
            idioma: null,
            datos: {
              codigo: datos.codigo,
              razonSocial: datos.razonSocial,
              motivo: datos.motivo ?? "",
            },
          }).catch(() => undefined),
        ),
      );
    } catch {
      /* La notificacion no debe bloquear la derivacion. */
    }
  }

  async notificarLogistica(email: string, mensaje: string, url: string): Promise<void> {
    try {
      const cuenta = await prisma.userRole.findFirst({
        where: { email },
        select: { userId: true },
      });
      if (!cuenta) return;
      await prisma.alerta.create({
        data: {
          userId: cuenta.userId,
          tipo: ALERTA_TIPOS.DD_REPUTACION,
          titulo: "Revisión reputacional completada",
          mensaje,
          url,
        },
      });
    } catch {
      /* La notificacion no debe bloquear la resolucion del caso. */
    }
  }

  async notificarReenvioLogistica(datos: {
    codigo: string;
    razonSocial: string;
    observacionesRespondidas: number;
  }): Promise<void> {
    try {
      const usuarios = await prisma.userRole.findMany({
        where: {
          flgActivo: true,
          role: {
            OR: [
              { permisos: { has: PERMISSIONS.DD_MATRIZ } },
              { permisos: { has: PERMISSIONS.ADMIN_FULL } },
            ],
          },
        },
        select: { userId: true, email: true },
      });
      const destinatarios = [...new Map(usuarios.map((usuario) => [usuario.userId, usuario])).values()];
      if (destinatarios.length === 0) return;

      const mensaje = `${datos.razonSocial} (${datos.codigo}) reenvió ${datos.observacionesRespondidas} observación(es) y está lista para revisar en la matriz.`;
      await prisma.alerta.createMany({
        data: destinatarios.map((usuario) => ({
          userId: usuario.userId,
          tipo: ALERTA_TIPOS.DD_REENVIO,
          titulo: "Debida diligencia subsanada",
          mensaje,
          url: DD_RUTAS.MATRIZ,
        })),
      });
      await Promise.all(
        destinatarios.map((usuario) =>
          enviarEmailPlantilla({
            plantilla: "dd-subsanada",
            to: usuario.email,
            idioma: null,
            datos: {
              codigo: datos.codigo,
              razonSocial: datos.razonSocial,
              observacionesRespondidas: datos.observacionesRespondidas,
            },
          }).catch(() => undefined),
        ),
      );
    } catch {
      /* La notificacion no debe bloquear el reenvio del cliente. */
    }
  }
}
