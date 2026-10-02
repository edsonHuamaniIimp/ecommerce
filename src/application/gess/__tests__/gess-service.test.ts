import { describe, it, expect, vi } from "vitest";
import { GessApplicationService } from "../gess-service";
import type { IGessRepository, GessPaginatedResult } from "@/domain/ports/gess-repository";
import type { IPlanogessClient } from "@/domain/ports/planogess-client";
import type { IPlanoRepository } from "@/domain/ports/plano-repository";
import type { ITipoStandImagenRepository } from "@/domain/ports/tipo-stand-imagen-repository";
import type { GessStandEntity } from "@/domain/models/entities";

function stand(overrides: Partial<GessStandEntity> = {}): GessStandEntity {
  return {
    id: "g1", eventoId: "ev1", standApiId: "A-01", standCode: "A-01",
    tipoStand: "ESTANDAR_01", medidas: null, estado: "reservado", empresa: null,
    bloqueId: "A-01", email: null, userId: null, rawData: null,
    ...overrides,
  };
}

function pagina(data: GessStandEntity[]): GessPaginatedResult {
  return { data, total: data.length, page: 1, perPage: 10, totalPages: 1 };
}

function mockRepo(): IGessRepository {
  return {
    findAllPaginated: vi.fn(),
    findByBloque: vi.fn(),
    findByStandApiId: vi.fn(),
    findById: vi.fn(),
    findByEvento: vi.fn(),
    datosEmpresaPorStands: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    countByEvento: vi.fn(),
  };
}

const api = {} as IPlanogessClient;
const planoRepo = {} as IPlanoRepository;

/** Catalogo de imagenes por tipo (RF-08) con `listar()` mockeable por prueba. */
function catalogoMock(filas: Array<{ tipo: string; imagenUrl: string }> = []): ITipoStandImagenRepository {
  return { listar: vi.fn().mockResolvedValue(filas), upsert: vi.fn(), eliminar: vi.fn() } as unknown as ITipoStandImagenRepository;
}
const catalogo = catalogoMock();

describe("GessApplicationService.listar (RF-09)", () => {
  it("completa la razon social de los stands reservados desde empresa de la cuenta", async () => {
    const repo = mockRepo();
    vi.mocked(repo.findAllPaginated).mockResolvedValue(pagina([stand()]));
    vi.mocked(repo.datosEmpresaPorStands).mockResolvedValue(
      new Map([["g1", { razonSocial: "Minera Cordillera S.A.C.", logoUrl: null }]]),
    );
    const svc = new GessApplicationService(repo, api, planoRepo, catalogo);

    const r = await svc.listar("ev1", { page: 1, perPage: 10 });

    expect(repo.datosEmpresaPorStands).toHaveBeenCalledWith(["g1"]);
    expect(r.data[0]?.empresa).toBe("Minera Cordillera S.A.C.");
  });

  it("incluye el logo (usuario o empresa) del stand reservado", async () => {
    const repo = mockRepo();
    vi.mocked(repo.findAllPaginated).mockResolvedValue(pagina([stand()]));
    vi.mocked(repo.datosEmpresaPorStands).mockResolvedValue(
      new Map([["g1", { razonSocial: "Gloria S.A.", logoUrl: "/uploads/logo-gloria.png" }]]),
    );
    const svc = new GessApplicationService(repo, api, planoRepo, catalogo);

    const r = await svc.listar("ev1", { page: 1, perPage: 10 });

    expect(r.data[0]?.empresaLogo).toBe("/uploads/logo-gloria.png");
  });

  it("no consulta datos de reserva si todos los stands ya tienen empresa", async () => {
    const repo = mockRepo();
    vi.mocked(repo.findAllPaginated).mockResolvedValue(pagina([stand({ empresa: "Otra S.A.C." })]));
    const svc = new GessApplicationService(repo, api, planoRepo, catalogo);

    const r = await svc.listar("ev1", { page: 1, perPage: 10 });

    expect(repo.datosEmpresaPorStands).not.toHaveBeenCalled();
    expect(r.data[0]?.empresa).toBe("Otra S.A.C.");
  });

  it("mantiene empresa null cuando no hay reserva local asociada", async () => {
    const repo = mockRepo();
    vi.mocked(repo.findAllPaginated).mockResolvedValue(pagina([stand({ estado: "disponible" })]));
    vi.mocked(repo.datosEmpresaPorStands).mockResolvedValue(new Map());
    const svc = new GessApplicationService(repo, api, planoRepo, catalogo);

    const r = await svc.listar("ev1", { page: 1, perPage: 10 });

    expect(r.data[0]?.empresa).toBeNull();
  });

  it("solo consulta por los stands sin empresa", async () => {
    const repo = mockRepo();
    vi.mocked(repo.findAllPaginated).mockResolvedValue(pagina([
      stand({ id: "g1", empresa: "Ya tiene" }),
      stand({ id: "g2" }),
    ]));
    vi.mocked(repo.datosEmpresaPorStands).mockResolvedValue(
      new Map([["g2", { razonSocial: "Nueva S.A.C.", logoUrl: null }]]),
    );
    const svc = new GessApplicationService(repo, api, planoRepo, catalogo);

    const r = await svc.listar("ev1", { page: 1, perPage: 10 });

    expect(repo.datosEmpresaPorStands).toHaveBeenCalledWith(["g2"]);
    expect(r.data[0]?.empresa).toBe("Ya tiene");
    expect(r.data[1]?.empresa).toBe("Nueva S.A.C.");
  });

  it("agrega la imagen referencial del tipo (RF-08) resolviendo alias", async () => {
    const repo = mockRepo();
    vi.mocked(repo.findAllPaginated).mockResolvedValue(pagina([
      stand({ tipoStand: "ISLA" }),
      stand({ id: "g2", tipoStand: "ESTANDAR_02" }),
    ]));
    vi.mocked(repo.datosEmpresaPorStands).mockResolvedValue(new Map());
    const catalog = catalogoMock([
      { tipo: "ISLAS", imagenUrl: "/uploads/isla.png" },
      { tipo: "ESTANDAR_02", imagenUrl: "/uploads/estandar2.png" },
    ]);
    const svc = new GessApplicationService(repo, api, planoRepo, catalog);

    const r = await svc.listar("ev1", { page: 1, perPage: 10 });

    expect(r.data[0]?.tipoImagen).toBe("/uploads/isla.png");
    expect(r.data[1]?.tipoImagen).toBe("/uploads/estandar2.png");
  });

  it("deja tipoImagen null si el tipo no tiene imagen en el catalogo", async () => {
    const repo = mockRepo();
    vi.mocked(repo.findAllPaginated).mockResolvedValue(pagina([stand({ tipoStand: "ALAMEDA" })]));
    vi.mocked(repo.datosEmpresaPorStands).mockResolvedValue(new Map());
    const catalog = catalogoMock([{ tipo: "ISLAS", imagenUrl: "/uploads/isla.png" }]);
    const svc = new GessApplicationService(repo, api, planoRepo, catalog);

    const r = await svc.listar("ev1", { page: 1, perPage: 10 });

    expect(r.data[0]?.tipoImagen).toBeNull();
  });
});
