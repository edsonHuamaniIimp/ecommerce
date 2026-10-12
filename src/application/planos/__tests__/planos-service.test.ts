import { describe, it, expect, vi } from "vitest";
import { PlanoApplicationService } from "../planos-service";
import type { IPlanoRepository } from "@/domain/ports/plano-repository";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

function repoMock(): IPlanoRepository {
  return {
    detalle: vi.fn(),
    detallePorCodigo: vi.fn(),
    bloquesConCodigoFueraDelPlano: vi.fn().mockResolvedValue([]),
    guardarLayout: vi.fn(),
    importar: vi.fn(),
  } as unknown as IPlanoRepository;
}

const layout = {
  tipos: [{ codigo: "T1", label: "T1", nombre: "T1", w: 3, d: 3, h: 3, color: "#000000", ambito: "interno", flgActivo: true }],
  bloques: [{ bloqueId: "E-102", tipoCodigo: "T1", tipologia: "2", x: 0, z: 0, rotY: 0, orden: 0, flgActivo: true }],
  furniture: [],
} as unknown as Parameters<IPlanoRepository["guardarLayout"]>[1];

describe("PlanoApplicationService.guardarLayout (codigo de bloque unico global)", () => {
  it("rechaza codigos ya usados en otro pabellon con mensaje claro", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue({ id: "p1" } as never);
    vi.mocked(repo.bloquesConCodigoFueraDelPlano).mockResolvedValue([
      { bloqueId: "E-102", planoCodigo: "pab-9", planoNombre: "Pabellon 9" },
    ]);
    const svc = new PlanoApplicationService(repo);

    await expect(svc.guardarLayout("p1", layout)).rejects.toThrow(/E-102 \(Pabellon 9\)/);
    expect(repo.guardarLayout).not.toHaveBeenCalled();
  });

  it("guarda cuando no hay conflictos", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue({ id: "p1" } as never);
    vi.mocked(repo.guardarLayout).mockResolvedValue({ id: "p1" } as never);
    const svc = new PlanoApplicationService(repo);

    const r = await svc.guardarLayout("p1", layout);
    expect(r.id).toBe("p1");
    expect(repo.bloquesConCodigoFueraDelPlano).toHaveBeenCalledWith("p1", ["E-102"]);
  });

  it("mapea el conflicto unico de la BD (P2002) a un mensaje claro", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue({ id: "p1" } as never);
    vi.mocked(repo.guardarLayout).mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    const svc = new PlanoApplicationService(repo);

    await expect(svc.guardarLayout("p1", layout)).rejects.toThrow(/duplicado/);
  });
});

describe("PlanoApplicationService.importar (codigo de bloque unico global)", () => {
  it("rechaza la importacion si un codigo ya existe en otro plano", async () => {
    const repo = repoMock();
    vi.mocked(repo.detallePorCodigo).mockResolvedValue({ id: "p1" } as never);
    vi.mocked(repo.bloquesConCodigoFueraDelPlano).mockResolvedValue([
      { bloqueId: "E-102", planoCodigo: "pab-9", planoNombre: "Pabellon 9" },
    ]);
    const svc = new PlanoApplicationService(repo);

    await expect(svc.importar({ codigo: "pab-1", nombre: "Pabellon 1", tipos: layout.tipos, bloques: layout.bloques, furniture: [] } as never))
      .rejects.toThrow(/ya usados en otro pabellon/);
    expect(repo.importar).not.toHaveBeenCalled();
  });
});
