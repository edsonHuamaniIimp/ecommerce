import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import { DD_EVENTO_TODOS, PERMISSIONS } from "@/lib/shared/constants";

function crearServicio() {
  const repo = {
    listarBandeja: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      perPage: 20,
      totalPages: 0,
      resumen: {
        total: 0,
        pendientes: 0,
        enRevision: 0,
        observadas: 0,
        aprobadas: 0,
        vencidas: 0,
        rechazadas: 0,
      },
    }),
  } as unknown as IDebidaDiligenciaRepository;
  const servicio = new DebidaDiligenciaApplicationService(
    repo,
    {} as IAuthRepository,
    {} as IDebidaDiligenciaNotificacionPort,
    {} as IDebidaDiligenciaDocumentoValidator,
  );
  return { servicio, repo };
}

const session = {
  email: "logistica@iimp.org.pe",
  roles: [],
  permissions: [PERMISSIONS.DD_REVISION],
  eventoId: "evento-sesion",
};

describe("filtro de evento en bandeja", () => {
  it("envia undefined al repositorio para Todos los eventos", async () => {
    const { servicio, repo } = crearServicio();
    await servicio.bandeja(
      { eventoId: DD_EVENTO_TODOS, page: 1, perPage: 20 },
      session,
    );

    expect(repo.listarBandeja).toHaveBeenCalledWith(
      expect.objectContaining({ eventoId: undefined }),
    );
  });

  it("respeta un evento concreto", async () => {
    const { servicio, repo } = crearServicio();
    await servicio.bandeja(
      { eventoId: "evento-2", page: 1, perPage: 20 },
      session,
    );

    expect(repo.listarBandeja).toHaveBeenCalledWith(
      expect.objectContaining({ eventoId: "evento-2" }),
    );
  });

  it("usa el evento de sesion cuando no se envia filtro", async () => {
    const { servicio, repo } = crearServicio();
    await servicio.bandeja({ page: 1, perPage: 20 }, session);

    expect(repo.listarBandeja).toHaveBeenCalledWith(
      expect.objectContaining({ eventoId: "evento-sesion" }),
    );
  });
});
