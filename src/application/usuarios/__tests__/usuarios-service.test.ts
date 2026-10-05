import { describe, expect, it, vi } from "vitest";
import { UsuariosApplicationService } from "../usuarios-service";
import type { IUsuarioRepository } from "@/domain/ports/usuario-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IRoleRepository } from "@/domain/ports/role-repository";
import type { IPersonaClient, NuevaPersonaApi } from "@/domain/ports/persona-client";
import type { EmpresaEntity } from "@/domain/models/empresa";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

vi.mock("@/lib/server/email", () => ({
  enviarEmailPlantilla: vi.fn(async () => true),
  sendEmail: vi.fn(async () => true),
}));

vi.mock("@/lib/server/utils/password", () => ({
  hashPassword: (plano: string) => `hash:${plano}`,
  generarPasswordTemporal: () => "TempPass123",
}));

function fakeRepos() {
  const usuarioRepo = {
    listarUsuariosPortal: vi.fn(async () => []),
    findUsuarioPortalById: vi.fn(async () => null),
    actualizarUsuarioPortal: vi.fn(),
    actualizarPasswordUsuarioPortal: vi.fn(async () => {}),
  } as unknown as IUsuarioRepository;
  const authRepo = { existeEmail: vi.fn(async () => false), crearUsuario: vi.fn(async () => {}) } as unknown as IAuthRepository;
  const empresaRepo = {
    findById: vi.fn(async () => null),
    findByRuc: vi.fn(async () => null),
  } as unknown as IEmpresaRepository;
  const roleRepo = {
    findById: vi.fn(async () => ({ id: "rol-x", nombre: "x", descripcion: null, permisos: [] })),
    findByNombre: vi.fn(async () => ({ id: "rol-cliente", nombre: "cliente", descripcion: null, permisos: [], usuarios: [] })),
  } as unknown as IRoleRepository;
  const personaClient = {
    buscarPorDocumento: vi.fn(async () => null),
    buscarPersonas: vi.fn(async () => []),
    crearPersona: vi.fn(async (dto: NuevaPersonaApi) => ({ sie_code: "P0000012345", ...dto })),
  } as unknown as IPersonaClient;
  return { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient };
}

/** Empresa elegida desde la API de entidades. */
const empresaAcceso = { idEmpresa: "E0000003804", nombreEmpresa: "Gloria S.A.", ruc: "20123456789" };

const inputBase = {
  email: "Juan@Empresa.com",
  tipoDocumento: "1",
  documento: "12345678",
  apellidoPaterno: "PEREZ",
  nombres: "JUAN",
};

/** Fila de usuario del portal para los tests. */
function usuarioFila(overrides: Partial<import("@/domain/ports/usuario-repository").UsuarioPortalRow> = {}) {
  return {
    id: "u1",
    email: "juan@empresa.com",
    nombre: "",
    apellidos: "",
    telefono: null,
    rol: "cliente",
    empresaId: null,
    idEmpresa: "E0000003804",
    empresa: "Gloria S.A.",
    sieCode: "P0000012345",
    debeCambiarPassword: true,
    ...overrides,
  };
}

describe("UsuariosApplicationService.crear (servicio-persona)", () => {
  it("crea la persona en la fuente y persiste sie_code + correo + empresa SIE", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    const r = await svc.crear(empresaAcceso, inputBase);

    expect(r).toEqual({ email: "juan@empresa.com", creado: true, emailEnviado: true, error: null });
    expect(personaClient.crearPersona).toHaveBeenCalledWith(expect.objectContaining({
      apellido_paterno: "PEREZ",
      nombres: "JUAN",
      id_tipo_documento: "1",
      documento: "12345678",
      correo: "juan@empresa.com",
    }));
    expect(authRepo.crearUsuario).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user|juan@empresa.com",
      email: "juan@empresa.com",
      sieCode: "P0000012345",
      idEmpresa: "E0000003804",
      nombreEmpresa: "Gloria S.A.",
      debeCambiarPassword: true,
      password: "hash:TempPass123",
    }));
  });

  it("vincula la FK local cuando existe una empresa con el RUC", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    vi.mocked(empresaRepo.findByRuc).mockResolvedValue({ id: "emp-1", razonSocial: "Gloria S.A." } as EmpresaEntity);
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    await svc.crear(empresaAcceso, inputBase);

    expect(empresaRepo.findByRuc).toHaveBeenCalledWith("20123456789");
    expect(authRepo.crearUsuario).toHaveBeenCalledWith(expect.objectContaining({ empresaId: "emp-1" }));
  });

  it("reutiliza la persona existente (no crea duplicado en la fuente)", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    vi.mocked(personaClient.buscarPorDocumento).mockResolvedValue({ sie_code: "P0000099999", documento: "12345678" });
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    const r = await svc.crear(empresaAcceso, inputBase);

    expect(r.creado).toBe(true);
    expect(personaClient.crearPersona).not.toHaveBeenCalled();
    expect(authRepo.crearUsuario).toHaveBeenCalledWith(expect.objectContaining({ sieCode: "P0000099999" }));
  });

  it("rechaza un DNI invalido sin llamar a la fuente", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    const r = await svc.crear(empresaAcceso, { ...inputBase, documento: "123" });

    expect(r.creado).toBe(false);
    expect(r.error).toMatch(/8 digitos/i);
    expect(personaClient.buscarPorDocumento).not.toHaveBeenCalled();
  });

  it("rechaza correo invalido sin tocar repositorios", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    const r = await svc.crear(empresaAcceso, { ...inputBase, email: "no-es-correo" });

    expect(r.creado).toBe(false);
    expect(r.error).toBe("Correo invalido");
    expect(authRepo.existeEmail).not.toHaveBeenCalled();
  });

  it("no duplica accesos con el mismo correo", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    vi.mocked(authRepo.existeEmail).mockResolvedValue(true);
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    const r = await svc.crear(empresaAcceso, inputBase);

    expect(r.creado).toBe(false);
    expect(r.error).toMatch(/ya tiene una cuenta/i);
    expect(personaClient.buscarPorDocumento).not.toHaveBeenCalled();
    expect(authRepo.crearUsuario).not.toHaveBeenCalled();
  });

  it("exige empresa (codigo SIE y razon social)", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    await expect(svc.crear({ idEmpresa: "", nombreEmpresa: "" }, inputBase)).rejects.toMatchObject({ status: 400 });
  });

  it("permite asignar un rol distinto al de cliente", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    vi.mocked(roleRepo.findById).mockResolvedValue({ id: "rol-legal", nombre: "legal", descripcion: null, permisos: [], usuarios: [] });
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    const r = await svc.crear(empresaAcceso, { ...inputBase, rolId: "rol-legal" });

    expect(r.creado).toBe(true);
    expect(roleRepo.findById).toHaveBeenCalledWith("rol-legal");
    expect(authRepo.crearUsuario).toHaveBeenCalledWith(expect.objectContaining({ roleId: "rol-legal" }));
  });

  it("falla si el rol solicitado no existe", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    vi.mocked(roleRepo.findById).mockResolvedValue(null);
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    await expect(svc.crear(empresaAcceso, { ...inputBase, rolId: "rol-x" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("UsuariosApplicationService.buscarPersonas", () => {
  it("delega la busqueda en servicio-persona", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    vi.mocked(personaClient.buscarPersonas).mockResolvedValue([{ sie_code: "P1", nombre_completo: "PEREZ, JUAN" }]);
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    const r = await svc.buscarPersonas("PEREZ");

    expect(personaClient.buscarPersonas).toHaveBeenCalledWith("PEREZ");
    expect(r).toHaveLength(1);
  });
});

describe("UsuariosApplicationService.crearLote", () => {
  it("devuelve el resultado por fila (ok y duplicado)", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    vi.mocked(authRepo.existeEmail).mockImplementation(async (email: string) => email === "dup@empresa.com");
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    const r = await svc.crearLote(empresaAcceso, [
      { ...inputBase, email: "nuevo@empresa.com" },
      { ...inputBase, email: "dup@empresa.com", documento: "87654321" },
    ]);

    expect(r.resultados).toHaveLength(2);
    expect(r.resultados[0]).toMatchObject({ email: "nuevo@empresa.com", creado: true });
    expect(r.resultados[1]).toMatchObject({ email: "dup@empresa.com", creado: false });
    expect(authRepo.crearUsuario).toHaveBeenCalledTimes(1);
  });
});

describe("UsuariosApplicationService.crearCuentaDesdePersona", () => {
  it("crea la cuenta local con el sie_code de la persona existente", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    const r = await svc.crearCuentaDesdePersona({
      ...empresaAcceso,
      sieCode: "P0000099999",
      email: "maria@empresa.com",
    });

    expect(r).toEqual({ email: "maria@empresa.com", creado: true, emailEnviado: true, error: null });
    expect(personaClient.crearPersona).not.toHaveBeenCalled();
    expect(authRepo.crearUsuario).toHaveBeenCalledWith(expect.objectContaining({
      email: "maria@empresa.com",
      sieCode: "P0000099999",
      idEmpresa: "E0000003804",
      roleId: "rol-cliente",
    }));
  });

  it("no duplica cuentas con el mismo correo", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    vi.mocked(authRepo.existeEmail).mockResolvedValue(true);
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    const r = await svc.crearCuentaDesdePersona({ ...empresaAcceso, sieCode: "P1", email: "dup@empresa.com" });

    expect(r.creado).toBe(false);
    expect(authRepo.crearUsuario).not.toHaveBeenCalled();
  });
});

describe("UsuariosApplicationService.actualizar", () => {
  it("asigna la empresa (SIE) al acceso local", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    vi.mocked(usuarioRepo.findUsuarioPortalById).mockResolvedValue(usuarioFila());
    vi.mocked(usuarioRepo.actualizarUsuarioPortal).mockResolvedValue(usuarioFila());
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    await svc.actualizar("u1", empresaAcceso);

    expect(usuarioRepo.actualizarUsuarioPortal).toHaveBeenCalledWith("u1", expect.objectContaining({
      idEmpresa: "E0000003804",
      nombreEmpresa: "Gloria S.A.",
    }));
  });

  it("falla si el usuario no existe", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    await expect(svc.actualizar("u-x", empresaAcceso)).rejects.toMatchObject({ status: 404 });
  });
});

describe("UsuariosApplicationService.enviarAccesos", () => {
  it("regenera la credencial temporal y la envia", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    vi.mocked(usuarioRepo.findUsuarioPortalById).mockResolvedValue(usuarioFila());
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    const r = await svc.enviarAccesos("u1");

    expect(usuarioRepo.actualizarPasswordUsuarioPortal).toHaveBeenCalledWith("u1", "hash:TempPass123", true);
    expect(r).toEqual({ email: "juan@empresa.com", emailEnviado: true });
  });

  it("falla si el usuario no existe", async () => {
    const { usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient } = fakeRepos();
    const svc = new UsuariosApplicationService(usuarioRepo, authRepo, empresaRepo, roleRepo, personaClient);

    await expect(svc.enviarAccesos("u-x")).rejects.toMatchObject({ status: 404 });
  });
});
