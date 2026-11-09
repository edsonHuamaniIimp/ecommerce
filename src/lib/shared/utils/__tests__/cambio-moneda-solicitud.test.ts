import { describe, expect, it } from "vitest";
import { ESTADOS_SOLICITUD, SGC_LIFECYCLE_STATUSES } from "@/lib/shared/constants";
import { puedeCambiarMonedaSolicitud } from "../cambio-moneda-solicitud";

const base = {
  estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE,
  flgActivo: true,
  tieneFacturacion: false,
  facturacionId: null,
  iimpContrato: null,
  sgcLifecycleStatus: null,
};

describe("puedeCambiarMonedaSolicitud", () => {
  it("permite cambiar antes de facturacion/pago/SGC", () => {
    expect(puedeCambiarMonedaSolicitud(base)).toBe(true);
  });

  it("bloquea si ya hay facturacion u orden de pago", () => {
    expect(puedeCambiarMonedaSolicitud({ ...base, tieneFacturacion: true })).toBe(false);
    expect(puedeCambiarMonedaSolicitud({ ...base, facturacionId: "f-1" })).toBe(false);
  });

  it("bloquea si ya hay pago, reserva IIMP o SGC aprobado", () => {
    expect(puedeCambiarMonedaSolicitud({ ...base, estadoSolicitud: ESTADOS_SOLICITUD.PENDIENTE_PAGO })).toBe(false);
    expect(puedeCambiarMonedaSolicitud({ ...base, estadoSolicitud: ESTADOS_SOLICITUD.PAGADO })).toBe(false);
    expect(puedeCambiarMonedaSolicitud({ ...base, iimpContrato: "0000000001" })).toBe(false);
    expect(puedeCambiarMonedaSolicitud({ ...base, sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.ACTIVE })).toBe(false);
    expect(puedeCambiarMonedaSolicitud({ ...base, sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.FINALIZED })).toBe(false);
  });

  it("permite si SGC fue observado/rechazado y no hay cobranza", () => {
    expect(puedeCambiarMonedaSolicitud({ ...base, sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED })).toBe(true);
    expect(puedeCambiarMonedaSolicitud({ ...base, sgcLifecycleStatus: SGC_LIFECYCLE_STATUSES.REJECTED })).toBe(true);
  });

  it("bloquea solicitudes dadas de baja", () => {
    expect(puedeCambiarMonedaSolicitud({ ...base, flgActivo: false })).toBe(false);
  });
});
