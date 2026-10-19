import { describe, expect, it } from "vitest";
import { API_SOLICITUDES_PERMISOS, PERMISSIONS } from "@/lib/shared/constants";
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

describe("reglas de permiso simple", () => {
  it("exige el permiso configurado", () => {
    expect(tieneAccesoRuta({ permission: PERMISSIONS.EMPRESAS_VIEW }, [])).toBe(false);
    expect(tieneAccesoRuta({ permission: PERMISSIONS.EMPRESAS_VIEW }, [PERMISSIONS.EMPRESAS_VIEW])).toBe(true);
  });

  it("sin permiso ni anyOf, cualquier sesion autenticada pasa", () => {
    expect(tieneAccesoRuta({}, [])).toBe(true);
  });
});
