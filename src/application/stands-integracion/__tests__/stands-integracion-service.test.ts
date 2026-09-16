import { describe, it, expect, vi } from "vitest";
import { StandsIntegracionApplicationService } from "../stands-integracion-service";
import type { IStandsIntegracionRepository } from "@/domain/ports/stands-integracion-repository";
import { mapearEstadoContrato } from "@/lib/shared/utils/estado-contrato";
import { ESTADOS_SOLICITUD } from "@/lib/shared/constants";

function mockRepo(): IStandsIntegracionRepository {
  return {
    listarStandsExhibidora: vi.fn(),
    listarContratos: vi.fn(),
  };
}

describe("StandsIntegracionApplicationService", () => {
  it("delega listarStandsExhibidora con empresaId y filtros de evento", async () => {
    const repo = mockRepo();
    const svc = new StandsIntegracionApplicationService(repo);
    await svc.listarStandsExhibidora("E001", 14, 1);
    expect(repo.listarStandsExhibidora).toHaveBeenCalledWith("E001", 14, 1);
  });

  it("delega listarStandsExhibidora sin filtros de evento", async () => {
    const repo = mockRepo();
    const svc = new StandsIntegracionApplicationService(repo);
    await svc.listarStandsExhibidora("E001");
    expect(repo.listarStandsExhibidora).toHaveBeenCalledWith("E001", undefined, undefined);
  });

  it("delega listarContratos", async () => {
    const repo = mockRepo();
    const svc = new StandsIntegracionApplicationService(repo);
    await svc.listarContratos(14, 1);
    expect(repo.listarContratos).toHaveBeenCalledWith(14, 1);
  });
});

describe("mapearEstadoContrato", () => {
  it("aprobado → FIRMADO_Y_VIGENTE", () => {
    expect(mapearEstadoContrato(ESTADOS_SOLICITUD.APROBADO)).toBe("FIRMADO_Y_VIGENTE");
  });

  it("pagado → FIRMADO_Y_VIGENTE", () => {
    expect(mapearEstadoContrato(ESTADOS_SOLICITUD.PAGADO)).toBe("FIRMADO_Y_VIGENTE");
  });

  it("rechazado → RESCINDIDO", () => {
    expect(mapearEstadoContrato(ESTADOS_SOLICITUD.RECHAZADO)).toBe("RESCINDIDO");
  });

  it("pendiente_pago → PENDIENTE_FIRMA", () => {
    expect(mapearEstadoContrato(ESTADOS_SOLICITUD.PENDIENTE_PAGO)).toBe("PENDIENTE_FIRMA");
  });

  it("pendiente → EN_REVISION", () => {
    expect(mapearEstadoContrato(ESTADOS_SOLICITUD.PENDIENTE)).toBe("EN_REVISION");
  });

  it("en_proceso → EN_REVISION", () => {
    expect(mapearEstadoContrato(ESTADOS_SOLICITUD.EN_PROCESO)).toBe("EN_REVISION");
  });
});
