import { prisma } from "@/lib/server/db";
import { ROLES, ADMIN_USER_ID } from "@/lib/shared/constants";
import type { Rol } from "@/lib/shared/constants";

interface JwtPayload {
  sub: string;
  roles: Rol[];
}

export class AlertasApplicationService {
  private buildConditions(sub: string, roles: Rol[]) {
    const conditions: Record<string, unknown>[] = [{ userId: sub }];
    if (roles.includes(ROLES.ADMIN)) {
      conditions.push({ userId: ADMIN_USER_ID });
    }
    return conditions;
  }

  async listar(session: JwtPayload, soloNoLeidas = false) {
    const conditions = this.buildConditions(session.sub, session.roles);
    const where: Record<string, unknown> = { OR: conditions };
    if (soloNoLeidas) where.leida = false;

    const [alertas, noLeidas] = await Promise.all([
      prisma.alerta.findMany({ where: where as never, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.alerta.count({ where: { ...where, leida: false } as never }),
    ]);

    return { alertas, noLeidas };
  }

  async marcarLeida(session: JwtPayload, id: string) {
    const conditions = this.buildConditions(session.sub, session.roles);
    await prisma.alerta.updateMany({
      where: { id, OR: conditions } as never,
      data: { leida: true },
    });
  }

  async marcarTodasLeidas(session: JwtPayload) {
    const conditions = this.buildConditions(session.sub, session.roles);
    await prisma.alerta.updateMany({
      where: { OR: conditions, leida: false } as never,
      data: { leida: true },
    });
  }
}

export const alertasService = new AlertasApplicationService();
