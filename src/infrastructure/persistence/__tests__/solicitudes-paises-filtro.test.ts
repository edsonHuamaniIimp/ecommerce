import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  empresa: { findMany: vi.fn() },
  userRole: { findMany: vi.fn() },
  solicitud: { count: vi.fn(), findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/server/db", () => ({ prisma: prismaMock }));

import { SolicitudesPrismaRepository } from "../solicitudes-repository";

const EVENTO_ID = "11111111-1111-4111-8111-111111111111";

describe("SolicitudesPrismaRepository - filtro por pais", () => {
  beforeEach(() => {
    prismaMock.empresa.findMany.mockReset();
    prismaMock.userRole.findMany.mockReset();
    prismaMock.solicitud.count.mockReset();
    prismaMock.solicitud.findMany.mockReset();
    prismaMock.$queryRaw.mockReset();

    prismaMock.empresa.findMany.mockResolvedValue([
      { id: "empresa-1", sieCode: "E0001", ruc: "20123456789" },
    ]);
    prismaMock.userRole.findMany.mockResolvedValue([{ userId: "user-1" }]);
    prismaMock.solicitud.count.mockResolvedValue(0);
    prismaMock.solicitud.findMany.mockResolvedValue([]);
  });

  it("mantiene page, perPage y la consulta paginada al filtrar por pais", async () => {
    const repo = new SolicitudesPrismaRepository();

    const result = await repo.listar({
      eventoId: EVENTO_ID,
      page: 3,
      perPage: 10,
      pais: "PE",
    });

    expect(result).toEqual({ data: [], total: 0, page: 3, perPage: 10, totalPages: 0 });
    expect(prismaMock.solicitud.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10, orderBy: { updatedAt: "desc" } }),
    );

    const where = prismaMock.solicitud.count.mock.calls[0]?.[0]?.where as
      | { AND?: Array<Record<string, unknown>> }
      | undefined;
    const filtroPais = where?.AND?.find(
      (filtro) => Array.isArray(filtro.OR) && filtro.OR.some((item) => "userId" in item),
    );
    expect(filtroPais?.OR).toContainEqual({ userId: { in: ["user-1"] } });
    expect(filtroPais?.OR).toContainEqual({
      email: { startsWith: "acceso-20123456789@acceso.iimp" },
    });
  });

  it("no agrega la consulta de paises cuando el filtro esta vacio", async () => {
    const repo = new SolicitudesPrismaRepository();

    await repo.listar({ eventoId: EVENTO_ID, page: 1, perPage: 20 });

    expect(prismaMock.empresa.findMany).not.toHaveBeenCalled();
    expect(prismaMock.userRole.findMany).not.toHaveBeenCalled();
    expect(prismaMock.solicitud.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it("cuenta paises por evento sin usar el listado paginado", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ pais: "PE", solicitudes: 4 }]);
    const repo = new SolicitudesPrismaRepository();

    const result = await repo.paisesConteo({ eventoId: EVENTO_ID });

    expect(result).toEqual([{ pais: "PE", solicitudes: 4 }]);
    expect(prismaMock.solicitud.findMany).not.toHaveBeenCalled();
  });
});
