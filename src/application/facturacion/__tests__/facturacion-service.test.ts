import { describe, it, expect, vi } from "vitest";
import { FacturacionApplicationService } from "../facturacion-service";
import { enviarEmailPlantilla } from "@/lib/server/email";
import type { IFacturacionRepository, FacturacionRow, FacturacionListResult } from "@/domain/ports/facturacion-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { EmpresaEntity } from "@/domain/models/empresa";
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
  return {
    findPerfilByEmail: vi.fn().mockResolvedValue(null),
    findEmpresaIdDeUsuario: vi.fn().mockResolvedValue(null),
  } as unknown as IAuthRepository;
}

function solicitudesMock() {
  return {
    detalle: vi.fn(),
    datosReservaIImp: vi.fn().mockResolvedValue(null),
  } as unknown as Pick<ISolicitudesRepository, "detalle" | "datosReservaIImp">;
}

function empresasMock() {
  return { findById: vi.fn() } as unknown as Pick<IEmpresaRepository, "findById">;
}

function crearSvc(
  repo: IFacturacionRepository,
  solicitudes = solicitudesMock(),
  auth = mockAuthRepo(),
  empresas = empresasMock(),
): FacturacionApplicationService {
  return new FacturacionApplicationService(repo, auth, solicitudes, empresas);
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
    guardarDocumentoIImp: vi.fn(),
    findFacturacionIdPorSolicitud: vi.fn(),
    registrarNotificacionFactura: vi.fn(),
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
  montoTotal: 3000,   moneda: "US$", modoPago: "cuotas", planCliente: false, standCode: "44", correoSolicitante: "test@test.com", empresaFacturacion: null, iimpContrato: null, iimpCuentaCorriente: null, createdAt: "2024-06-01T00:00:00Z",
  cuotas: [
    { id: "c1", numero: 1, monto: 1000, fechaVencimiento: "2024-07-01T00:00:00Z", estado: "pagado", comprobante: null, comprobanteFiscal: null, iimpDocumento: null, documentoSie: null, documentoSieAnulado: false, documentoSieJustificacion: null },
    { id: "c2", numero: 2, monto: 1000, fechaVencimiento: "2024-08-01T00:00:00Z", estado: "pendiente", comprobante: null, comprobanteFiscal: null, iimpDocumento: null, documentoSie: null, documentoSieAnulado: false, documentoSieJustificacion: null },
    { id: "c3", numero: 3, monto: 1000, fechaVencimiento: null, estado: "pendiente", comprobante: null, comprobanteFiscal: null, iimpDocumento: null, documentoSie: null, documentoSieAnulado: false, documentoSieJustificacion: null },
  ],
};

describe("FacturacionApplicationService — unit tests rigurosos", () => {
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

    it("respeta paginacion — pagina 2 con 5 items", async () => {
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
    it("baja logica — no borra fisicamente", async () => {
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
    it("flujo completo: crear → agregar cuotas → pagar", async () => {
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
  describe("plan definido por el cliente (plan_cuotas) â€” no editable", () => {
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

describe("FacturacionApplicationService.expediente", () => {
  it("devuelve empresa, contactos y documentos con su requisito", async () => {
    const auth = mockAuthRepo();
    vi.mocked(auth.findEmpresaIdDeUsuario).mockResolvedValue("emp-1");
    const empresas = empresasMock();
    vi.mocked(empresas.findById).mockResolvedValue({
      ruc: "20107972090",
      razonSocial: "CIDELSA",
      nombreComercial: null,
      direccionFiscal: "Av. Argentina 123",
      telefono: "01-5555555",
      emailContacto: "contacto@cidelsa.pe",
      emailFacturacion: "facturas@cidelsa.pe",
      actividadEconomica: "Fabricacion",
      estadoContribuyente: "ACTIVO",
      facturarANombre: null,
      representanteLegalNombre: "Juan Perez",
      representanteLegalTipoDocumento: "1",
      representanteLegalDni: "12345678",
      representanteCorreo: "juan@cidelsa.pe",
      representanteCelular: "999888777",
      representanteDireccion: null,
      responsablePagosNombre: "Ana Pagos",
      responsablePagosTelefono: "999111222",
      responsablePagosEmail: "pagos@cidelsa.pe",
    } as unknown as EmpresaEntity);
    const solicitudes = solicitudesMock();
    vi.mocked(solicitudes.detalle).mockResolvedValue({
      id: "s1",
      empresa: "CIDELSA",
      email: "correo12412@correo.com",
      estadoSolicitud: "pendiente_pago",
      iimpContrato: "0000000001",
      iimpCuentaCorriente: "1",
      iimpReservaAt: new Date("2026-10-27T22:15:58.000Z"),
      planCuotas: null,
      docsAdjuntos: [
        { id: "d1", categoria: "anexo", requisito: "ficha-ruc", nombre: "1792.pdf", url: "https://x/1792.pdf", estado: "activo", createdAt: new Date("2026-10-20T00:00:00.000Z") },
        { id: "d2", categoria: "contrato_firmado", requisito: null, nombre: "contrato-136.pdf", url: "https://x/contrato.pdf", estado: "activo", createdAt: new Date("2026-10-21T00:00:00.000Z") },
      ],
    } as unknown as Awaited<ReturnType<ISolicitudesRepository["detalle"]>>);
    vi.mocked(solicitudes.datosReservaIImp).mockResolvedValue({
      datosFacturacion: {
        tipoComprobante: "factura",
        tipoDocumento: "RUC",
        numeroDocumento: "20100022142",
        razonSocial: "ABB SA",
        direccion: "AV JAVIER PRADO ESTE 444",
        telefono: "918874873",
        contacto: "Jorge robles",
        email: "rosa@abb.com",
      },
    } as unknown as Awaited<ReturnType<ISolicitudesRepository["datosReservaIImp"]>>);

    const r = await crearSvc(mockRepo(), solicitudes, auth, empresas).expediente("s1");

    expect(r).toMatchObject({ empresaNombre: "CIDELSA", contrato: "0000000001", cuentaCorriente: "1" });
    expect(r.empresa).toMatchObject({ ruc: "20107972090", razonSocial: "CIDELSA" });
    expect(r.empresa?.responsables.pagos).toMatchObject({ nombre: "Ana Pagos", email: "pagos@cidelsa.pe" });
    expect(r.facturacion).toMatchObject({ razonSocial: "ABB SA", contacto: "Jorge robles" });
    expect(r.documentos[0]).toMatchObject({ categoria: "anexo", requisito: "ficha-ruc" });
    expect(r.documentos[1]).toMatchObject({ categoria: "contrato_firmado" });
  });

  it("responde 404 si la solicitud no existe", async () => {
    const solicitudes = solicitudesMock();
    vi.mocked(solicitudes.detalle).mockResolvedValue(null);

    await expect(crearSvc(mockRepo(), solicitudes).expediente("nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("FacturacionApplicationService.listar con filtros", () => {
  it("delega estado, busqueda y tipo al repositorio", async () => {
    const repo = mockRepo();
    repo.listar = vi.fn().mockResolvedValue({ data: [], total: 0 });

    await crearSvc(repo).listar({ page: 1, perPage: 10, eventoId: "e1", estado: "pendiente", search: "136", tipo: "manual" });

    expect(repo.listar).toHaveBeenCalledWith({ page: 1, perPage: 10, eventoId: "e1", estado: "pendiente", search: "136", tipo: "manual" });
  });
});
