import { prisma } from "@/lib/server/db";
import { ESTADOS_SOLICITUD_CUENTA } from "@/lib/shared/constants";
import type { SolicitudCuentaEntity } from "@/domain/models/entities";
import type {
  CrearSolicitudCuentaData,
  ISolicitudCuentaRepository,
  NuevoUsuarioCuentaData,
} from "@/domain/ports/solicitud-cuenta-repository";

export class SolicitudCuentaPrismaRepository implements ISolicitudCuentaRepository {
  async existePendientePorEmail(email: string): Promise<boolean> {
    const total = await prisma.solicitudCuenta.count({
      where: { email, estado: ESTADOS_SOLICITUD_CUENTA.PENDIENTE },
    });
    return total > 0;
  }

  async existeUsuarioPorEmail(email: string): Promise<boolean> {
    const total = await prisma.userRole.count({ where: { email } });
    return total > 0;
  }

  async crear(data: CrearSolicitudCuentaData): Promise<SolicitudCuentaEntity> {
    return prisma.solicitudCuenta.create({
      data: {
        email: data.email,
        nombre: data.nombre,
        apellidos: data.apellidos,
        telefono: data.telefono ?? null,
        razonSocial: data.razonSocial,
        ruc: data.ruc ?? null,
        cargo: data.cargo ?? null,
        mensaje: data.mensaje ?? null,
        estado: ESTADOS_SOLICITUD_CUENTA.PENDIENTE,
      },
    });
  }

  async listar(estado?: string): Promise<SolicitudCuentaEntity[]> {
    return prisma.solicitudCuenta.findMany({
      where: estado ? { estado } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string): Promise<SolicitudCuentaEntity | null> {
    return prisma.solicitudCuenta.findUnique({ where: { id } });
  }

  async aprobar(
    id: string,
    data: { revisadoPor: string; usuario: NuevoUsuarioCuentaData },
  ): Promise<SolicitudCuentaEntity> {
    const u = data.usuario;
    return prisma.$transaction(async (tx) => {
      await tx.userRole.create({
        data: {
          userId: u.userId,
          roleId: u.roleId,
          email: u.email,
          password: u.password,
          nombre: u.nombre,
          apellidos: u.apellidos,
          telefono: u.telefono,
          nombreEmpresa: u.nombreEmpresa,
          resetToken: u.resetToken,
          resetTokenExpires: u.resetTokenExpires,
        },
      });
      return tx.solicitudCuenta.update({
        where: { id },
        data: {
          estado: ESTADOS_SOLICITUD_CUENTA.APROBADA,
          motivoRechazo: null,
          revisadoPor: data.revisadoPor,
          revisadoEn: new Date(),
          usuarioId: u.userId,
        },
      });
    });
  }

  async rechazar(
    id: string,
    data: { revisadoPor: string; motivoRechazo: string },
  ): Promise<SolicitudCuentaEntity> {
    return prisma.solicitudCuenta.update({
      where: { id },
      data: {
        estado: ESTADOS_SOLICITUD_CUENTA.RECHAZADA,
        motivoRechazo: data.motivoRechazo,
        revisadoPor: data.revisadoPor,
        revisadoEn: new Date(),
      },
    });
  }
}
