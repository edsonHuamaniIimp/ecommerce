import { prisma } from "@/lib/server/db";
import { ROLES, ADMIN_USER_ID } from "@/lib/shared/constants";
import type { Rol } from "@/lib/shared/constants";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import { resolverIdiomaDestinatario } from "@/application/idioma/resolver-idioma";
import { localizarAlerta } from "@/lib/shared/alert-templates";

interface JwtPayload {
  sub: string;
  email?: string | null;
  roles: Rol[];
}

/**
 * Campana de notificaciones. El titulo/mensaje de cada alerta se renderiza en el
 * idioma del destinatario (perfil -> cookie -> español) a partir de la plantilla
 * `clave` + `datos`; las filas legacy sin clave usan el texto guardado.
 */
export class AlertasApplicationService {
  constructor(private readonly auth: IAuthRepository) {}

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

    const [alertas, noLeidas, idioma] = await Promise.all([
      prisma.alerta.findMany({ where: where as never, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.alerta.count({ where: { ...where, leida: false } as never }),
      resolverIdiomaDestinatario(this.auth, session.email ?? null),
    ]);

    return {
      alertas: alertas.map((alerta) => ({ ...alerta, ...localizarAlerta(alerta, idioma) })),
      noLeidas,
    };
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
