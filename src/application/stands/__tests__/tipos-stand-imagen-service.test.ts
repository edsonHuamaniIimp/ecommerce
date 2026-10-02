import { describe, it, expect, vi } from "vitest";
import { TiposStandImagenApplicationService } from "../tipos-stand-imagen-service";
import type { ITipoStandImagenRepository } from "@/domain/ports/tipo-stand-imagen-repository";
import { PERMISSIONS, TIPOS_STAND_CATALOGO } from "@/lib/shared/constants";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

function mockRepo(): ITipoStandImagenRepository {
  return { listar: vi.fn().mockResolvedValue([]), upsert: vi.fn(), eliminar: vi.fn() };
}

describe("TiposStandImagenApplicationService", () => {
  describe("listar", () => {
    it("devuelve el catalogo completo con la imagen del tipo", async () => {
      const repo = mockRepo();
      vi.mocked(repo.listar).mockResolvedValue([
        { id: "1", tipo: "ISLAS", imagenUrl: "/uploads/isla.png", createdAt: new Date(), updatedAt: new Date() },
      ]);
      const svc = new TiposStandImagenApplicationService(repo);

      const items = await svc.listar();

      expect(items).toHaveLength(TIPOS_STAND_CATALOGO.length);
      expect(items.find((i) => i.tipo === "ISLAS")?.imagenUrl).toBe("/uploads/isla.png");
      expect(items.find((i) => i.tipo === "ALAMEDA")?.imagenUrl).toBeNull();
    });

    it("resuelve alias guardados (ISLA → ISLAS)", async () => {
      const repo = mockRepo();
      vi.mocked(repo.listar).mockResolvedValue([
        { id: "1", tipo: "ISLA", imagenUrl: "/uploads/isla.png", createdAt: new Date(), updatedAt: new Date() },
      ]);
      const svc = new TiposStandImagenApplicationService(repo);

      const items = await svc.listar();

      expect(items.find((i) => i.tipo === "ISLAS")?.imagenUrl).toBe("/uploads/isla.png");
    });
  });

  describe("guardar", () => {
    it("guarda con la clave canonica del alias", async () => {
      const repo = mockRepo();
      const svc = new TiposStandImagenApplicationService(repo);

      await svc.guardar("ISLA", "/uploads/nueva.png");

      expect(repo.upsert).toHaveBeenCalledWith("ISLAS", "/uploads/nueva.png");
    });

    it("rechaza un tipo fuera del catalogo", async () => {
      const svc = new TiposStandImagenApplicationService(mockRepo());
      await expect(svc.guardar("PREMIUM", "/uploads/x.png")).rejects.toMatchObject({ status: 400 });
    });

    it("rechaza imagen vacia", async () => {
      const svc = new TiposStandImagenApplicationService(mockRepo());
      await expect(svc.guardar("ISLAS", "   ")).rejects.toMatchObject({ status: 400 });
    });
  });

  describe("eliminar", () => {
    it("elimina con la clave canonica", async () => {
      const repo = mockRepo();
      const svc = new TiposStandImagenApplicationService(repo);
      await svc.eliminar("ESTANDAR");
      expect(repo.eliminar).toHaveBeenCalledWith("ESTANDAR_01");
    });
  });

  describe("autorizarGestion", () => {
    it("permite con stands:manage y admin total", () => {
      const svc = new TiposStandImagenApplicationService(mockRepo());
      expect(() => svc.autorizarGestion([PERMISSIONS.STANDS_MANAGE])).not.toThrow();
      expect(() => svc.autorizarGestion([PERMISSIONS.ADMIN_FULL])).not.toThrow();
    });

    it("rechaza sin permisos de stands", () => {
      const svc = new TiposStandImagenApplicationService(mockRepo());
      expect(() => svc.autorizarGestion([PERMISSIONS.PAGOS_VIEW])).toThrow();
    });
  });
});
