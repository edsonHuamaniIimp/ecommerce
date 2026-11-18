import { describe, expect, it, vi } from "vitest";
import { SolicitudesApplicationService } from "../solicitudes-service";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IEventoRepository } from "@/domain/ports/evento-repository";
import { ESTADOS_SOLICITUD, SGC_LIFECYCLE_STATUSES } from "@/lib/shared/constants";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "sol-1",
    eventoId: "ev-1",
    userId: "user-1",
    precio: 2000,
    moneda: "USD",
    tipoCambio: 1,
    estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE,
    flgActivo: true,
    tieneFacturacion: false,
    facturacionId: null,
    iimpContrato: null,
    sgcLifecycleStatus: null,
    planCuotas: {
      modalidad: "cuotas",
      cuotas: [
        { numero: 1, porcentaje: 50, monto: 1180, fechaVencimiento: "2026-11-15" },
        { numero: 2, porcentaje: 50, monto: 1180, fechaVencimiento: "2027-06-15" },
      ],
    },
    ...overrides,
  } as never;
}

function build(overrides: Record<string, unknown> = {}) {
  const detalle = vi.fn(async () => row(overrides));
  const cambiarMonedaSolicitud = vi.fn(async () => undefined);
  const repo = { detalle, cambiarMonedaSolicitud } as unknown as ISolicitudesRepository;
  const eventoRepo = {
    findById: vi.fn(async () => ({ tipoCambio: 3.5 })),
  } as unknown as IEventoRepository;
  const svc = new SolicitudesApplicationService(repo, undefined, undefined, eventoRepo);
  return { svc, detalle, cambiarMonedaSolicitud, eventoRepo };
}

describe("SolicitudesApplicationService.cambiarMoneda", () => {
  it("convierte el plan a soles y persiste moneda/TC", async () => {
    const { svc, cambiarMonedaSolicitud } = build();

    await expect(svc.cambiarMoneda({
      solicitudId: "sol-1",
      moneda: "PEN",
      userSub: "user-1",
      userPermissions: [],
      actor: "user-1@test.pe",
    })).resolves.toEqual({ moneda: "PEN", tipoCambio: 3.5 });

    expect(cambiarMonedaSolicitud).toHaveBeenCalledWith(
      "sol-1",
      expect.objectContaining({
        moneda: "PEN",
        tipoCambio: 3.5,
        actor: "user-1@test.pe",
        plan: expect.objectContaining({
          moneda: "PEN",
          tipoCambio: 3.5,
          cuotas: [
            expect.objectContaining({ numero: 1, monto: 4130 }),
            expect.objectContaining({ numero: 2, monto: 4130 }),
          ],
        }),
      }),
    );
  });

  it("rechaza si ya hay facturacion", async () => {
    const { svc, cambiarMonedaSolicitud } = build({ tieneFacturacion: true });

    await expect(svc.cambiarMoneda({
      solicitudId: "sol-1",
      moneda: "PEN",
      userSub: "user-1",
      userPermissions: [],
      actor: "user-1@test.pe",
    })).rejects.toMatchObject({ status: 409 });

    expect(cambiarMonedaSolicitud).not.toHaveBeenCalled();
  });

  it("rechaza PEN si el evento no tiene TC", async () => {
    const { svc, cambiarMonedaSolicitud, eventoRepo } = build();
    vi.mocked(eventoRepo.findById).mockResolvedValue({ tipoCambio: null } as never);

    await expect(svc.cambiarMoneda({
      solicitudId: "sol-1",
      moneda: "PEN",
      userSub: "user-1",
      userPermissions: [],
      actor: "user-1@test.pe",
    })).rejects.toMatchObject({ status: 409 });

    expect(cambiarMonedaSolicitud).not.toHaveBeenCalled();
  });

  it("bloquea SGC aprobado", async () => {
    const { svc } = build({ sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.ACTIVE });

    await expect(svc.cambiarMoneda({
      solicitudId: "sol-1",
      moneda: "PEN",
      userSub: "user-1",
      userPermissions: [],
      actor: "user-1@test.pe",
    })).rejects.toMatchObject({ status: 409 });
  });
});
