import { describe, it, expect, vi } from "vitest";
import { PagosApplicationService } from "../pagos-service";
import { DomainError } from "@/lib/server/router";
import type { IFacturacionRepository, FacturacionRow } from "@/domain/ports/facturacion-repository";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

function mockRepo(): IFacturacionRepository {
  return {
    listar: vi.fn(),
    listarPorCliente: vi.fn(),
    detalle: vi.fn(),
    agregarCuota: vi.fn(),
    actualizarCuota: vi.fn(),
    adjuntarVoucher: vi.fn(),
    pagarCuota: vi.fn(),
    adjuntarComprobanteFiscal: vi.fn(),
    guardarDocumentoIImp: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    eliminarCuota: vi.fn(),
    esPropietario: vi.fn(),
    esPropietarioDeCuota: vi.fn(),
    facturacionDeCuota: vi.fn(),
  };
}

const ident = { userId: "u1", email: "a@b.com" };

/** Facturacion con una cuota que ya tiene voucher adjunto. */
function rowConVoucher(): FacturacionRow {
  return {
    id: "f1", solicitudId: "s1", tipo: "manual", estado: "pendiente",
    montoTotal: 2000, moneda: "US$", modoPago: "cuotas", planCliente: false, standCode: "44",
    correoSolicitante: "a@b.com", iimpContrato: null, iimpCuentaCorriente: null, createdAt: "2024-06-01T00:00:00Z",
    cuotas: [{ id: "c1", numero: 1, monto: 1000, fechaVencimiento: null, estado: "pendiente", comprobante: "/uploads/v.pdf", comprobanteFiscal: null, iimpDocumento: null }],
  };
}

function rowConCuotas(total: number, montos: number[]): FacturacionRow {
  return {
    id: "f1", solicitudId: "s1", tipo: "manual", estado: "pendiente",
    montoTotal: total, moneda: "US$", modoPago: "cuotas", planCliente: false, standCode: "44",
    correoSolicitante: "a@b.com", iimpContrato: null, iimpCuentaCorriente: null, createdAt: "2024-06-01T00:00:00Z",
    cuotas: montos.map((m, i) => ({
      id: `c${i + 1}`, numero: i + 1, monto: m,
      fechaVencimiento: null, estado: "pendiente", comprobante: null, comprobanteFiscal: null, iimpDocumento: null,
    })),
  };
}

const sampleRow: FacturacionRow = {
  id: "f1", solicitudId: "s1", tipo: "manual", estado: "pendiente",
  montoTotal: 3000, moneda: "US$", modoPago: "cuotas", planCliente: false, standCode: "44",
  correoSolicitante: "a@b.com", iimpContrato: null, iimpCuentaCorriente: null, createdAt: "2024-06-01T00:00:00Z",
  cuotas: [],
};

describe("PagosApplicationService", () => {
  it("listar delega en listarPorCliente con la identidad", async () => {
    const repo = mockRepo();
    repo.listarPorCliente = vi.fn().mockResolvedValue({ data: [], total: 0 });
    const svc = new PagosApplicationService(repo);
    await svc.listar(ident, { page: 2, perPage: 10 });
    expect(repo.listarPorCliente).toHaveBeenCalledWith({ userId: "u1", email: "a@b.com", page: 2, perPage: 10 });
  });

  it("detalle lanza 404 si la facturacion no existe", async () => {
    const repo = mockRepo();
    repo.detalle = vi.fn().mockResolvedValue(null);
    const svc = new PagosApplicationService(repo);
    await expect(svc.detalle("x", ident)).rejects.toBeInstanceOf(DomainError);
  });

  it("detalle lanza 403 si no es propietario", async () => {
    const repo = mockRepo();
    repo.detalle = vi.fn().mockResolvedValue(sampleRow);
    repo.esPropietario = vi.fn().mockResolvedValue(false);
    const svc = new PagosApplicationService(repo);
    await expect(svc.detalle("f1", ident)).rejects.toMatchObject({ status: 403 });
  });

  it("agregarCuota exige propiedad y no toca el repo si no lo es", async () => {
    const repo = mockRepo();
    repo.esPropietario = vi.fn().mockResolvedValue(false);
    const svc = new PagosApplicationService(repo);
    await expect(svc.agregarCuota("f1", 100, null, ident)).rejects.toMatchObject({ status: 403 });
    expect(repo.agregarCuota).not.toHaveBeenCalled();
  });

  it("agregarCuota usa el email del cliente como autor", async () => {
    const repo = mockRepo();
    repo.esPropietario = vi.fn().mockResolvedValue(true);
    repo.detalle = vi.fn().mockResolvedValue(rowConCuotas(1000, []));
    repo.agregarCuota = vi.fn().mockResolvedValue(undefined);
    const svc = new PagosApplicationService(repo);
    await svc.agregarCuota("f1", 100, null, ident);
    expect(repo.agregarCuota).toHaveBeenCalledWith("f1", 100, null, "a@b.com");
  });

  it("eliminarCuota exige propiedad de la cuota", async () => {
    const repo = mockRepo();
    repo.esPropietarioDeCuota = vi.fn().mockResolvedValue(false);
    const svc = new PagosApplicationService(repo);
    await expect(svc.eliminarCuota("c1", ident)).rejects.toMatchObject({ status: 403 });
    expect(repo.eliminarCuota).not.toHaveBeenCalled();
  });

  it("agregarCuota rechaza si la suma de cuotas supera el monto total", async () => {
    const repo = mockRepo();
    repo.esPropietario = vi.fn().mockResolvedValue(true);
    repo.detalle = vi.fn().mockResolvedValue(rowConCuotas(2000, [1000, 1000]));
    const svc = new PagosApplicationService(repo);
    await expect(svc.agregarCuota("f1", 500, null, ident)).rejects.toMatchObject({ status: 400 });
    expect(repo.agregarCuota).not.toHaveBeenCalled();
  });

  it("agregarCuota permite si la suma no supera el total", async () => {
    const repo = mockRepo();
    repo.esPropietario = vi.fn().mockResolvedValue(true);
    repo.detalle = vi.fn().mockResolvedValue(rowConCuotas(2000, [500]));
    repo.agregarCuota = vi.fn().mockResolvedValue(undefined);
    const svc = new PagosApplicationService(repo);
    await svc.agregarCuota("f1", 1500, null, ident);
    expect(repo.agregarCuota).toHaveBeenCalledWith("f1", 1500, null, "a@b.com");
  });

  it("actualizarCuota rechaza si el nuevo monto excede el total", async () => {
    const repo = mockRepo();
    repo.esPropietarioDeCuota = vi.fn().mockResolvedValue(true);
    repo.facturacionDeCuota = vi.fn().mockResolvedValue(rowConCuotas(2000, [1000, 1000]));
    const svc = new PagosApplicationService(repo);
    await expect(svc.actualizarCuota("c1", { monto: 1500 }, ident)).rejects.toMatchObject({ status: 400 });
    expect(repo.actualizarCuota).not.toHaveBeenCalled();
  });

  it("actualizarCuota rechaza si la cuota ya tiene voucher adjunto", async () => {
    const repo = mockRepo();
    repo.esPropietarioDeCuota = vi.fn().mockResolvedValue(true);
    repo.facturacionDeCuota = vi.fn().mockResolvedValue(rowConVoucher());
    const svc = new PagosApplicationService(repo);
    await expect(svc.actualizarCuota("c1", { monto: 500 }, ident)).rejects.toMatchObject({ status: 409 });
    expect(repo.actualizarCuota).not.toHaveBeenCalled();
  });

  it("eliminarCuota rechaza si la cuota ya tiene voucher adjunto", async () => {
    const repo = mockRepo();
    repo.esPropietarioDeCuota = vi.fn().mockResolvedValue(true);
    repo.facturacionDeCuota = vi.fn().mockResolvedValue(rowConVoucher());
    const svc = new PagosApplicationService(repo);
    await expect(svc.eliminarCuota("c1", ident)).rejects.toMatchObject({ status: 409 });
    expect(repo.eliminarCuota).not.toHaveBeenCalled();
  });

  it("adjuntarVoucher exige propiedad de la cuota", async () => {
    const repo = mockRepo();
    repo.esPropietarioDeCuota = vi.fn().mockResolvedValue(false);
    const svc = new PagosApplicationService(repo);
    await expect(svc.adjuntarVoucher("c1", "/uploads/x.pdf", ident)).rejects.toMatchObject({ status: 403 });
    expect(repo.adjuntarVoucher).not.toHaveBeenCalled();
  });

  it("actualizarCuota delega cuando es propietario", async () => {
    const repo = mockRepo();
    repo.esPropietarioDeCuota = vi.fn().mockResolvedValue(true);
    repo.facturacionDeCuota = vi.fn().mockResolvedValue(rowConCuotas(2000, [500]));
    repo.actualizarCuota = vi.fn().mockResolvedValue(undefined);
    const svc = new PagosApplicationService(repo);
    await svc.actualizarCuota("c1", { monto: 500 }, ident);
    expect(repo.actualizarCuota).toHaveBeenCalledWith("c1", { monto: 500 }, "a@b.com");
  });

  // ==================== PLAN DEL CLIENTE (contrato) ====================
  it("no permite agregar cuota cuando el plan viene del contrato", async () => {
    const repo = mockRepo();
    repo.esPropietario = vi.fn().mockResolvedValue(true);
    repo.detalle = vi.fn().mockResolvedValue({ ...rowConCuotas(2000, [1000]), planCliente: true });
    const svc = new PagosApplicationService(repo);

    await expect(svc.agregarCuota("f1", 500, null, ident)).rejects.toMatchObject({ status: 409 });
    expect(repo.agregarCuota).not.toHaveBeenCalled();
  });

  it("no permite editar ni eliminar cuotas del plan del contrato", async () => {
    const repo = mockRepo();
    repo.esPropietarioDeCuota = vi.fn().mockResolvedValue(true);
    repo.facturacionDeCuota = vi.fn().mockResolvedValue({ ...rowConCuotas(2000, [1000]), planCliente: true });
    const svc = new PagosApplicationService(repo);

    await expect(svc.actualizarCuota("c1", { monto: 500 }, ident)).rejects.toMatchObject({ status: 409 });
    await expect(svc.eliminarCuota("c1", ident)).rejects.toMatchObject({ status: 409 });
    expect(repo.actualizarCuota).not.toHaveBeenCalled();
    expect(repo.eliminarCuota).not.toHaveBeenCalled();
  });

  it("si permite adjuntar el voucher de pago con plan del contrato", async () => {
    const repo = mockRepo();
    repo.esPropietarioDeCuota = vi.fn().mockResolvedValue(true);
    repo.facturacionDeCuota = vi.fn().mockResolvedValue({ ...rowConCuotas(2000, [1000]), planCliente: true });
    repo.adjuntarVoucher = vi.fn().mockResolvedValue(undefined);
    const svc = new PagosApplicationService(repo);

    await svc.adjuntarVoucher("c1", "/uploads/voucher.pdf", ident);
    expect(repo.adjuntarVoucher).toHaveBeenCalledWith("c1", "/uploads/voucher.pdf", "a@b.com");
  });
});
