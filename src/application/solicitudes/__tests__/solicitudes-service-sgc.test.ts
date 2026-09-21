import { describe, it, expect, vi } from "vitest";
import { SolicitudesApplicationService } from "../solicitudes-service";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { ISgcRepository } from "@/domain/ports/sgc-repository";
import type { ISgcClient } from "@/domain/ports/sgc-client";
import { SgcIntegracionApplicationService } from "@/application/sgc-integracion/sgc-integracion-service";
import type { RevisionEntity } from "@/domain/models/entities";
import { REVISION_AREAS, RESULTADOS_APROBACION } from "@/lib/shared/constants";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {},
}));

function revision(area: string, estado: string): RevisionEntity {
  return {
    id: "r1",
    solicitudId: "sol-1",
    area,
    estado,
    comentario: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date("2026-09-15T00:00:00.000Z"),
    updatedAt: new Date("2026-09-15T00:00:00.000Z"),
    fuePrimeraRevision: true,
  };
}

function repoMock(area: string, estado: string): ISolicitudesRepository {
  return {
    listar: vi.fn(),
    detalle: vi.fn().mockResolvedValue(null),
    crearOActualizarRevision: vi.fn().mockResolvedValue(revision(area, estado)),
    crearRevisionInicial: vi.fn(),
    crearSolicitud: vi.fn(),
    crearAlertaReserva: vi.fn(),
    crearReevaluacion: vi.fn(),
    tieneReevaluacionPendiente: vi.fn(),
    atenderReevaluacionAprobacion: vi.fn(),
    atenderReevaluacionRechazo: vi.fn(),
    darDeBajaSolicitud: vi.fn(),
    marcarOrdenPago: vi.fn(),
    obtenerHistorial: vi.fn(),
    crearDocumentoAdjunto: vi.fn(),
    findDocumento: vi.fn(),
    eliminarDocumento: vi.fn(),
    crearAlertaRevision: vi.fn().mockResolvedValue(undefined),
  };
}

function sgcRepoVacio(): ISgcRepository {
  return {
    findExpedientePorSolicitud: vi.fn(),
    findExpedientePorContractId: vi.fn(),
    listarConContractId: vi.fn(),
    listarConEstadoEnvio: vi.fn().mockResolvedValue([]),
    crearExpediente: vi.fn(),
    actualizarExpediente: vi.fn(),
    crearDocumento: vi.fn(),
    actualizarDocumento: vi.fn(),
  };
}

function sgcClientVacio(): ISgcClient {
  return {
    crearExpediente: vi.fn(),
    actualizarExpediente: vi.fn(),
    consultarExpediente: vi.fn(),
    listarExpedientes: vi.fn(),
    reservarSubida: vi.fn(),
    transferirArchivo: vi.fn(),
    confirmarSubida: vi.fn(),
    consultarDocumento: vi.fn(),
    resolverVersion: vi.fn(),
    obtenerUrlDescarga: vi.fn(),
  };
}

function sgcMock(): SgcIntegracionApplicationService {
  const svc = new SgcIntegracionApplicationService(
    repoMock(REVISION_AREAS.LEGAL, RESULTADOS_APROBACION.APROBADO),
    sgcRepoVacio(),
    sgcClientVacio(),
    { leer: vi.fn() },
    { enabled: false, areaCode: "", contractTypeCode: "" },
  );
  vi.spyOn(svc, "crearExpedienteDesdeSolicitud").mockResolvedValue(null);
  return svc;
}

describe("SolicitudesApplicationService + SGC", () => {
  it("deberia delegar al SGC al aprobar Comunicacion (ultima area local)", async () => {
    const sgc = sgcMock();
    const svc = new SolicitudesApplicationService(repoMock(REVISION_AREAS.COMUNICACION, RESULTADOS_APROBACION.APROBADO), sgc);

    await svc.revisar({
      solicitudId: "sol-1",
      area: REVISION_AREAS.COMUNICACION,
      estado: RESULTADOS_APROBACION.APROBADO,
      reviewerEmail: "comunicacion@iimp.org.pe",
    });

    expect(sgc.crearExpedienteDesdeSolicitud).toHaveBeenCalledWith("sol-1");
  });

  it("deberia no disparar si el area no es Comunicacion", async () => {
    const sgc = sgcMock();
    const svc = new SolicitudesApplicationService(repoMock(REVISION_AREAS.LOGISTICA, RESULTADOS_APROBACION.APROBADO), sgc);

    await svc.revisar({
      solicitudId: "sol-1",
      area: REVISION_AREAS.LOGISTICA,
      estado: RESULTADOS_APROBACION.APROBADO,
      reviewerEmail: "logistica@iimp.org.pe",
    });

    expect(sgc.crearExpedienteDesdeSolicitud).not.toHaveBeenCalled();
  });

  it("deberia no disparar en la revision Legal (delegada al SGC)", async () => {
    const sgc = sgcMock();
    const svc = new SolicitudesApplicationService(repoMock(REVISION_AREAS.LEGAL, RESULTADOS_APROBACION.APROBADO), sgc);

    await svc.revisar({
      solicitudId: "sol-1",
      area: REVISION_AREAS.LEGAL,
      estado: RESULTADOS_APROBACION.APROBADO,
      reviewerEmail: "legal@iimp.org.pe",
    });

    expect(sgc.crearExpedienteDesdeSolicitud).not.toHaveBeenCalled();
  });
});
