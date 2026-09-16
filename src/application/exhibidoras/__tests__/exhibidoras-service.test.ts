import { describe, it, expect, vi } from "vitest";
import { ExhibidorasApplicationService } from "../exhibidoras-service";
import type { IExhibidorasRepository } from "@/domain/ports/exhibidoras-repository";
import type { ExhibidoraDTO } from "@/types/dto/exhibidoras/exhibidoras.dto";

function mockRepo(): IExhibidorasRepository {
  return { listar: vi.fn() };
}

describe("ExhibidorasApplicationService", () => {
  it("debe retornar lista vacia cuando no hay exhibidoras", async () => {
    const repo = mockRepo();
    vi.mocked(repo.listar).mockResolvedValue([]);
    const svc = new ExhibidorasApplicationService(repo);
    expect(await svc.listar()).toHaveLength(0);
  });

  it("debe delegar al repositorio sin filtro", async () => {
    const repo = mockRepo();
    const svc = new ExhibidorasApplicationService(repo);
    await svc.listar();
    expect(repo.listar).toHaveBeenCalledWith(undefined);
  });

  it("debe delegar al repositorio con filtro de busqueda", async () => {
    const repo = mockRepo();
    const svc = new ExhibidorasApplicationService(repo);
    await svc.listar("MINERA");
    expect(repo.listar).toHaveBeenCalledWith("MINERA");
  });

  it("debe retornar las exhibidoras ordenadas", async () => {
    const repo = mockRepo();
    const data: ExhibidoraDTO[] = [
      { id_empresa: "E001", razon_social: "ALS PERU S.A." },
      { id_empresa: "E002", razon_social: "IIMP" },
    ];
    vi.mocked(repo.listar).mockResolvedValue(data);
    const svc = new ExhibidorasApplicationService(repo);
    const result = await svc.listar();
    expect(result).toHaveLength(2);
    expect(result[0].id_empresa).toBe("E001");
    expect(result[1].razon_social).toBe("IIMP");
  });
});
