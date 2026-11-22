import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  alerta: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  userRole: { findFirst: vi.fn() },
}));

vi.mock("@/lib/server/db", () => ({ prisma: prismaMock }));
vi.mock("@/application/idioma/resolver-idioma", () => ({
  resolverIdiomaDestinatario: vi.fn(async () => "es"),
}));

import { AlertasApplicationService } from "../alertas-service";
import { ROLES, ADMIN_USER_ID } from "@/lib/shared/constants";

const auth = {} as never;

describe("AlertasApplicationService - alcance de la campana", () => {
  beforeEach(() => {
    Object.values(prismaMock.alerta).forEach((fn) => fn.mockReset());
    prismaMock.userRole.findFirst.mockReset();
    prismaMock.alerta.findMany.mockResolvedValue([]);
    prismaMock.alerta.count.mockResolvedValue(0);
  });

  it("cliente: ve las propias y las de su empresa, filtradas por evento", async () => {
    prismaMock.userRole.findFirst.mockResolvedValue({ empresaId: "emp-1" });
    await new AlertasApplicationService(auth).listar({ sub: "u1", roles: [ROLES.CLIENTE], eventoId: "ev-1" });
    const where = prismaMock.alerta.findMany.mock.calls[0]![0].where;
    expect(where.AND[0]).toEqual({ OR: [{ userId: "u1" }, { empresaId: "emp-1" }] });
    expect(where.AND[1]).toEqual({ OR: [{ eventoId: "ev-1" }, { eventoId: null }] });
  });

  it("staff no admin: solo las propias, sin consulta de empresa", async () => {
    await new AlertasApplicationService(auth).listar({ sub: "u2", roles: [ROLES.LEGAL], eventoId: "ev-1" });
    expect(prismaMock.userRole.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.alerta.findMany.mock.calls[0]![0].where.AND[0]).toEqual({ OR: [{ userId: "u2" }] });
  });

  it("admin: suma el bucket global; sin evento activo no filtra por evento", async () => {
    await new AlertasApplicationService(auth).listar({ sub: "u3", roles: [ROLES.ADMIN] });
    const where = prismaMock.alerta.findMany.mock.calls[0]![0].where;
    expect(where.AND[0]).toEqual({ OR: [{ userId: "u3" }, { userId: ADMIN_USER_ID }] });
    expect(where.AND).toHaveLength(1);
  });

  it("marcar leidas respeta el mismo alcance", async () => {
    prismaMock.userRole.findFirst.mockResolvedValue({ empresaId: "emp-1" });
    await new AlertasApplicationService(auth).marcarTodasLeidas({ sub: "u1", roles: [ROLES.CLIENTE], eventoId: "ev-1" });
    const arg = prismaMock.alerta.updateMany.mock.calls[0]![0];
    expect(arg.where.leida).toBe(false);
    expect(arg.where.AND).toHaveLength(2);
  });
});
