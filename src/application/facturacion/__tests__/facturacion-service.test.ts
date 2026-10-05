import { describe, it, expect, vi } from "vitest";
import { FacturacionApplicationService } from "../facturacion-service";
import { enviarEmailPlantilla } from "@/lib/server/email";
import type { IFacturacionRepository, FacturacionRow, FacturacionListResult } from "@/domain/ports/facturacion-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
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

function mockAuthRepo(): IAuthRepository {
  return { findPerfilByEmail: vi.fn().mockResolvedValue(null) } as unknown as IAuthRepository;
}

function crearSvc(repo: IFacturacionRepository): FacturacionApplicationService {
  return new FacturacionApplicationService(repo, mockAuthRepo());
}

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
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    eliminarCuota: vi.fn(),
    esPropietario: vi.fn(),
    esPropietarioDeCuota: vi.fn(),
    facturacionDeCuota: vi.fn(),
  };
}

const sampleRow: FacturacionRow = {
  id: "f1", solicitudId: "s1",   tipo: "manual", estado: "pendiente",
  montoTotal: 3000,   moneda: "US$", modoPago: "cuotas", planCliente: false, standCode: "44", correoSolicitante: "test@test.com", createdAt: "2024-06-01T00:00:00Z",
  cuotas: [
    { id: "c1", numero: 1, monto: 1000, fechaVencimiento: "2024-07-01T00:00:00Z", estado: "pagado", comprobante: null, comprobanteFiscal: null },
    { id: "c2", numero: 2, monto: 1000, fechaVencimiento: "2024-08-01T00:00:00Z", estado: "pendiente", comprobante: null, comprobanteFiscal: null },
    { id: "c3", numero: 3, monto: 1000, fechaVencimiento: null, estado: "pendiente", comprobante: null, comprobanteFiscal: null },
  ],
};

describe("FacturacionApplicationService â€” unit tests rigurosos", () => {
  // ==================== LISTAR ====================
  describe("listar", () => {
    it("retorna resultado vacio cuando no hay registros", async () => {
      const repo = mockRepo();
      vi.mocked(repo.listar).mockResolvedValue({ data: [], total: 0 });
      const svc = crearSvc(repo);
      const r = await svc.listar({ page: 1, perPage: 10 });
      expect(r.data).toHaveLength(0);
      expect(r.total).toBe(0);
    });

    it("respeta paginacion â€” pagina 2 con 5 items", async () => {
      const repo = mockRepo();
      vi.mocked(repo.listar).mockResolvedValue({ data: [], total: 12 });
      const svc = crearSvc(repo);
      await svc.listar({ page: 2, perPage: 5 });
      expect(repo.listar).toHaveBeenCalledWith({ page: 2, perPage: 5 });
    });

    it("retorna los datos sin transformar", async () => {
      const repo = mockRepo();
      const expected: FacturacionListResult = { data: [sampleRow], total: 1 };
      vi.mocked(repo.listar).mockResolvedValue(expected);
      const svc = crearSvc(repo);
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
      const svc = crearSvc(repo);
      const r = await svc.detalle("f1");
      expect(r?.id).toBe("f1");
      expect(r?.cuotas).toHaveLength(3);
    });

    it("retorna null para ID inexistente", async () => {
      const repo = mockRepo();
      vi.mocked(repo.detalle).mockResolvedValue(null);
      const svc = crearSvc(repo);
      expect(await svc.detalle("no-existe")).toBeNull();
    });
  });

  // ==================== AGREGAR CUOTA ====================
  describe("agregarCuota", () => {
    it("pasa monto y fecha al repositorio", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await svc.agregarCuota("f1", 500.50, "2024-12-31", "user@test.com");
      expect(repo.agregarCuota).toHaveBeenCalledWith("f1", 500.50, "2024-12-31", "user@test.com");
    });

    it("permite cuota sin fecha de vencimiento", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await svc.agregarCuota("f1", 100, null, "admin@test.com");
      expect(repo.agregarCuota).toHaveBeenCalledWith("f1", 100, null, "admin@test.com");
    });

    it("permite monto cero (cuota gratuita/ajuste)", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await svc.agregarCuota("f1", 0, null, "admin@test.com");
      expect(repo.agregarCuota).toHaveBeenCalledWith("f1", 0, null, "admin@test.com");
    });

    it("registra el usuario que creo la cuota", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await svc.agregarCuota("f1", 200, null, "legal@iimp.org.pe");
      expect(repo.agregarCuota).toHaveBeenCalledWith("f1", 200, null, "legal@iimp.org.pe");
    });
  });

  // ==================== PAGAR CUOTA ====================
  describe("pagarCuota", () => {
    it("delega al repositorio con usuario y comprobante", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await svc.pagarCuota("c1", "admin@test.com", "/uploads/voucher.pdf");
      expect(repo.pagarCuota).toHaveBeenCalledWith("c1", "admin@test.com", "/uploads/voucher.pdf");
    });

    it("permite comprobante nulo", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await svc.pagarCuota("c1", "admin@test.com", null);
      expect(repo.pagarCuota).toHaveBeenCalledWith("c1", "admin@test.com", null);
    });
  });

  // ==================== ACTUALIZAR ====================
  describe("actualizar", () => {
    it("cambia tipo de manual a niubizz", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await svc.actualizar("f1", { tipo: "niubizz" }, "admin@test.com");
      expect(repo.actualizar).toHaveBeenCalledWith("f1", { tipo: "niubizz" }, "admin@test.com");
    });

    it("cambia tipo de niubizz a manual", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await svc.actualizar("f1", { tipo: "manual" }, "admin@test.com");
      expect(repo.actualizar).toHaveBeenCalledWith("f1", { tipo: "manual" }, "admin@test.com");
    });

    it("permite actualizacion sin cambiar tipo (data vacio)", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await svc.actualizar("f1", {}, "admin@test.com");
      expect(repo.actualizar).toHaveBeenCalledWith("f1", {}, "admin@test.com");
    });
  });

  // ==================== ELIMINAR ====================
  describe("eliminar", () => {
    it("baja logica â€” no borra fisicamente", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await svc.eliminar("f1", "admin@test.com");
      expect(repo.eliminar).toHaveBeenCalledWith("f1", "admin@test.com");
    });
  });

  // ==================== ELIMINAR CUOTA ====================
  describe("eliminarCuota", () => {
    it("delega al repositorio con el usuario", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await svc.eliminarCuota("c1", "admin@test.com");
      expect(repo.eliminarCuota).toHaveBeenCalledWith("c1", "admin@test.com");
    });

    it("no debe lanzar excepcion", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);
      await expect(svc.eliminarCuota("c1", "admin@test.com")).resolves.toBeUndefined();
    });
  });

  // ==================== FLUJOS COMPLETOS ====================
  describe("flujos de negocio", () => {
    it("flujo completo: crear â†’ agregar cuotas â†’ pagar", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);

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
      const svc = crearSvc(repo);

      await svc.eliminar("f1", "admin@test.com");
      expect(repo.eliminar).toHaveBeenCalledWith("f1", "admin@test.com");

      // El metodo eliminar no debe lanzar excepcion
      await expect(svc.eliminar("f1", "admin@test.com")).resolves.toBeUndefined();
    });

    it("cuotas sin fecha de vencimiento", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);

      await svc.agregarCuota("f1", 300, null, "admin@test.com");
      await svc.agregarCuota("f1", 200, null, "admin@test.com");
      expect(repo.agregarCuota).toHaveBeenCalledTimes(2);

      // No deberia lanzar error por fechas nulas
      await expect(svc.agregarCuota("f1", 100, null, "admin@test.com")).resolves.toBeUndefined();
    });
  });

  // ==================== COMPROBANTE FISCAL ====================
  describe("adjuntarComprobanteFiscal", () => {
    const DATOS = { tipo: "factura", numero: "F001-1234", url: "/uploads/f001-1234.pdf" };

    it("adjunta el comprobante de una cuota pagada y notifica al cliente", async () => {
      const repo = mockRepo();
      vi.mocked(repo.facturacionDeCuota).mockResolvedValue(sampleRow);
      const svc = crearSvc(repo);

      await svc.adjuntarComprobanteFiscal("c1", DATOS, "facturacion@iimp.org.pe");

      expect(repo.adjuntarComprobanteFiscal).toHaveBeenCalledWith("c1", DATOS, "facturacion@iimp.org.pe");
      expect(enviarEmailPlantilla).toHaveBeenCalledWith(
        expect.objectContaining({ to: "test@test.com", plantilla: "comprobante-pago" }),
      );
    });

    it("rechaza adjuntar en una cuota pendiente", async () => {
      const repo = mockRepo();
      vi.mocked(repo.facturacionDeCuota).mockResolvedValue(sampleRow);
      const svc = crearSvc(repo);

      await expect(svc.adjuntarComprobanteFiscal("c2", DATOS, "f@iimp.org.pe")).rejects.toMatchObject({ status: 409 });
      expect(repo.adjuntarComprobanteFiscal).not.toHaveBeenCalled();
    });

    it("rechaza una cuota inexistente", async () => {
      const repo = mockRepo();
      vi.mocked(repo.facturacionDeCuota).mockResolvedValue(sampleRow);
      const svc = crearSvc(repo);

      await expect(svc.adjuntarComprobanteFiscal("nope", DATOS, "f@iimp.org.pe")).rejects.toMatchObject({ status: 404 });
    });

    it("rechaza un tipo de comprobante invalido", async () => {
      const repo = mockRepo();
      const svc = crearSvc(repo);

      await expect(
        svc.adjuntarComprobanteFiscal("c1", { ...DATOS, tipo: "nota-credito" }, "f@iimp.org.pe"),
      ).rejects.toMatchObject({ status: 400 });
      expect(repo.facturacionDeCuota).not.toHaveBeenCalled();
    });

    it("no bloquea el adjuntado si el correo falla", async () => {
      const repo = mockRepo();
      vi.mocked(repo.facturacionDeCuota).mockResolvedValue(sampleRow);
      vi.mocked(enviarEmailPlantilla).mockRejectedValueOnce(new Error("smtp"));
      const svc = crearSvc(repo);

      await expect(svc.adjuntarComprobanteFiscal("c1", DATOS, "f@iimp.org.pe")).resolves.toBeUndefined();
      expect(repo.adjuntarComprobanteFiscal).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== PERMISOS ====================
  describe("autorizarGestion", () => {
    it("permite con facturacion:view y con admin total", () => {
      const svc = crearSvc(mockRepo());
      expect(() => svc.autorizarGestion([PERMISSIONS.FACTURACION_VIEW])).not.toThrow();
      expect(() => svc.autorizarGestion([PERMISSIONS.ADMIN_FULL])).not.toThrow();
    });

    it("rechaza sin permisos de facturacion", () => {
      const svc = crearSvc(mockRepo());
      expect(() => svc.autorizarGestion([PERMISSIONS.PAGOS_VIEW])).toThrow();
    });
  });

  // ==================== PLAN DEL CLIENTE (contrato) ====================
  describe("plan definido por el cliente (plan_cuotas) — no editable", () => {
    it("rechaza agregar cuota cuando el plan viene del contrato", async () => {
      const repo = mockRepo();
      vi.mocked(repo.detalle).mockResolvedValue({ ...sampleRow, planCliente: true });
      const svc = crearSvc(repo);

      await expect(svc.agregarCuota("f1", 1000, "2099-01-01", "f@iimp.org.pe")).rejects.toMatchObject({ status: 409 });
      expect(repo.agregarCuota).not.toHaveBeenCalled();
    });

    it("rechaza eliminar cuota cuando el plan viene del contrato", async () => {
      const repo = mockRepo();
      vi.mocked(repo.facturacionDeCuota).mockResolvedValue({ ...sampleRow, planCliente: true });
      const svc = crearSvc(repo);

      await expect(svc.eliminarCuota("c1", "f@iimp.org.pe")).rejects.toMatchObject({ status: 409 });
      expect(repo.eliminarCuota).not.toHaveBeenCalled();
    });

    it("rechaza cambiar el modo de pago pero permite confirmar pagos", async () => {
      const repo = mockRepo();
      vi.mocked(repo.detalle).mockResolvedValue({ ...sampleRow, planCliente: true });
      const svc = crearSvc(repo);

      await expect(svc.actualizar("f1", { modoPago: "completo" }, "f@iimp.org.pe")).rejects.toMatchObject({ status: 409 });

      await svc.pagarCuota("c2", "f@iimp.org.pe", "/uploads/voucher.pdf");
      expect(repo.pagarCuota).toHaveBeenCalledWith("c2", "f@iimp.org.pe", "/uploads/voucher.pdf");
    });
  });
});
