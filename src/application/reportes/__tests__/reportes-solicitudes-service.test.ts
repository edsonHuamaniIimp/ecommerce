import { describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/shared/constants";
import { ReportesSolicitudesApplicationService } from "../reportes-solicitudes-service";
import type { IReportesSolicitudesRepository } from "@/domain/ports/reportes-solicitudes-repository";

function repoFake(): IReportesSolicitudesRepository {
  return {
    resumenPorPais: vi.fn().mockResolvedValue([{ pais: "PE", empresas: 2, solicitudes: 3 }]),
  };
}

describe("ReportesSolicitudesApplicationService", () => {
  it("exige permiso de reportes", async () => {
    const service = new ReportesSolicitudesApplicationService(repoFake());
    await expect(service.resumenPorPais({}, [])).rejects.toMatchObject({ status: 403 });
  });

  it("permite admin:full y reportes:view", async () => {
    const repo = repoFake();
    const service = new ReportesSolicitudesApplicationService(repo);
    await expect(service.resumenPorPais({}, [PERMISSIONS.REPORTES_VIEW])).resolves.toEqual([
      { pais: "PE", empresas: 2, solicitudes: 3 },
    ]);
    await expect(service.resumenPorPais({}, [PERMISSIONS.ADMIN_FULL])).resolves.toEqual([
      { pais: "PE", empresas: 2, solicitudes: 3 },
    ]);
  });
});
