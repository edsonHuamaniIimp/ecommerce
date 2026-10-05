import { describe, it, expect, vi } from "vitest";
import { SolicitudesApplicationService } from "../solicitudes-service";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { SolicitudRow } from "@/domain/models/entities";
import { PERMISSIONS } from "@/lib/shared/constants";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));
vi.mock("@/lib/server/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  enviarEmailPlantilla: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/server/idioma", () => ({
  resolverIdiomaPeticion: vi.fn().mockResolvedValue("es"),
}));

function repoMock(): ISolicitudesRepository {
  return {
    listar: vi.fn(),
    detalle: vi.fn(),
    crearOActualizarRevision: vi.fn(),
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
    crearAlertaRevision: vi.fn(),
    crearAlertaRol: vi.fn(),
    findNombreUsuario: vi.fn().mockResolvedValue(null),
    guardarRecortePlano: vi.fn(),
    guardarPlanCuotas: vi.fn(),
    upsertContratoSistema: vi.fn(),
    guardarReservaIImp: vi.fn(),
    datosReservaIImp: vi.fn(),
  };
}

function svc(repo: ISolicitudesRepository): SolicitudesApplicationService {
  return new SolicitudesApplicationService(repo, {} as never);
}

const ID = "11111111-1111-4111-8111-111111111111";

describe("SolicitudesApplicationService.guardarRecortePlano (RF-08)", () => {
  it("el titular guarda la imagen de su solicitud", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue({ userId: "user-1", flgActivo: true } as unknown as SolicitudRow);
    const service = svc(repo);

    await service.guardarRecortePlano({
      solicitudId: ID,
      url: "/uploads/recorte.png",
      userSub: "user-1",
      userPermissions: [],
    });

    expect(repo.guardarRecortePlano).toHaveBeenCalledWith(ID, "/uploads/recorte.png");
  });

  it("un admin puede guardar en una solicitud ajena", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue({ userId: "otro", flgActivo: true } as unknown as SolicitudRow);
    const service = svc(repo);

    await service.guardarRecortePlano({
      solicitudId: ID,
      url: "/uploads/recorte.png",
      userSub: "admin",
      userPermissions: [PERMISSIONS.ADMIN_FULL],
    });

    expect(repo.guardarRecortePlano).toHaveBeenCalledTimes(1);
  });

  it("rechaza a un usuario ajeno sin permisos", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue({ userId: "otro", flgActivo: true } as unknown as SolicitudRow);
    const service = svc(repo);

    await expect(
      service.guardarRecortePlano({ solicitudId: ID, url: "/uploads/recorte.png", userSub: "intruso", userPermissions: [] }),
    ).rejects.toMatchObject({ status: 403 });
    expect(repo.guardarRecortePlano).not.toHaveBeenCalled();
  });

  it("rechaza una solicitud inexistente", async () => {
    const repo = repoMock();
    vi.mocked(repo.detalle).mockResolvedValue(null);
    const service = svc(repo);

    await expect(
      service.guardarRecortePlano({ solicitudId: ID, url: "/uploads/recorte.png", userSub: "user-1", userPermissions: [] }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
