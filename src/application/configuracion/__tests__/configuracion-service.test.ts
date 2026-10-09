import { describe, expect, it, vi } from "vitest";
import { ConfiguracionApplicationService } from "../configuracion-service";
import { PERMISSIONS } from "@/lib/shared/constants";
import type { IConfiguracionRepository } from "@/domain/ports/configuracion-repository";
import type { PortalConfigEntity } from "@/domain/models/configuracion";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

/** Repositorio falso con la config guardada capturada. */
function fakeRepo(existente: PortalConfigEntity | null = null) {
  const guardados: unknown[] = [];
  const repo = {
    obtenerPortal: vi.fn(async () => existente),
    guardarPortal: vi.fn(async (data: unknown) => {
      guardados.push(data);
      return { ...(data as object), updatedAt: new Date() } as PortalConfigEntity;
    }),
  } as unknown as IConfiguracionRepository;
  return { repo, guardados };
}

describe("ConfiguracionApplicationService", () => {
  it("autorizarGestion permite admin:full y portal:manage; rechaza al resto", () => {
    const service = new ConfiguracionApplicationService(fakeRepo().repo);
    expect(() => service.autorizarGestion([PERMISSIONS.ADMIN_FULL])).not.toThrow();
    expect(() => service.autorizarGestion([PERMISSIONS.PORTAL_MANAGE])).not.toThrow();
    expect(() => service.autorizarGestion([PERMISSIONS.EMPRESAS_MANAGE])).toThrowError(/Sin permiso/);
  });

  it("obtenerPortal devuelve config vacia si nunca se guardo", async () => {
    const service = new ConfiguracionApplicationService(fakeRepo().repo);
    const config = await service.obtenerPortal();
    expect(config).toMatchObject({ mesaAyudaEmail: null, contactoEmail: null, manualUrl: null, reglamentoUrl: null });
  });

  it("actualizarPortal normaliza vacios a null y guarda quien edito", async () => {
    const { repo, guardados } = fakeRepo();
    const service = new ConfiguracionApplicationService(repo);

    await service.actualizarPortal(
      { mesaAyudaEmail: "  soporte@iimp.org.pe ", contactoEmail: " c@iimp.org.pe ", manualUrl: "", reglamentoUrl: null },
      "admin@iimp.org.pe",
    );

    expect(guardados[0]).toEqual({
      mesaAyudaEmail: "soporte@iimp.org.pe",
      contactoEmail: "c@iimp.org.pe",
      manualUrl: null,
      reglamentoUrl: null,
      updatedBy: "admin@iimp.org.pe",
    });
  });

  it("rechaza correos invalidos y URLs sin http(s)", async () => {
    const service = new ConfiguracionApplicationService(fakeRepo().repo);
    await expect(service.actualizarPortal({ mesaAyudaEmail: "no-es-correo" }, null)).rejects.toMatchObject({ status: 400 });
    await expect(service.actualizarPortal({ manualUrl: "ftp://archivos" }, null)).rejects.toMatchObject({ status: 400 });
  });
});
