import { describe, it, expect, vi } from "vitest";
import { FacturacionApplicationService } from "../facturacion-service";
import type { IFacturacionRepository, FacturacionRow, FacturacionListResult } from "@/domain/ports/facturacion-repository";

function mockRepo(): IFacturacionRepository {
  return {
    listar: vi.fn(),
    detalle: vi.fn(),
    agregarCuota: vi.fn(),
    pagarCuota: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    eliminarCuota: vi.fn(),
  };
}

const sampleRow: FacturacionRow = {
  id: "f1", solicitudId: "s1",   tipo: "manual", estado: "pendiente",
  montoTotal: 3000,   moneda: "US$", modoPago: "cuotas", standCode: "44", correoSolicitante: "test@test.com", createdAt: "2024-06-01T00:00:00Z",
  cuotas: [
    { id: "c1", numero: 1, monto: 1000, fechaVencimiento: "2024-07-01T00:00:00Z", estado: "pagado" },
    { id: "c2", numero: 2, monto: 1000, fechaVencimiento: "2024-08-01T00:00:00Z", estado: "pendiente" },
    { id: "c3", numero: 3, monto: 1000, fechaVencimiento: null, estado: "pendiente" },
  ],
};

describe("FacturacionApplicationService — unit tests rigurosos", () => {
  // ==================== LISTAR ====================
  describe("listar", () => {
    it("retorna resultado vacio cuando no hay registros", async () => {
      const repo = mockRepo();
      vi.mocked(repo.listar).mockResolvedValue({ data: [], total: 0 });
      const svc = new FacturacionApplicationService(repo);
      const r = await svc.listar({ page: 1, perPage: 10 });
      expect(r.data).toHaveLength(0);
      expect(r.total).toBe(0);
    });

    it("respeta paginacion — pagina 2 con 5 items", async () => {
      const repo = mockRepo();
      vi.mocked(repo.listar).mockResolvedValue({ data: [], total: 12 });
      const svc = new FacturacionApplicationService(repo);
      await svc.listar({ page: 2, perPage: 5 });
      expect(repo.listar).toHaveBeenCalledWith({ page: 2, perPage: 5 });
    });

    it("retorna los datos sin transformar", async () => {
      const repo = mockRepo();
      const expected: FacturacionListResult = { data: [sampleRow], total: 1 };
      vi.mocked(repo.listar).mockResolvedValue(expected);
      const svc = new FacturacionApplicationService(repo);
      const r = await svc.listar({ page: 1, perPage: 10 });
      expect(r.data[0]?.montoTotal).toBe(3000);
      expect(r.data[0]?.cuotas).toHaveLength(3);
    });
  });

  // ==================== DETALLE ====================
  describe("detalle", () => {
    it("retorna el registro con cuotas", async () => {
      const repo = mockRepo();
      vi.mocked(repo.detalle).mockResolvedValue(sampleRow);
      const svc = new FacturacionApplicationService(repo);
      const r = await svc.detalle("f1");
      expect(r?.id).toBe("f1");
      expect(r?.cuotas).toHaveLength(3);
    });

    it("retorna null para ID inexistente", async () => {
      const repo = mockRepo();
      vi.mocked(repo.detalle).mockResolvedValue(null);
      const svc = new FacturacionApplicationService(repo);
      expect(await svc.detalle("no-existe")).toBeNull();
    });
  });

  // ==================== AGREGAR CUOTA ====================
  describe("agregarCuota", () => {
    it("pasa monto y fecha al repositorio", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await svc.agregarCuota("f1", 500.50, "2024-12-31", "user@test.com");
      expect(repo.agregarCuota).toHaveBeenCalledWith("f1", 500.50, "2024-12-31", "user@test.com");
    });

    it("permite cuota sin fecha de vencimiento", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await svc.agregarCuota("f1", 100, null, "admin@test.com");
      expect(repo.agregarCuota).toHaveBeenCalledWith("f1", 100, null, "admin@test.com");
    });

    it("permite monto cero (cuota gratuita/ajuste)", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await svc.agregarCuota("f1", 0, null, "admin@test.com");
      expect(repo.agregarCuota).toHaveBeenCalledWith("f1", 0, null, "admin@test.com");
    });

    it("registra el usuario que creo la cuota", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await svc.agregarCuota("f1", 200, null, "legal@iimp.org.pe");
      expect(repo.agregarCuota).toHaveBeenCalledWith("f1", 200, null, "legal@iimp.org.pe");
    });
  });

  // ==================== PAGAR CUOTA ====================
  describe("pagarCuota", () => {
    it("delega al repositorio con usuario y comprobante", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await svc.pagarCuota("c1", "admin@test.com", "/uploads/voucher.pdf");
      expect(repo.pagarCuota).toHaveBeenCalledWith("c1", "admin@test.com", "/uploads/voucher.pdf");
    });

    it("permite comprobante nulo", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await svc.pagarCuota("c1", "admin@test.com", null);
      expect(repo.pagarCuota).toHaveBeenCalledWith("c1", "admin@test.com", null);
    });
  });

  // ==================== ACTUALIZAR ====================
  describe("actualizar", () => {
    it("cambia tipo de manual a niubizz", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await svc.actualizar("f1", { tipo: "niubizz" }, "admin@test.com");
      expect(repo.actualizar).toHaveBeenCalledWith("f1", { tipo: "niubizz" }, "admin@test.com");
    });

    it("cambia tipo de niubizz a manual", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await svc.actualizar("f1", { tipo: "manual" }, "admin@test.com");
      expect(repo.actualizar).toHaveBeenCalledWith("f1", { tipo: "manual" }, "admin@test.com");
    });

    it("permite actualizacion sin cambiar tipo (data vacio)", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await svc.actualizar("f1", {}, "admin@test.com");
      expect(repo.actualizar).toHaveBeenCalledWith("f1", {}, "admin@test.com");
    });
  });

  // ==================== ELIMINAR ====================
  describe("eliminar", () => {
    it("baja logica — no borra fisicamente", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await svc.eliminar("f1", "admin@test.com");
      expect(repo.eliminar).toHaveBeenCalledWith("f1", "admin@test.com");
    });
  });

  // ==================== ELIMINAR CUOTA ====================
  describe("eliminarCuota", () => {
    it("delega al repositorio con el usuario", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await svc.eliminarCuota("c1", "admin@test.com");
      expect(repo.eliminarCuota).toHaveBeenCalledWith("c1", "admin@test.com");
    });

    it("no debe lanzar excepcion", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);
      await expect(svc.eliminarCuota("c1", "admin@test.com")).resolves.toBeUndefined();
    });
  });

  // ==================== FLUJOS COMPLETOS ====================
  describe("flujos de negocio", () => {
    it("flujo completo: crear → agregar cuotas → pagar", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);

      // 1. Listar vacio
      vi.mocked(repo.listar).mockResolvedValue({ data: [], total: 0 });
      const r = await svc.listar({ page: 1, perPage: 10 });
      expect(r.data).toHaveLength(0);

      // 2. Agregar cuotas
      await svc.agregarCuota("f1", 500, "2024-12-31", "admin@test.com");
      expect(repo.agregarCuota).toHaveBeenCalledTimes(1);

      await svc.agregarCuota("f1", 500, "2025-01-31", "admin@test.com");
      expect(repo.agregarCuota).toHaveBeenCalledTimes(2);

      // 3. Pagar cuotas
      await svc.pagarCuota("c1", "admin@test.com", "/voucher1.pdf");
      await svc.pagarCuota("c2", "admin@test.com", "/voucher2.pdf");
      expect(repo.pagarCuota).toHaveBeenCalledTimes(2);

      // 4. Cambiar tipo
      await svc.actualizar("f1", { tipo: "niubizz" }, "admin@test.com");
      expect(repo.actualizar).toHaveBeenCalledWith("f1", { tipo: "niubizz" }, "admin@test.com");
    });

    it("flujo rollback: eliminar facturacion y regenerar", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);

      await svc.eliminar("f1", "admin@test.com");
      expect(repo.eliminar).toHaveBeenCalledWith("f1", "admin@test.com");

      // El metodo eliminar no debe lanzar excepcion
      await expect(svc.eliminar("f1", "admin@test.com")).resolves.toBeUndefined();
    });

    it("cuotas sin fecha de vencimiento", async () => {
      const repo = mockRepo();
      const svc = new FacturacionApplicationService(repo);

      await svc.agregarCuota("f1", 300, null, "admin@test.com");
      await svc.agregarCuota("f1", 200, null, "admin@test.com");
      expect(repo.agregarCuota).toHaveBeenCalledTimes(2);

      // No deberia lanzar error por fechas nulas
      await expect(svc.agregarCuota("f1", 100, null, "admin@test.com")).resolves.toBeUndefined();
    });
  });
});
