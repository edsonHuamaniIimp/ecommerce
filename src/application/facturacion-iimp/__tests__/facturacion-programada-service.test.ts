import { describe, expect, it, vi } from "vitest";
import { ESTADOS_FACTURACION_PROGRAMADA, TIPOS_SOLICITUD } from "@/lib/shared/constants";
import { FacturacionProgramadaApplicationService } from "../facturacion-programada-service";
import type { IFacturacionRepository } from "@/domain/ports/facturacion-repository";
import type {
  FacturacionProgramadaEntity,
  IFacturacionProgramadaRepository,
} from "@/domain/ports/facturacion-programada-repository";
import type { SolicitarFacturaApplicationService } from "../solicitar-factura-service";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

const REQUISITOS = { oc: true, hes: false, ninguna: false };
const futuro = () => new Date(Date.now() + 3_600_000).toISOString();

function tarea(parcial: Partial<FacturacionProgramadaEntity> = {}): FacturacionProgramadaEntity {
  return {
    id: "t1",
    solicitudId: "s1",
    cuotaId: "c1",
    fechaProgramada: new Date().toISOString(),
    requisitos: REQUISITOS,
    archivos: [],
    estado: ESTADOS_FACTURACION_PROGRAMADA.PENDIENTE,
    ultimoError: null,
    createdBy: null,
    ...parcial,
  };
}

function armar(opts: { tipo?: string | null; contrato?: string | null; vencidas?: FacturacionProgramadaEntity[]; falla?: boolean } = {}) {
  const repo = {
    programar: vi.fn(async (d) => tarea({ solicitudId: d.solicitudId, cuotaId: d.cuotaId })),
    vigentesPorSolicitudes: vi.fn(async () => []),
    cancelar: vi.fn(async () => 1),
    listarVencidas: vi.fn(async () => opts.vencidas ?? []),
    tomar: vi.fn(async () => true),
    marcarEjecutada: vi.fn(async () => undefined),
    marcarError: vi.fn(async () => undefined),
  } as unknown as IFacturacionProgramadaRepository;
  const facturacion = {
    facturacionDeCuota: vi.fn(async () => ({
      id: "f1",
      solicitudId: "s1",
      tipoSolicitud: opts.tipo === undefined ? TIPOS_SOLICITUD.RESERVA_EMPRESA : opts.tipo,
      iimpContrato: opts.contrato ?? null,
    })),
  } as unknown as IFacturacionRepository;
  const solicitar = {
    normalizarRequisitos: vi.fn((r) => r),
    solicitarComoStaff: vi.fn(async () => {
      if (opts.falla) throw new Error("SIE caido");
      return {};
    }),
  } as unknown as SolicitarFacturaApplicationService;
  return { repo, facturacion, solicitar, service: new FacturacionProgramadaApplicationService(repo, facturacion, solicitar) };
}

describe("FacturacionProgramadaApplicationService", () => {
  it("programa una solicitud interna con fecha futura", async () => {
    const { service, repo } = armar();
    await service.programar("c1", futuro(), [], REQUISITOS, "staff@iimp.org.pe");
    expect(repo.programar).toHaveBeenCalledOnce();
  });

  it("rechaza fechas pasadas", async () => {
    const { service } = armar();
    await expect(service.programar("c1", new Date(Date.now() - 1000).toISOString(), [], REQUISITOS, null)).rejects.toThrow(/posteriores/);
  });

  it("rechaza solicitudes que no son internas", async () => {
    const { service } = armar({ tipo: null });
    await expect(service.programar("c1", futuro(), [], REQUISITOS, null)).rejects.toThrow(/internas/);
  });

  it("rechaza si la solicitud de factura ya fue registrada", async () => {
    const { service } = armar({ contrato: "1234567890" });
    await expect(service.programar("c1", futuro(), [], REQUISITOS, null)).rejects.toThrow(/ya fue registrada/);
  });

  it("el cron ejecuta las vencidas y las marca ejecutadas", async () => {
    const { service, repo, solicitar } = armar({ vencidas: [tarea()] });
    const r = await service.ejecutarVencidas();
    expect(solicitar.solicitarComoStaff).toHaveBeenCalledWith("c1", [], REQUISITOS);
    expect(repo.marcarEjecutada).toHaveBeenCalledWith("t1");
    expect(r).toEqual({ procesadas: 1, ejecutadas: 1, errores: 0 });
  });

  it("el cron marca error con el motivo cuando falla el SIE", async () => {
    const { service, repo } = armar({ vencidas: [tarea()], falla: true });
    const r = await service.ejecutarVencidas();
    expect(repo.marcarError).toHaveBeenCalledWith("t1", "SIE caido");
    expect(r.errores).toBe(1);
  });

  it("el cron cancela la tarea si Facturacion ya registro la solicitud a mano", async () => {
    const { service, repo, solicitar } = armar({ vencidas: [tarea()], contrato: "1234567890" });
    await service.ejecutarVencidas();
    expect(repo.cancelar).toHaveBeenCalledWith("s1");
    expect(solicitar.solicitarComoStaff).not.toHaveBeenCalled();
  });
});
