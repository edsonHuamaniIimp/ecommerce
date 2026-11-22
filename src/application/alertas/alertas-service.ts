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
  /** Evento activo de la sesion: la campana solo muestra alertas de ese evento. */
  eventoId?: string | null;
}

/**
 * Campana de notificaciones. El titulo/mensaje de cada alerta se renderiza en el
 * idioma del destinatario (perfil -> cookie -> español) a partir de la plantilla
 * `clave` + `datos`; las filas legacy sin clave usan el texto guardado.
 */
export class AlertasApplicationService {
  constructor(private readonly auth: IAuthRepository) {}

  /** Alertas propias, las de la empresa del usuario (cuentas cliente) y, para admin, las globales. */
  private async buildWhere(session: JwtPayload, extra: Record<string, unknown> = {}) {
    const conditions: Record<string, unknown>[] = [{ userId: session.sub }];
    if (session.roles.includes(ROLES.ADMIN)) {
      conditions.push({ userId: ADMIN_USER_ID });
    }
    if (session.roles.includes(ROLES.CLIENTE)) {
      const cuenta = await prisma.userRole.findFirst({
        where: { userId: session.sub, empresaId: { not: null } },
        select: { empresaId: true },
      });
      if (cuenta?.empresaId) conditions.push({ empresaId: cuenta.empresaId });
    }
    const where: Record<string, unknown>[] = [{ OR: conditions }];
    /* Alertas sin evento (legacy o de sistema) se siguen mostrando en cualquier evento. */
    if (session.eventoId) where.push({ OR: [{ eventoId: session.eventoId }, { eventoId: null }] });
    return { AND: where, ...extra };
  }

  async listar(session: JwtPayload, soloNoLeidas = false) {
    const where = await this.buildWhere(session, soloNoLeidas ? { leida: false } : {});

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
    await prisma.alerta.updateMany({
      where: (await this.buildWhere(session, { id })) as never,
      data: { leida: true },
    });
  }

  async marcarTodasLeidas(session: JwtPayload) {
    await prisma.alerta.updateMany({
      where: (await this.buildWhere(session, { leida: false })) as never,
      data: { leida: true },
    });
  }
}
