import { describe, expect, it } from "vitest";
import {
  API_SGC_PERMISOS,
  API_SOLICITUDES_PERMISOS,
  PERMISSIONS,
  ROLES,
  ROLES_PERMISSIONS,
} from "@/lib/shared/constants";
import { tieneAccesoRuta } from "../proxy-acceso";

describe("acceso del proxy a /api/solicitudes", () => {
  const regla = { anyOf: API_SOLICITUDES_PERMISOS };

  it("permite al cliente con mis-reservas:view", () => {
    expect(tieneAccesoRuta(regla, [PERMISSIONS.MIS_RESERVAS_VIEW])).toBe(true);
  });

  it("permite al staff con solicitudes:view", () => {
    expect(tieneAccesoRuta(regla, [PERMISSIONS.SOLICITUDES_VIEW])).toBe(true);
  });

  it("bloquea sin permisos o con permisos ajenos", () => {
    expect(tieneAccesoRuta(regla, [])).toBe(false);
    expect(tieneAccesoRuta(regla, [PERMISSIONS.PAGOS_VIEW])).toBe(false);
  });
});

describe("acceso del proxy a /api/sgc", () => {
  const regla = { anyOf: API_SGC_PERMISOS };

  it("bloquea al cliente aunque conserve mis-reservas:view", () => {
    expect(ROLES_PERMISSIONS[ROLES.CLIENTE]).not.toContain(PERMISSIONS.SOLICITUDES_VIEW);
    expect(tieneAccesoRuta(regla, ROLES_PERMISSIONS[ROLES.CLIENTE])).toBe(false);
    expect(tieneAccesoRuta(regla, [PERMISSIONS.MIS_RESERVAS_VIEW])).toBe(false);
  });

  it("bloquea el permiso generico solicitudes:view", () => {
    expect(tieneAccesoRuta(regla, [PERMISSIONS.SOLICITUDES_VIEW])).toBe(false);
  });

  it("permite al staff de revision y al admin", () => {
    expect(tieneAccesoRuta(regla, ROLES_PERMISSIONS[ROLES.ASOCIADO])).toBe(true);
    expect(tieneAccesoRuta(regla, ROLES_PERMISSIONS[ROLES.LOGISTICA])).toBe(true);
    expect(tieneAccesoRuta(regla, ROLES_PERMISSIONS[ROLES.LEGAL])).toBe(true);
    expect(tieneAccesoRuta(regla, ROLES_PERMISSIONS[ROLES.COMUNICACION])).toBe(true);
    expect(tieneAccesoRuta(regla, [PERMISSIONS.ADMIN_FULL])).toBe(true);
  });
});

describe("permisos del cliente tras la baja de solicitudes:view", () => {
  const permisos = ROLES_PERMISSIONS[ROLES.CLIENTE];

  it("mantiene Mis solicitudes y la API compartida", () => {
    expect(tieneAccesoRuta({ permission: PERMISSIONS.MIS_RESERVAS_VIEW }, permisos)).toBe(true);
    expect(tieneAccesoRuta({ anyOf: API_SOLICITUDES_PERMISOS }, permisos)).toBe(true);
  });

  it("no accede a la bandeja administrativa", () => {
    expect(tieneAccesoRuta({ permission: PERMISSIONS.SOLICITUDES_GESTION }, permisos)).toBe(false);
  });
});

describe("reglas de permiso simple", () => {
  it("exige el permiso configurado", () => {
    expect(tieneAccesoRuta({ permission: PERMISSIONS.EMPRESAS_VIEW }, [])).toBe(false);
    expect(tieneAccesoRuta({ permission: PERMISSIONS.EMPRESAS_VIEW }, [PERMISSIONS.EMPRESAS_VIEW])).toBe(true);
  });

  it("permite admin:full en cualquier ruta protegida", () => {
    expect(tieneAccesoRuta({ permission: PERMISSIONS.USUARIOS_MANAGE }, [PERMISSIONS.ADMIN_FULL])).toBe(true);
    expect(tieneAccesoRuta({ anyOf: API_SOLICITUDES_PERMISOS }, [PERMISSIONS.ADMIN_FULL])).toBe(true);
  });

  it("sin permiso ni anyOf, cualquier sesion autenticada pasa", () => {
    expect(tieneAccesoRuta({}, [])).toBe(true);
  });
});
