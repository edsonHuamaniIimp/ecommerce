import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, findMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/server/db", () => ({
  prisma: {
    empresa: { findUnique },
    userRole: { findMany },
  },
}));

import { usuariosDeEmpresa } from "../empresa-usuarios";

describe("usuariosDeEmpresa", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findMany.mockReset();
  });

  it("resuelve usuarios por UUID, codigo SIE y RUC", async () => {
    findUnique.mockResolvedValue({ sieCode: "E0000105823", ruc: "10455961441" });
    findMany.mockResolvedValue([
      { userId: "u1", email: "a@empresa.com" },
      { userId: "u1", email: "a@empresa.com" },
      { userId: "u2", email: "b@empresa.com" },
    ]);

    const result = await usuariosDeEmpresa("uuid-empresa");

    expect(findMany).toHaveBeenCalledWith({
      where: { idEmpresa: { in: ["uuid-empresa", "E0000105823", "10455961441"] } },
      select: { userId: true, email: true },
    });
    expect(result).toEqual({
      userIds: ["u1", "u2"],
      emails: ["a@empresa.com", "b@empresa.com"],
    });
  });

  it("usa solo el UUID cuando la empresa no tiene SIE ni RUC", async () => {
    findUnique.mockResolvedValue({ sieCode: null, ruc: null });
    findMany.mockResolvedValue([]);

    const result = await usuariosDeEmpresa("uuid-empresa");

    expect(findMany).toHaveBeenCalledWith({
      where: { idEmpresa: { in: ["uuid-empresa"] } },
      select: { userId: true, email: true },
    });
    expect(result).toEqual({ userIds: [], emails: [] });
  });
});
