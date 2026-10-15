import { describe, expect, it, vi } from "vitest";
import { AUTORES_SISTEMA, ESTADOS_PAGO_EXTERNO } from "@/lib/shared/constants";
import { NotificacionFacturaApplicationService } from "../notificacion-factura-service";
import type { IFacturacionRepository } from "@/domain/ports/facturacion-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

/* estadoPago: 0 PAGADA | 1 PENDIENTE | 2 ANULADA */
const BASE = { numeroSolicitud: "CTRS-s1", cuota: 1, documento: "F001-1234.pdf", estadoPago: ESTADOS_PAGO_EXTERNO.PAGADA };

function mocks() {
  const solicitudes = {
    findSolicitudIdPorNumeroIImp: vi.fn(async () => "sol-1"),
    findSolicitudIdPorContrato: vi.fn(async () => "sol-1"),
  } as unknown as Pick<ISolicitudesRepository, "findSolicitudIdPorNumeroIImp" | "findSolicitudIdPorContrato">;
  const facturacion = {
    findFacturacionIdPorSolicitud: vi.fn(async () => "f1"),
    detalle: vi.fn(async () => ({ id: "f1", cuotas: [{ id: "cu1", numero: 1 }, { id: "cu2", numero: 2 }] })),
    registrarNotificacionFactura: vi.fn(async () => {}),
  } as unknown as Pick<IFacturacionRepository, "findFacturacionIdPorSolicitud" | "detalle" | "registrarNotificacionFactura">;
  return { solicitudes, facturacion };
}

function servicio(m: ReturnType<typeof mocks>) {
  return new NotificacionFacturaApplicationService(m.solicitudes, m.facturacion);
}

describe("NotificacionFacturaApplicationService", () => {
  it("registra documento y pago (0 = PAGADA) por NumeroSolicitud", async () => {
    const m = mocks();
    const r = await servicio(m).registrar(BASE);

    expect(m.solicitudes.findSolicitudIdPorNumeroIImp).toHaveBeenCalledWith("CTRS-s1");
    expect(m.facturacion.findFacturacionIdPorSolicitud).toHaveBeenCalledWith("sol-1");
    expect(m.facturacion.registrarNotificacionFactura).toHaveBeenCalledWith(
      "cu1",
      { documento: "F001-1234.pdf", estadoPago: 0 },
      AUTORES_SISTEMA.IIMP,
    );
    expect(r).toEqual({ cuotaId: "cu1", numero: 1, documento: "F001-1234.pdf", estadoPago: 0 });
  });

  it("acepta el contrato como alternativa y el estado 1 (PENDIENTE)", async () => {
    const m = mocks();
    await servicio(m).registrar({ contrato: "0000000008", cuota: 2, documento: "B001-9.pdf", estadoPago: ESTADOS_PAGO_EXTERNO.PENDIENTE });

    expect(m.solicitudes.findSolicitudIdPorContrato).toHaveBeenCalledWith("0000000008");
    expect(m.solicitudes.findSolicitudIdPorNumeroIImp).not.toHaveBeenCalled();
    expect(m.facturacion.registrarNotificacionFactura).toHaveBeenCalledWith(
      "cu2",
      { documento: "B001-9.pdf", estadoPago: 1 },
      AUTORES_SISTEMA.IIMP,
    );
  });

  it("registra la anulacion (2 = ANULADA) de la cuota", async () => {
    const m = mocks();
    const r = await servicio(m).registrar({ ...BASE, estadoPago: ESTADOS_PAGO_EXTERNO.ANULADA });

    expect(m.facturacion.registrarNotificacionFactura).toHaveBeenCalledWith(
      "cu1",
      { documento: "F001-1234.pdf", estadoPago: 2 },
      AUTORES_SISTEMA.IIMP,
    );
    expect(r.estadoPago).toBe(2);
  });

  it("404 cuando no existe la solicitud activa para el numero/contrato", async () => {
    const m = mocks();
    vi.mocked(m.solicitudes.findSolicitudIdPorNumeroIImp).mockResolvedValue(null);
    await expect(servicio(m).registrar(BASE)).rejects.toMatchObject({ status: 404 });
    expect(m.facturacion.registrarNotificacionFactura).not.toHaveBeenCalled();
  });

  it("404 cuando la solicitud no tiene facturacion activa", async () => {
    const m = mocks();
    vi.mocked(m.facturacion.findFacturacionIdPorSolicitud).mockResolvedValue(null);
    await expect(servicio(m).registrar(BASE)).rejects.toMatchObject({ status: 404 });
  });

  it("404 cuando la facturacion no tiene esa cuota", async () => {
    const m = mocks();
    await expect(servicio(m).registrar({ ...BASE, cuota: 5 })).rejects.toMatchObject({ status: 404 });
    expect(m.facturacion.registrarNotificacionFactura).not.toHaveBeenCalled();
  });

  it("400 sin numeroSolicitud ni contrato, cuota invalida, documento vacio o estado fuera de 0/1/2", async () => {
    const m = mocks();
    await expect(servicio(m).registrar({ ...BASE, numeroSolicitud: null })).rejects.toMatchObject({ status: 400 });
    await expect(servicio(m).registrar({ ...BASE, cuota: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(servicio(m).registrar({ ...BASE, documento: "  " })).rejects.toMatchObject({ status: 400 });
    await expect(servicio(m).registrar({ ...BASE, estadoPago: 3 })).rejects.toMatchObject({ status: 400 });
    await expect(servicio(m).registrar({ ...BASE, estadoPago: "PAGADO" as never })).rejects.toMatchObject({ status: 400 });
    expect(m.facturacion.registrarNotificacionFactura).not.toHaveBeenCalled();
  });
});
