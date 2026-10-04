import { describe, it, expect, vi } from "vitest";
import { TiposStandImagenApplicationService } from "../tipos-stand-imagen-service";
import type { ITipoStandImagenRepository } from "@/domain/ports/tipo-stand-imagen-repository";
import type { TipoStandImagenEntity } from "@/domain/models/tipo-stand-imagen";
import { PERMISSIONS, TIPOS_STAND_CATALOGO } from "@/lib/shared/constants";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

function fila(tipo: string, imagenUrl: string, eventoId: string | null = null): TipoStandImagenEntity {
  return { id: `${eventoId ?? "global"}-${tipo}`, tipo, eventoId, imagenUrl, createdAt: new Date(), updatedAt: new Date() };
}

function mockRepo(): ITipoStandImagenRepository {
  return { listar: vi.fn().mockResolvedValue([]), upsert: vi.fn(), eliminar: vi.fn() };
}

describe("TiposStandImagenApplicationService (por evento con respaldo global)", () => {
  describe("listar", () => {
    it("devuelve el catalogo completo con la imagen global de respaldo", async () => {
      const repo = mockRepo();
      vi.mocked(repo.listar).mockResolvedValue([fila("ISLAS", "/uploads/isla.png")]);
      const svc = new TiposStandImagenApplicationService(repo);

      const items = await svc.listar("ev-1");

      expect(items).toHaveLength(TIPOS_STAND_CATALOGO.length);
      expect(items.find((i) => i.tipo === "ISLAS")?.imagenUrl).toBe("/uploads/isla.png");
      expect(items.find((i) => i.tipo === "ALAMEDA")?.imagenUrl).toBeNull();
    });

    it("la imagen del evento pisa la global", async () => {
      const repo = mockRepo();
      vi.mocked(repo.listar).mockResolvedValue([
        fila("ISLAS", "/uploads/isla-global.png"),
        fila("ISLAS", "/uploads/isla-evento.png", "ev-1"),
      ]);
      const svc = new TiposStandImagenApplicationService(repo);

      const items = await svc.listar("ev-1");

      expect(items.find((i) => i.tipo === "ISLAS")?.imagenUrl).toBe("/uploads/isla-evento.png");
    });

    it("ignora imagenes de otros eventos", async () => {
      const repo = mockRepo();
      vi.mocked(repo.listar).mockResolvedValue([fila("ISLAS", "/uploads/isla-otro.png", "ev-2")]);
      const svc = new TiposStandImagenApplicationService(repo);

      const items = await svc.listar("ev-1");

      expect(items.find((i) => i.tipo === "ISLAS")?.imagenUrl).toBeNull();
    });

    it("resuelve alias guardados (ISLA → ISLAS)", async () => {
      const repo = mockRepo();
      vi.mocked(repo.listar).mockResolvedValue([fila("ISLA", "/uploads/isla.png", "ev-1")]);
      const svc = new TiposStandImagenApplicationService(repo);

      const items = await svc.listar("ev-1");

      expect(items.find((i) => i.tipo === "ISLAS")?.imagenUrl).toBe("/uploads/isla.png");
    });
  });

  describe("guardar", () => {
    it("guarda con la clave canonica y el evento", async () => {
      const repo = mockRepo();
      const svc = new TiposStandImagenApplicationService(repo);

      await svc.guardar("ISLA", "/uploads/nueva.png", "ev-1");

      expect(repo.upsert).toHaveBeenCalledWith("ISLAS", "/uploads/nueva.png", "ev-1");
    });

    it("rechaza un tipo fuera del catalogo", async () => {
      const svc = new TiposStandImagenApplicationService(mockRepo());
      await expect(svc.guardar("PREMIUM", "/uploads/x.png", null)).rejects.toMatchObject({ status: 400 });
    });

    it("rechaza imagen vacia", async () => {
      const svc = new TiposStandImagenApplicationService(mockRepo());
      await expect(svc.guardar("ISLAS", "   ", "ev-1")).rejects.toMatchObject({ status: 400 });
    });
  });

  describe("eliminar", () => {
    it("elimina con la clave canonica y el evento", async () => {
      const repo = mockRepo();
      const svc = new TiposStandImagenApplicationService(repo);
      await svc.eliminar("ESTANDAR", "ev-1");
      expect(repo.eliminar).toHaveBeenCalledWith("ESTANDAR_01", "ev-1");
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
