import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decidirAccesoUpload,
  requiereEmpresaDelUsuario,
  uploadsProtegidosActivo,
} from "../uploads-acceso";
import { PERMISSIONS, ROLES } from "@/lib/shared/constants";

const documento = (...empresaIds: string[]) => ({ tipo: "documento" as const, empresaIds });
const interno = { tipo: "interno" as const, empresaIds: [] };
const publico = { tipo: "ninguno" as const, empresaIds: [] };

const contexto = (parcial: Partial<Parameters<typeof decidirAccesoUpload>[1]> = {}) => ({
  session: null,
  m2m: false,
  empresaIdUsuario: null,
  ...parcial,
});
const sesion = (permissions: string[], roles: string[] = []) => ({ roles, permissions });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("uploadsProtegidosActivo", () => {
  it("esta apagada por defecto (no rompe produccion hasta configurar CloudFront)", () => {
    expect(uploadsProtegidosActivo()).toBe(false);
  });
  it("solo se enciende con UPLOADS_PROTEGIDOS=true", () => {
    vi.stubEnv("UPLOADS_PROTEGIDOS", "1");
    expect(uploadsProtegidosActivo()).toBe(false);
    vi.stubEnv("UPLOADS_PROTEGIDOS", "true");
    expect(uploadsProtegidosActivo()).toBe(true);
  });
});

describe("decidirAccesoUpload", () => {
  it("los archivos que no son de DD siguen siendo publicos, con o sin sesion", () => {
    expect(decidirAccesoUpload(publico, contexto())).toEqual({ permitido: true });
    expect(decidirAccesoUpload(publico, contexto({ session: sesion([]) }))).toEqual({ permitido: true });
  });

  it("sin sesion un documento de DD da 401", () => {
    expect(decidirAccesoUpload(documento("e1"), contexto())).toEqual({ permitido: false, status: 401 });
    expect(decidirAccesoUpload(interno, contexto())).toEqual({ permitido: false, status: 401 });
  });

  it.each([
    ["SIG / Logistica", [PERMISSIONS.DD_REVISION]],
    ["Legal", [PERMISSIONS.DD_LEGAL]],
    ["Matriz", [PERMISSIONS.DD_MATRIZ]],
    ["Panel", [PERMISSIONS.DD_PANEL]],
    ["administracion DD", [PERMISSIONS.DD_ADMIN]],
    ["administrador total", [PERMISSIONS.ADMIN_FULL]],
  ])("el personal %s ve documentos y evidencias", (_nombre, permisos) => {
    expect(decidirAccesoUpload(documento("e1"), contexto({ session: sesion(permisos) }))).toEqual({ permitido: true });
    expect(decidirAccesoUpload(interno, contexto({ session: sesion(permisos) }))).toEqual({ permitido: true });
  });

  it("el rol admin siempre accede", () => {
    expect(decidirAccesoUpload(interno, contexto({ session: sesion([], [ROLES.ADMIN]) }))).toEqual({ permitido: true });
  });

  it("Comunicaciones no accede a los documentos del expediente", () => {
    const comunicaciones = sesion([PERMISSIONS.DD_VER, PERMISSIONS.DD_REPUTACION]);
    expect(decidirAccesoUpload(documento("e1"), contexto({ session: comunicaciones }))).toEqual({ permitido: false, status: 403 });
  });

  it("el cliente solo accede a los documentos de su propia empresa", () => {
    const cliente = sesion([PERMISSIONS.DD_FORMULARIO]);
    expect(decidirAccesoUpload(documento("e1"), contexto({ session: cliente, empresaIdUsuario: "e1" }))).toEqual({ permitido: true });
    expect(decidirAccesoUpload(documento("e1", "e2"), contexto({ session: cliente, empresaIdUsuario: "e2" }))).toEqual({ permitido: true });
    expect(decidirAccesoUpload(documento("e1"), contexto({ session: cliente, empresaIdUsuario: "otra" }))).toEqual({ permitido: false, status: 403 });
    expect(decidirAccesoUpload(documento("e1"), contexto({ session: cliente, empresaIdUsuario: null }))).toEqual({ permitido: false, status: 403 });
  });

  it("el cliente nunca ve evidencias internas de la matriz ni informes legales", () => {
    const cliente = sesion([PERMISSIONS.DD_FORMULARIO]);
    expect(decidirAccesoUpload(interno, contexto({ session: cliente, empresaIdUsuario: "e1" }))).toEqual({ permitido: false, status: 403 });
  });

  it("la integracion M2M accede a los documentos de DD pero no a las evidencias internas", () => {
    expect(decidirAccesoUpload(documento("e1"), contexto({ m2m: true }))).toEqual({ permitido: true });
    expect(decidirAccesoUpload(interno, contexto({ m2m: true }))).toEqual({ permitido: false, status: 401 });
  });
});

describe("requiereEmpresaDelUsuario", () => {
  it("solo consulta la empresa cuando un usuario que no es personal abre un documento de empresa", () => {
    expect(requiereEmpresaDelUsuario(documento("e1"), sesion([PERMISSIONS.DD_FORMULARIO]))).toBe(true);
    expect(requiereEmpresaDelUsuario(documento("e1"), sesion([PERMISSIONS.DD_REVISION]))).toBe(false);
    expect(requiereEmpresaDelUsuario(interno, sesion([PERMISSIONS.DD_FORMULARIO]))).toBe(false);
    expect(requiereEmpresaDelUsuario(documento("e1"), null)).toBe(false);
  });
});
