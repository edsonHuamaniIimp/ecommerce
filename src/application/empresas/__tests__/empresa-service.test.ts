import { describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES, ESTADOS_EMPRESA, ESTADOS_FILA_CARGA, PERMISSIONS, TIPOS_COMPROBANTE, TIPOS_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_PERSONA, UBIGEO_PAIS_PERU } from "@/lib/shared/constants";
import type { ActualizarEmpresaData, IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IRoleRepository } from "@/domain/ports/role-repository";
import type { EmpresaApi, IEmpresaClient, NuevaEmpresaApi } from "@/domain/ports/empresa-client";
import type { IPersonaClient, NuevaPersonaApi, PersonaApi } from "@/domain/ports/persona-client";
import type {
  CrearEmpresaData,
  EmpresaEntity,
  EmpresasListParams,
  EmpresasPaginatedResult,
  FilaCargaEmpresa,
} from "@/domain/models/empresa";
import { EmpresaApplicationService } from "../empresa-service";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

vi.mock("@/lib/server/email", () => ({
  sendEmail: vi.fn(async () => true),
  enviarEmailPlantilla: vi.fn(async () => true),
}));
vi.mock("@/lib/server/utils/password", () => ({
  hashPassword: (plano: string) => `hash:${plano}`,
  generarPasswordTemporal: () => "TempPass123",
}));

/** Repositorio falso en memoria para los tests del servicio. */
class FakeEmpresaRepo implements IEmpresaRepository {
  private items = new Map<string, EmpresaEntity>();
  private seq = 0;
  listarCalls: EmpresasListParams[] = [];

  seed(data: Partial<EmpresaEntity> & { ruc: string; razonSocial: string }): EmpresaEntity {
    const now = new Date("2026-09-30T12:00:00Z");
    const empresa: EmpresaEntity = {
      id: data.id ?? `emp-${++this.seq}`,
      ruc: data.ruc,
      sieCode: data.sieCode ?? null,
      razonSocial: data.razonSocial,
      logoUrl: data.logoUrl ?? null,
      nombreComercial: data.nombreComercial ?? null,
      direccionFiscal: data.direccionFiscal ?? null,
      telefono: data.telefono ?? null,
      emailContacto: data.emailContacto ?? null,
      emailFacturacion: data.emailFacturacion ?? null,
      representanteLegalNombre: data.representanteLegalNombre ?? null,
      representanteLegalDni: data.representanteLegalDni ?? null,
      partidaElectronica: data.partidaElectronica ?? null,
      tipoComprobante: data.tipoComprobante ?? TIPOS_COMPROBANTE.FACTURA,
      sitioWeb: data.sitioWeb ?? null,
      estado: data.estado ?? ESTADOS_EMPRESA.ACTIVA,
      cuentaCreada: data.cuentaCreada ?? false,
      primerAccesoCompletado: data.primerAccesoCompletado ?? false,
      datosValidadosEn: data.datosValidadosEn ?? null,
      creadoPor: data.creadoPor ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(empresa.id, empresa);
    return empresa;
  }

  async listarPaginated(params: EmpresasListParams): Promise<EmpresasPaginatedResult> {
    this.listarCalls.push(params);
    const data = [...this.items.values()];
    return {
      data,
      total: data.length,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.max(1, Math.ceil(data.length / params.perPage)),
    };
  }

  async findById(id: string): Promise<EmpresaEntity | null> {
    return this.items.get(id) ?? null;
  }

  async findByRuc(ruc: string): Promise<EmpresaEntity | null> {
    return [...this.items.values()].find((e) => e.ruc === ruc) ?? null;
  }

  async create(data: CrearEmpresaData): Promise<EmpresaEntity> {
    return this.seed(data);
  }

  async update(id: string, data: ActualizarEmpresaData): Promise<EmpresaEntity> {
    const actual = this.items.get(id);
    if (!actual) throw new Error("no existe");
    const actualizada = { ...actual, ...data, updatedAt: new Date("2026-09-30T13:00:00Z") } as EmpresaEntity;
    this.items.set(id, actualizada);
    return actualizada;
  }
}

const INPUT_BASE = {
  ruc: "20601234567",
  razonSocial: "  Minera Cordillera S.A.C.  ",
  emailContacto: "contacto@mineracordillera.pe",
  emailFacturacion: "facturacion@mineracordillera.pe",
  representanteLegalNombre: "Jorge Quispe Ramos",
  representanteLegalDni: "45871233",
};

/** Repositorio de auth falso (solo lo que usa el servicio de empresas). */
function fakeAuthRepo(overrides: {
  existeEmail?: boolean;
  usuarioExistente?: boolean;
  empresaPortal?: { empresaId: string; primerAccesoCompletado: boolean } | null;
} = {}) {
  const llamadas = { creados: [] as unknown[], passwords: [] as string[], flags: [] as boolean[] };
  return {
    llamadas,
    existeEmail: vi.fn(async () => overrides.existeEmail ?? false),
    crearUsuario: vi.fn(async (data: unknown) => { llamadas.creados.push(data); }),
    findByEmail: vi.fn(async () => (overrides.usuarioExistente ? [{ id: "ur-1" }] : [])),
    updatePassword: vi.fn(async (_id: string, password: string) => { llamadas.passwords.push(password); }),
    marcarCambioPasswordRequerido: vi.fn(async (_email: string, requerido: boolean) => { llamadas.flags.push(requerido); }),
    estadoEmpresaPortal: vi.fn(async () => overrides.empresaPortal ?? null),
  };
}

/** Repositorio de roles falso (rol cliente fijo). */
function fakeRoleRepo() {
  return { findByNombre: vi.fn(async () => ({ id: "rol-cliente", nombre: "cliente", permisos: [] })) };
}

/** Cliente falso de personas de servicio-persona. */
function fakePersonaClient(overrides: { existente?: PersonaApi | null; creada?: PersonaApi | null } = {}) {
  return {
    buscarPorDocumento: vi.fn(async () => overrides.existente ?? null),
    buscarPersonas: vi.fn(async () => []),
    crearPersona: vi.fn(async (dto: NuevaPersonaApi) => overrides.creada ?? { sie_code: "P0000012345", ...dto }),
    actualizarPersona: vi.fn(async (sieCode: string, dto: NuevaPersonaApi) => ({ sie_code: sieCode, ...dto })),
  };
}

/** Cliente falso de empresas de servicio-persona. */
function fakeEmpresaClient(overrides: { existente?: EmpresaApi | null; creada?: EmpresaApi | null } = {}) {
  return {
    buscarEmpresas: vi.fn(async () => []),
    buscarPorDocumento: vi.fn(async () => overrides.existente ?? null),
    crearEmpresa: vi.fn(async (dto: NuevaEmpresaApi) => overrides.creada ?? { sie_code: "E0000000123", ...dto }),
    actualizarEmpresa: vi.fn(async (sieCode: string, dto: NuevaEmpresaApi) => ({ sie_code: sieCode, ...dto })),
  };
}

function crearServicio(
  repo: IEmpresaRepository,
  auth: ReturnType<typeof fakeAuthRepo> = fakeAuthRepo(),
  roles: ReturnType<typeof fakeRoleRepo> = fakeRoleRepo(),
  personas: ReturnType<typeof fakePersonaClient> = fakePersonaClient(),
  empresas: ReturnType<typeof fakeEmpresaClient> = fakeEmpresaClient(),
) {
  return new EmpresaApplicationService(
    repo,
    auth as unknown as IAuthRepository,
    roles as unknown as IRoleRepository,
    personas as unknown as IPersonaClient,
    empresas as unknown as IEmpresaClient,
  );
}

describe("EmpresaApplicationService.crear", () => {
  it("crea la empresa normalizando datos y con defaults seguros", async () => {
    const repo = new FakeEmpresaRepo();
    const service = crearServicio(repo);

    const empresa = await service.crear(INPUT_BASE, "admin@iimp.org.pe");

    expect(empresa.razonSocial).toBe("Minera Cordillera S.A.C.");
    expect(empresa.ruc).toBe("20601234567");
    expect(empresa.tipoComprobante).toBe(TIPOS_COMPROBANTE.FACTURA);
    expect(empresa.estado).toBe(ESTADOS_EMPRESA.ACTIVA);
    expect(empresa.cuentaCreada).toBe(false);
    expect(empresa.primerAccesoCompletado).toBe(false);
    expect(empresa.creadoPor).toBe("admin@iimp.org.pe");
  });

  it("rechaza razon social vacia", async () => {
    const service = crearServicio(new FakeEmpresaRepo());
    await expect(service.crear({ ...INPUT_BASE, razonSocial: "   " }, null)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rechaza RUC que no tiene 11 digitos", async () => {
    const service = crearServicio(new FakeEmpresaRepo());
    await expect(service.crear({ ...INPUT_BASE, ruc: "2060123456" }, null)).rejects.toMatchObject({
      status: 400,
    });
    await expect(service.crear({ ...INPUT_BASE, ruc: "2060123456A" }, null)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rechaza RUC duplicado con 409", async () => {
    const repo = new FakeEmpresaRepo();
    repo.seed({ ruc: "20601234567", razonSocial: "Existente S.A.C." });
    const service = crearServicio(repo);

    await expect(service.crear(INPUT_BASE, null)).rejects.toMatchObject({
      status: 409,
      code: API_ERROR_CODES.CONFLICT,
    });
  });

  it("rechaza correos invalidos", async () => {
    const service = crearServicio(new FakeEmpresaRepo());
    await expect(
      service.crear({ ...INPUT_BASE, emailContacto: "correo-malo" }, null),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rechaza tipo de comprobante invalido y acepta boleta", async () => {
    const service = crearServicio(new FakeEmpresaRepo());
    await expect(
      service.crear({ ...INPUT_BASE, tipoComprobante: "nota-credito" }, null),
    ).rejects.toMatchObject({ status: 400 });

    const empresa = await service.crear({ ...INPUT_BASE, tipoComprobante: TIPOS_COMPROBANTE.BOLETA }, null);
    expect(empresa.tipoComprobante).toBe(TIPOS_COMPROBANTE.BOLETA);
  });

  it("alimenta servicio-persona: guarda el sie_code de la empresa creada en la fuente", async () => {
    const repo = new FakeEmpresaRepo();
    const empresas = fakeEmpresaClient();
    const service = crearServicio(repo, fakeAuthRepo(), fakeRoleRepo(), fakePersonaClient(), empresas);

    const empresa = await service.crear({ ...INPUT_BASE, direccionFiscal: "Av. Los Ingenieros 245", telefono: "+51987654321" }, null);

    expect(empresas.crearEmpresa).toHaveBeenCalledWith(expect.objectContaining({
      documento: "20601234567",
      id_tipo_documento: TIPOS_DOCUMENTO_EMPRESA.RUC,
      pais: UBIGEO_PAIS_PERU,
    }));
    expect(empresa.sieCode).toBe("E0000000123");
  });

  it("alimenta servicio-persona: reutiliza la empresa existente sin crearla", async () => {
    const repo = new FakeEmpresaRepo();
    const empresas = fakeEmpresaClient({
      existente: {
        sie_code: "E9",
        nombre: "Minera Cordillera S.A.C.",
        direccion: "Av. Los Ingenieros 245",
        correo: INPUT_BASE.emailContacto,
        telefono: "+51987654321",
      },
    });
    const service = crearServicio(repo, fakeAuthRepo(), fakeRoleRepo(), fakePersonaClient(), empresas);

    const empresa = await service.crear({ ...INPUT_BASE, direccionFiscal: "Av. Los Ingenieros 245", telefono: "+51987654321" }, null);

    expect(empresas.crearEmpresa).not.toHaveBeenCalled();
    expect(empresas.actualizarEmpresa).not.toHaveBeenCalled();
    expect(empresa.sieCode).toBe("E9");
  });

  it("si la fuente falla, la ficha local se crea igual sin sie_code", async () => {
    const repo = new FakeEmpresaRepo();
    const empresas = fakeEmpresaClient();
    empresas.crearEmpresa.mockRejectedValueOnce(new Error("fuente no disponible"));
    const service = crearServicio(repo, fakeAuthRepo(), fakeRoleRepo(), fakePersonaClient(), empresas);

    const empresa = await service.crear({ ...INPUT_BASE, direccionFiscal: "Av. Los Ingenieros 245", telefono: "+51987654321" }, null);

    expect(empresa.sieCode).toBeNull();
  });

  it("usa el sieCode del padron sin consultar ni crear en la fuente", async () => {
    const repo = new FakeEmpresaRepo();
    const empresas = fakeEmpresaClient();
    const service = crearServicio(repo, fakeAuthRepo(), fakeRoleRepo(), fakePersonaClient(), empresas);

    const empresa = await service.crear({ ...INPUT_BASE, sieCode: "E0000003804", direccionFiscal: "Av. Los Ingenieros 245", telefono: "+51987654321" }, null);

    expect(empresas.buscarPorDocumento).not.toHaveBeenCalled();
    expect(empresas.crearEmpresa).not.toHaveBeenCalled();
    expect(empresa.sieCode).toBe("E0000003804");
  });

  it("sin datos minimos (direccion/telefono) no consulta la fuente", async () => {
    const empresas = fakeEmpresaClient();
    const service = crearServicio(new FakeEmpresaRepo(), fakeAuthRepo(), fakeRoleRepo(), fakePersonaClient(), empresas);

    await service.crear(INPUT_BASE, null);

    expect(empresas.buscarPorDocumento).not.toHaveBeenCalled();
    expect(empresas.crearEmpresa).not.toHaveBeenCalled();
  });
});

describe("EmpresaApplicationService.actualizar", () => {
  it("404 si la empresa no existe", async () => {
    const service = crearServicio(new FakeEmpresaRepo());
    await expect(service.actualizar("no-existe", { razonSocial: "X S.A.C." })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("actualiza solo los campos enviados", async () => {
    const repo = new FakeEmpresaRepo();
    const creada = repo.seed({
      ruc: "20601234567",
      razonSocial: "Minera Cordillera S.A.C.",
      emailFacturacion: "viejo@mineracordillera.pe",
    });
    const service = crearServicio(repo);

    const empresa = await service.actualizar(creada.id, { emailFacturacion: "nuevo@mineracordillera.pe" });

    expect(empresa.emailFacturacion).toBe("nuevo@mineracordillera.pe");
    expect(empresa.razonSocial).toBe("Minera Cordillera S.A.C.");
  });

  it("rechaza cambiar el RUC al de otra empresa", async () => {
    const repo = new FakeEmpresaRepo();
    repo.seed({ ruc: "20601234567", razonSocial: "Uno S.A.C." });
    const dos = repo.seed({ ruc: "20551122334", razonSocial: "Dos S.A.C." });
    const service = crearServicio(repo);

    await expect(service.actualizar(dos.id, { ruc: "20601234567" })).rejects.toMatchObject({ status: 409 });
  });
});

describe("EmpresaApplicationService estados", () => {
  it("cambia a inactiva y rechaza estados invalidos", async () => {
    const repo = new FakeEmpresaRepo();
    const creada = repo.seed({ ruc: "20601234567", razonSocial: "Minera Cordillera S.A.C." });
    const service = crearServicio(repo);

    const inactiva = await service.cambiarEstado(creada.id, ESTADOS_EMPRESA.INACTIVA);
    expect(inactiva.estado).toBe(ESTADOS_EMPRESA.INACTIVA);

    await expect(service.cambiarEstado(creada.id, "borrada")).rejects.toMatchObject({ status: 400 });
  });

  it("marca cuenta creada y datos validados", async () => {
    const repo = new FakeEmpresaRepo();
    const creada = repo.seed({ ruc: "20601234567", razonSocial: "Minera Cordillera S.A.C." });
    const service = crearServicio(repo);

    const conCuenta = await service.marcarCuentaCreada(creada.id);
    expect(conCuenta.cuentaCreada).toBe(true);

    const validada = await service.marcarDatosValidados(creada.id);
    expect(validada.primerAccesoCompletado).toBe(true);
    expect(validada.datosValidadosEn).toBeInstanceOf(Date);
  });
});

describe("EmpresaApplicationService.listar", () => {
  it("delega la paginacion y busqueda al repositorio", async () => {
    const repo = new FakeEmpresaRepo();
    repo.seed({ ruc: "20601234567", razonSocial: "Minera Cordillera S.A.C." });
    const service = crearServicio(repo);

    const resultado = await service.listar({ page: 2, perPage: 10, search: "cordillera" });

    expect(resultado.total).toBe(1);
    expect(repo.listarCalls[0]).toEqual({ page: 2, perPage: 10, search: "cordillera" });
  });
});

describe("EmpresaApplicationService autorizacion (capa de aplicacion)", () => {
  it("autorizarLectura permite empresas:view y admin:full; rechaza sin permiso", () => {
    const service = crearServicio(new FakeEmpresaRepo());

    expect(() => service.autorizarLectura([PERMISSIONS.EMPRESAS_VIEW])).not.toThrow();
    expect(() => service.autorizarLectura([PERMISSIONS.ADMIN_FULL])).not.toThrow();
    expect(() => service.autorizarLectura([PERMISSIONS.PAGOS_VIEW])).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("autorizarGestion permite empresas:manage y admin:full; rechaza view-only", () => {
    const service = crearServicio(new FakeEmpresaRepo());

    expect(() => service.autorizarGestion([PERMISSIONS.EMPRESAS_MANAGE])).not.toThrow();
    expect(() => service.autorizarGestion([PERMISSIONS.ADMIN_FULL])).not.toThrow();
    expect(() => service.autorizarGestion([PERMISSIONS.EMPRESAS_VIEW])).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });
});

const FILA_BASE: FilaCargaEmpresa = {
  numero: 2,
  ruc: "20601234567",
  razonSocial: "Minera Cordillera S.A.C.",
  nombreComercial: "",
  direccionFiscal: "Av. Los Ingenieros 245, Lima",
  telefono: "",
  emailContacto: "contacto@mineracordillera.pe",
  emailFacturacion: "",
  representanteLegalNombre: "Jorge Quispe Ramos",
  representanteLegalDni: "45871233",
  tipoComprobante: "factura",
  sitioWeb: "",
};

describe("EmpresaApplicationService.previsualizarCarga", () => {
  it("marca como lista una fila completa", async () => {
    const service = crearServicio(new FakeEmpresaRepo());
    const { filas, resumen } = await service.previsualizarCarga([FILA_BASE]);

    expect(filas[0]?.estado).toBe(ESTADOS_FILA_CARGA.LISTA);
    expect(resumen).toEqual({ listas: 1, advertencias: 0, errores: 0 });
  });

  it("marca error por razon social vacia y RUC invalido", async () => {
    const service = crearServicio(new FakeEmpresaRepo());
    const { filas, resumen } = await service.previsualizarCarga([
      { ...FILA_BASE, razonSocial: "  ", ruc: "123" },
    ]);

    expect(filas[0]?.estado).toBe(ESTADOS_FILA_CARGA.ERROR);
    expect(filas[0]?.mensajes.join(" ")).toContain("Razon social obligatoria");
    expect(filas[0]?.mensajes.join(" ")).toContain("RUC invalido");
    expect(resumen.errores).toBe(1);
  });

  it("detecta duplicados dentro del archivo", async () => {
    const service = crearServicio(new FakeEmpresaRepo());
    const { filas } = await service.previsualizarCarga([
      FILA_BASE,
      { ...FILA_BASE, numero: 3, ruc: "206-01234567" },
    ]);

    expect(filas[0]?.estado).toBe(ESTADOS_FILA_CARGA.LISTA);
    expect(filas[1]?.estado).toBe(ESTADOS_FILA_CARGA.ERROR);
    expect(filas[1]?.mensajes.join(" ")).toContain("Duplicado en el archivo (fila 2)");
  });

  it("detecta RUC ya registrado en la base de datos", async () => {
    const repo = new FakeEmpresaRepo();
    repo.seed({ ruc: "20601234567", razonSocial: "Existente S.A.C." });
    const service = crearServicio(repo);

    const { filas } = await service.previsualizarCarga([FILA_BASE]);
    expect(filas[0]?.estado).toBe(ESTADOS_FILA_CARGA.ERROR);
    expect(filas[0]?.mensajes.join(" ")).toContain("RUC ya registrado: Existente S.A.C.");
  });

  it("advierte cuando faltan datos contractuales", async () => {
    const service = crearServicio(new FakeEmpresaRepo());
    const { filas, resumen } = await service.previsualizarCarga([
      { ...FILA_BASE, direccionFiscal: "", representanteLegalNombre: "", representanteLegalDni: "" },
    ]);

    expect(filas[0]?.estado).toBe(ESTADOS_FILA_CARGA.ADVERTENCIA);
    expect(filas[0]?.mensajes.join(" ")).toContain("Faltan datos contractuales");
    expect(resumen.advertencias).toBe(1);
  });

  it("marca error con tipo de comprobante invalido", async () => {
    const service = crearServicio(new FakeEmpresaRepo());
    const { filas } = await service.previsualizarCarga([{ ...FILA_BASE, tipoComprobante: "nota-credito" }]);

    expect(filas[0]?.estado).toBe(ESTADOS_FILA_CARGA.ERROR);
    expect(filas[0]?.mensajes.join(" ")).toContain("Tipo de comprobante invalido");
  });

  it("rechaza archivo sin filas y con mas de 500 filas", async () => {
    const service = crearServicio(new FakeEmpresaRepo());
    await expect(service.previsualizarCarga([])).rejects.toMatchObject({ status: 400 });

    const muchas = Array.from({ length: 501 }, (_, i) => ({ ...FILA_BASE, numero: i + 2, ruc: `20601234${String(i).padStart(3, "0")}` }));
    await expect(service.previsualizarCarga(muchas)).rejects.toMatchObject({ status: 400 });
  });
});

describe("EmpresaApplicationService.importarCarga", () => {
  it("crea listas y advertencias, y omite las filas con error", async () => {
    const repo = new FakeEmpresaRepo();
    const service = crearServicio(repo);

    const resultado = await service.importarCarga(
      [
        FILA_BASE,
        { ...FILA_BASE, numero: 3, ruc: "20551122334", razonSocial: "Constructora Andina S.A.", representanteLegalNombre: "" },
        { ...FILA_BASE, numero: 4, ruc: "20", razonSocial: "RUC Malo S.A.C." },
      ],
      "admin@iimp.org.pe",
    );

    expect(resultado).toEqual({ creadas: 2, omitidas: 1 });
    expect((await repo.findByRuc("20601234567"))?.razonSocial).toBe("Minera Cordillera S.A.C.");
    expect((await repo.findByRuc("20551122334"))?.creadoPor).toBe("admin@iimp.org.pe");
  });
});

describe("EmpresaApplicationService.crearCuenta", () => {
  const empresaBase = {
    ruc: "20601234567",
    razonSocial: "Minera Cordillera S.A.C.",
    emailContacto: "contacto@mineracordillera.pe",
    representanteLegalNombre: "Jorge Quispe Ramos",
    telefono: "999888777",
  };

  it("crea la cuenta con credencial temporal, vinculo a la empresa y envia el correo", async () => {
    const repo = new FakeEmpresaRepo();
    const creada = repo.seed(empresaBase);
    const auth = fakeAuthRepo();
    const service = crearServicio(repo, auth);

    const resultado = await service.crearCuenta(creada.id);

    expect(resultado).toEqual({ email: "contacto@mineracordillera.pe", emailEnviado: true });
    expect(auth.llamadas.creados).toHaveLength(1);
    const datos = auth.llamadas.creados[0] as Record<string, unknown>;
    expect(datos.userId).toBe("user|contacto@mineracordillera.pe");
    expect(datos.empresaId).toBe(creada.id);
    expect(datos.debeCambiarPassword).toBe(true);
    expect(datos.roleId).toBe("rol-cliente");
    expect((await repo.findById(creada.id))?.cuentaCreada).toBe(true);
  });

  it("409 si la cuenta ya fue creada", async () => {
    const repo = new FakeEmpresaRepo();
    const creada = repo.seed({ ...empresaBase, cuentaCreada: true });
    const service = crearServicio(repo);

    await expect(service.crearCuenta(creada.id)).rejects.toMatchObject({ status: 409 });
  });

  it("400 si la empresa no tiene correo", async () => {
    const repo = new FakeEmpresaRepo();
    const creada = repo.seed({ ruc: "20601234567", razonSocial: "Sin Correo S.A.C." });
    const service = crearServicio(repo);

    await expect(service.crearCuenta(creada.id)).rejects.toMatchObject({ status: 400 });
  });

  it("409 si el correo ya tiene una cuenta habilitada", async () => {
    const repo = new FakeEmpresaRepo();
    const creada = repo.seed(empresaBase);
    const auth = fakeAuthRepo({ existeEmail: true });
    const service = crearServicio(repo, auth);

    await expect(service.crearCuenta(creada.id)).rejects.toMatchObject({ status: 409 });
  });
});

describe("EmpresaApplicationService.reenviarCredenciales", () => {
  it("regenera la contrasena y exige el cambio en el proximo ingreso", async () => {
    const repo = new FakeEmpresaRepo();
    const creada = repo.seed({
      ruc: "20601234567",
      razonSocial: "Minera Cordillera S.A.C.",
      emailContacto: "contacto@mineracordillera.pe",
      cuentaCreada: true,
      primerAccesoCompletado: true,
    });
    const auth = fakeAuthRepo({ usuarioExistente: true });
    const service = crearServicio(repo, auth);

    const resultado = await service.reenviarCredenciales(creada.id);

    expect(resultado.emailEnviado).toBe(true);
    expect(auth.llamadas.passwords).toEqual(["hash:TempPass123"]);
    expect(auth.llamadas.flags).toEqual([true]);
    expect((await repo.findById(creada.id))?.primerAccesoCompletado).toBe(false);
  });

  it("409 si la empresa aun no tiene cuenta y 404 si la cuenta no existe", async () => {
    const repo = new FakeEmpresaRepo();
    const sinCuenta = repo.seed({ ruc: "20601234567", razonSocial: "Sin Cuenta S.A.C.", emailContacto: "x@empresa.pe" });
    const service = crearServicio(repo);
    await expect(service.reenviarCredenciales(sinCuenta.id)).rejects.toMatchObject({ status: 409 });

    const conCuenta = repo.seed({ ruc: "20551122334", razonSocial: "Con Cuenta S.A.C.", emailContacto: "y@empresa.pe", cuentaCreada: true });
    const serviceSinUsuario = crearServicio(repo, fakeAuthRepo({ usuarioExistente: false }));
    await expect(serviceSinUsuario.reenviarCredenciales(conCuenta.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("EmpresaApplicationService (primer ingreso del Portal)", () => {
  it("obtenerDatosPortal: 404 si el usuario no tiene empresa vinculada", async () => {
    const service = crearServicio(new FakeEmpresaRepo(), fakeAuthRepo());
    await expect(service.obtenerDatosPortal("x@empresa.pe")).rejects.toMatchObject({ status: 404 });
  });

  it("obtenerDatosPortal devuelve la empresa vinculada al usuario", async () => {
    const repo = new FakeEmpresaRepo();
    const creada = repo.seed({ ruc: "20601234567", razonSocial: "Minera Cordillera S.A.C." });
    const service = crearServicio(repo, fakeAuthRepo({ empresaPortal: { empresaId: creada.id, primerAccesoCompletado: false } }));

    const empresa = await service.obtenerDatosPortal("contacto@mineracordillera.pe");

    expect(empresa.id).toBe(creada.id);
  });

  it("validarDatosPortal actualiza los datos contractuales y marca el primer acceso", async () => {
    const repo = new FakeEmpresaRepo();
    const creada = repo.seed({ ruc: "20601234567", razonSocial: "Minera Cordillera", direccionFiscal: null, representanteLegalNombre: null });
    const service = crearServicio(repo, fakeAuthRepo({ empresaPortal: { empresaId: creada.id, primerAccesoCompletado: false } }));

    const empresa = await service.validarDatosPortal("contacto@mineracordillera.pe", {
      ruc: "20601234567",
      razonSocial: "Minera Cordillera S.A.C.",
      direccionFiscal: "Av. Los Ingenieros 245, Lima",
      representanteLegalNombre: "Jorge Quispe Ramos",
      representanteLegalDni: "45871233",
      tipoComprobante: "factura",
    });

    expect(empresa.razonSocial).toBe("Minera Cordillera S.A.C.");
    expect(empresa.direccionFiscal).toBe("Av. Los Ingenieros 245, Lima");
    expect(empresa.primerAccesoCompletado).toBe(true);
    expect(empresa.datosValidadosEn).toBeInstanceOf(Date);
  });
});

/* ================================================================
   Servicio-persona: busqueda y registro de la relacion usuario - empresa
   ================================================================ */

const EMPRESA_FUENTE = {
  nombre: "Acme Consultores S.A.C.",
  idTipoDocumento: TIPOS_DOCUMENTO_EMPRESA.RUC,
  documento: "20123456789",
  direccion: "Av. Javier Prado 1234, San Isidro",
  correo: "contacto@acme.com",
  telefono: "+51987654321",
  pais: UBIGEO_PAIS_PERU,
};

const PERSONA_CONTACTO = {
  tipoDocumento: TIPOS_DOCUMENTO_PERSONA.DNI,
  documento: "72183002",
  apellidoPaterno: "Perez",
  apellidoMaterno: "Gomez",
  nombres: "Juan",
  celular: "+51987654321",
};

describe("EmpresaApplicationService.buscarEmpresasFuente", () => {
  it("delega la busqueda en servicio-persona", async () => {
    const empresas = fakeEmpresaClient();
    const service = crearServicio(new FakeEmpresaRepo(), fakeAuthRepo(), fakeRoleRepo(), fakePersonaClient(), empresas);

    await service.buscarEmpresasFuente("ACME");

    expect(empresas.buscarEmpresas).toHaveBeenCalledWith("ACME");
  });
});

describe("EmpresaApplicationService.registrarCuentaEmpresa", () => {
  it("reutiliza empresa y persona existentes y crea la relacion con sus sie_code", async () => {
    const repo = new FakeEmpresaRepo();
    const auth = fakeAuthRepo();
    const personas = fakePersonaClient({ existente: { sie_code: "P0000000001", documento: "72183002" } });
    const empresas = fakeEmpresaClient({ existente: { sie_code: "E0000000001", documento: "20123456789", nombre: "ACME" } });
    const service = crearServicio(repo, auth, fakeRoleRepo(), personas, empresas);

    const r = await service.registrarCuentaEmpresa({
      empresa: EMPRESA_FUENTE,
      persona: PERSONA_CONTACTO,
      email: "Juan@Acme.com",
      creadoPor: "admin@iimp.org.pe",
    });

    expect(r.empresaCreadaEnFuente).toBe(false);
    expect(r.empresaActualizadaEnFuente).toBe(true);
    expect(r.personaCreadaEnFuente).toBe(false);
    expect(r.sieCodeEmpresa).toBe("E0000000001");
    expect(r.sieCodePersona).toBe("P0000000001");
    expect(empresas.crearEmpresa).not.toHaveBeenCalled();
    expect(empresas.actualizarEmpresa).toHaveBeenCalledWith("E0000000001", expect.objectContaining({
      nombre: "Acme Consultores S.A.C.",
      documento: "20123456789",
      direccion: "Av. Javier Prado 1234, San Isidro",
    }));
    expect(personas.crearPersona).not.toHaveBeenCalled();
    expect(personas.actualizarPersona).toHaveBeenCalledWith("P0000000001", expect.objectContaining({
      apellido_paterno: "Perez",
      correo: "juan@acme.com",
    }));
    expect(auth.crearUsuario).toHaveBeenCalledWith(expect.objectContaining({
      email: "juan@acme.com",
      sieCode: "P0000000001",
      idEmpresa: "E0000000001",
      nombreEmpresa: "Acme Consultores S.A.C.",
      debeCambiarPassword: true,
    }));
    const ficha = await repo.findByRuc("20123456789");
    expect(ficha?.sieCode).toBe("E0000000001");
    expect(ficha?.cuentaCreada).toBe(true);
    expect(ficha?.creadoPor).toBe("admin@iimp.org.pe");
  });

  it("crea la empresa en la fuente cuando no existe y usa el sie_code devuelto", async () => {
    const repo = new FakeEmpresaRepo();
    const empresas = fakeEmpresaClient();
    const service = crearServicio(repo, fakeAuthRepo(), fakeRoleRepo(), fakePersonaClient({ existente: { sie_code: "P1" } }), empresas);

    const r = await service.registrarCuentaEmpresa({ empresa: EMPRESA_FUENTE, persona: PERSONA_CONTACTO, email: "juan@acme.com" });

    expect(r.empresaCreadaEnFuente).toBe(true);
    expect(r.sieCodeEmpresa).toBe("E0000000123");
    expect(empresas.crearEmpresa).toHaveBeenCalledWith(expect.objectContaining({
      documento: "20123456789",
      id_tipo_documento: TIPOS_DOCUMENTO_EMPRESA.RUC,
      pais: UBIGEO_PAIS_PERU,
    }));
  });

  it("crea la persona de contacto en la fuente cuando no existe", async () => {
    const personas = fakePersonaClient();
    const service = crearServicio(new FakeEmpresaRepo(), fakeAuthRepo(), fakeRoleRepo(), personas, fakeEmpresaClient({ existente: { sie_code: "E1" } }));

    const r = await service.registrarCuentaEmpresa({ empresa: EMPRESA_FUENTE, persona: PERSONA_CONTACTO, email: "juan@acme.com" });

    expect(r.personaCreadaEnFuente).toBe(true);
    expect(r.sieCodePersona).toBe("P0000012345");
    expect(personas.crearPersona).toHaveBeenCalledWith(expect.objectContaining({
      documento: "72183002",
      correo: "juan@acme.com",
    }));
  });

  it("reutiliza la ficha local existente y solo agrega su sie_code", async () => {
    const repo = new FakeEmpresaRepo();
    repo.seed({ ruc: "20123456789", razonSocial: "Existente S.A.C.", cuentaCreada: true, sieCode: null });
    const service = crearServicio(repo, fakeAuthRepo(), fakeRoleRepo(), fakePersonaClient({ existente: { sie_code: "P1" } }), fakeEmpresaClient({ existente: { sie_code: "E9" } }));

    const r = await service.registrarCuentaEmpresa({ empresa: EMPRESA_FUENTE, persona: PERSONA_CONTACTO, email: "juan@acme.com" });

    const ficha = await repo.findByRuc("20123456789");
    expect(r.empresaId).toBe(ficha?.id);
    expect(ficha?.sieCode).toBe("E9");
    expect(ficha?.razonSocial).toBe("Existente S.A.C.");
  });

  it("no actualiza la fuente cuando los datos de la empresa coinciden", async () => {
    const repo = new FakeEmpresaRepo();
    const empresas = fakeEmpresaClient({
      existente: {
        sie_code: "E1",
        nombre: EMPRESA_FUENTE.nombre,
        direccion: EMPRESA_FUENTE.direccion,
        correo: EMPRESA_FUENTE.correo,
        telefono: EMPRESA_FUENTE.telefono,
      },
    });
    const service = crearServicio(repo, fakeAuthRepo(), fakeRoleRepo(), fakePersonaClient({ existente: { sie_code: "P1" } }), empresas);

    const r = await service.registrarCuentaEmpresa({ empresa: EMPRESA_FUENTE, persona: PERSONA_CONTACTO, email: "juan@acme.com" });

    expect(r.empresaActualizadaEnFuente).toBe(false);
    expect(empresas.actualizarEmpresa).not.toHaveBeenCalled();
  });

  it("rechaza un correo que ya tiene cuenta con 409", async () => {
    const service = crearServicio(
      new FakeEmpresaRepo(),
      fakeAuthRepo({ existeEmail: true }),
      fakeRoleRepo(),
      fakePersonaClient({ existente: { sie_code: "P1" } }),
      fakeEmpresaClient({ existente: { sie_code: "E1" } }),
    );

    await expect(
      service.registrarCuentaEmpresa({ empresa: EMPRESA_FUENTE, persona: PERSONA_CONTACTO, email: "juan@acme.com" }),
    ).rejects.toMatchObject({ status: 409, code: API_ERROR_CODES.CONFLICT });
  });

  it("valida el RUC de la empresa (11 digitos)", async () => {
    const service = crearServicio(new FakeEmpresaRepo());

    await expect(
      service.registrarCuentaEmpresa({ empresa: { ...EMPRESA_FUENTE, documento: "123" }, persona: PERSONA_CONTACTO, email: "juan@acme.com" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("valida el documento de la persona de contacto", async () => {
    const service = crearServicio(new FakeEmpresaRepo());

    await expect(
      service.registrarCuentaEmpresa({ empresa: EMPRESA_FUENTE, persona: { ...PERSONA_CONTACTO, documento: "123" }, email: "juan@acme.com" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
