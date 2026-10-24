import 'server-only';

import { prisma } from "@/lib/server/db";

/**
 * Usuarios vinculados a una empresa para el modo "Ver como".
 * `user_role.id_empresa` puede guardar el UUID local o el codigo SIE historico.
 */
export async function usuariosDeEmpresa(empresaId: string): Promise<{ userIds: string[]; emails: string[] }> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { sieCode: true, ruc: true },
  });
  const referencias = [...new Set(
    [empresaId, empresa?.sieCode, empresa?.ruc].filter((v): v is string => Boolean(v)),
  )];
  const usuarios = await prisma.userRole.findMany({
    where: { idEmpresa: { in: referencias } },
    select: { userId: true, email: true },
  });
  return {
    userIds: [...new Set(usuarios.map((u) => u.userId).filter(Boolean))],
    emails: [...new Set(usuarios.map((u) => u.email).filter(Boolean))],
  };
}
