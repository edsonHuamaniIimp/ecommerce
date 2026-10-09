import { describe, expect, it, vi } from "vitest";
import { AuthApplicationService } from "../auth-service";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IRoleRepository } from "@/domain/ports/role-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { IPersonaClient } from "@/domain/ports/persona-client";

vi.mock("@/lib/server/auth", () => ({
  signToken: vi.fn(async () => "token-fake"),
  getSession: vi.fn(async () => null),
}));

vi.mock("@/lib/server/email", () => ({
  enviarEmailPlantilla: vi.fn(async () => true),
}));

vi.mock("@/lib/server/idioma", () => ({
  resolverIdiomaPeticion: vi.fn(async () => "es"),
}));

vi.mock("@/lib/server/utils/token", () => ({
  generarCodigoNumerico: vi.fn(() => "123456"),
  generarTokenAleatorio: vi.fn(() => "token-reset"),
}));

vi.mock("@/lib/server/utils/password", () => ({
  hashPassword: (plano: string) => `hash:${plano}`,
  verificarPassword: (plano: string, hash: string) => hash === `hash:${plano}`,
  esHash: (valor: string) => valor.startsWith("hash:"),
}));

vi.mock("@/lib/server/utils/imagen-fuente", () => ({
  leerImagenFuente: vi.fn(async () => null),
  tipoImagen: vi.fn(() => null),
}));

/** Fila de user_role para el login (flgActivo true por defecto). */
function filaLogin(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    userId: "user|juan@empresa.com",
    roleId: "r1",
    email: "juan@empresa.com",
    password: "hash:Secreta123",
    eventoId: null,
    eventoNombre: null,
    eventoPadreNombre: null,
    empresaId: null,
    debeCambiarPassword: false,
    flgActivo: true,
    role: { nombre: "cliente", permisos: [] },
    ...overrides,
  };
}

function repoFake(filas: ReturnType<typeof filaLogin>[]) {
  return {
    findByEmail: vi.fn(async () => filas),
    findByRuc: vi.fn(async () => filas),
    findEventoById: vi.fn(async () => null),
    findPerfilByEmail: vi.fn(async () => null),
    estadoEmpresaPortal: vi.fn(async () => null),
    updatePassword: vi.fn(async () => {}),
  } as unknown as IAuthRepository;
}

function servicioCon(repo: IAuthRepository) {
  return new AuthApplicationService(
    repo,
    {} as unknown as IRoleRepository,
    {} as unknown as IEmpresaRepository,
    {} as unknown as IPersonaClient,
  );
}

describe("AuthApplicationService.login (cuenta deshabilitada)", () => {
  it("rechaza el login de una cuenta deshabilitada aunque la contrasena sea correcta", async () => {
    const repo = repoFake([filaLogin({ flgActivo: false })]);
    const svc = servicioCon(repo);

    const r = await svc.login({ email: "juan@empresa.com", password: "Secreta123" });

    expect(r).toMatchObject({ status: 403 });
    if ("error" in r) expect(r.error).toMatch(/deshabilitada/i);
  });

  it("permite el login de una cuenta activa", async () => {
    const repo = repoFake([filaLogin()]);
    const svc = servicioCon(repo);

    const r = await svc.login({ email: "juan@empresa.com", password: "Secreta123" });

    expect(r).toMatchObject({ token: "token-fake", email: "juan@empresa.com" });
  });

  it("con contrasena incorrecta responde 401 sin revelar el estado de la cuenta", async () => {
    const repo = repoFake([filaLogin({ flgActivo: false })]);
    const svc = servicioCon(repo);

    const r = await svc.login({ email: "juan@empresa.com", password: "incorrecta" });

    expect(r).toMatchObject({ status: 401 });
  });
});
