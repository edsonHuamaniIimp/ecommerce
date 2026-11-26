import { describe, expect, it } from "vitest";
import { sesionExpiradaUtils } from "@/lib/shared/utils/sesion-expirada";
import { DD_API_BASE, DD_RUTAS, SESION_EXPIRADA } from "@/lib/shared/constants";

const NO_AUTENTICADO = SESION_EXPIRADA.STATUS;

describe("sesionExpiradaUtils.debeIrAlLogin", () => {
  it("un 401 de una API de DD en una pantalla del dashboard lleva al login", () => {
    expect(sesionExpiradaUtils.debeIrAlLogin(`${DD_API_BASE}/bandeja?page=1`, NO_AUTENTICADO, DD_RUTAS.BANDEJA)).toBe(true);
    expect(sesionExpiradaUtils.debeIrAlLogin(`${DD_API_BASE}/matriz-evaluacion/guardar`, NO_AUTENTICADO, `${DD_RUTAS.MATRIZ}/abc`)).toBe(true);
    expect(sesionExpiradaUtils.debeIrAlLogin(`https://qa.example.com${DD_API_BASE}/detalle?id=1`, NO_AUTENTICADO, DD_RUTAS.LEGAL)).toBe(true);
    expect(sesionExpiradaUtils.debeIrAlLogin(`${DD_API_BASE}/mi-expediente`, NO_AUTENTICADO, DD_RUTAS.MIS_DILIGENCIAS)).toBe(true);
  });

  it("otros status de DD no redirigen (403 es falta de permiso, no sesion terminada)", () => {
    expect(sesionExpiradaUtils.debeIrAlLogin(`${DD_API_BASE}/bandeja`, 403, DD_RUTAS.BANDEJA)).toBe(false);
    expect(sesionExpiradaUtils.debeIrAlLogin(`${DD_API_BASE}/bandeja`, 400, DD_RUTAS.BANDEJA)).toBe(false);
    expect(sesionExpiradaUtils.debeIrAlLogin(`${DD_API_BASE}/bandeja`, 500, DD_RUTAS.BANDEJA)).toBe(false);
  });

  it("las APIs de otros modulos conservan su manejo actual", () => {
    expect(sesionExpiradaUtils.debeIrAlLogin("/api/solicitudes/listar", NO_AUTENTICADO, "/dashboard/solicitudes")).toBe(false);
    expect(sesionExpiradaUtils.debeIrAlLogin("/api/auth/login", NO_AUTENTICADO, "/auth/login")).toBe(false);
    expect(sesionExpiradaUtils.debeIrAlLogin("/api/auth/session", NO_AUTENTICADO, DD_RUTAS.BANDEJA)).toBe(false);
    expect(sesionExpiradaUtils.debeIrAlLogin(`${DD_API_BASE}-otro/x`, NO_AUTENTICADO, DD_RUTAS.BANDEJA)).toBe(false);
  });

  it("nunca redirige desde pantallas publicas o de autenticacion", () => {
    expect(sesionExpiradaUtils.debeIrAlLogin(`${DD_API_BASE}/bandeja`, NO_AUTENTICADO, SESION_EXPIRADA.RUTA_LOGIN)).toBe(false);
    expect(sesionExpiradaUtils.debeIrAlLogin(`${DD_API_BASE}/bandeja`, NO_AUTENTICADO, "/auth/cambiar-password")).toBe(false);
    expect(sesionExpiradaUtils.debeIrAlLogin(`${DD_API_BASE}/bandeja`, NO_AUTENTICADO, "/presala")).toBe(false);
    expect(sesionExpiradaUtils.debeIrAlLogin(`${DD_API_BASE}/bandeja`, NO_AUTENTICADO, "/")).toBe(false);
  });
});

describe("sesionExpiradaUtils.urlLogin", () => {
  it("arma el login con returnTo a la pantalla actual (con su query)", () => {
    const url = sesionExpiradaUtils.urlLogin(`${DD_RUTAS.MATRIZ}/abc?returnTo=/x&tab=2`);
    const parsed = new URL(url, "http://localhost");
    expect(parsed.pathname).toBe(SESION_EXPIRADA.RUTA_LOGIN);
    expect(parsed.searchParams.get(SESION_EXPIRADA.PARAM_RETURN_TO)).toBe(`${DD_RUTAS.MATRIZ}/abc?returnTo=/x&tab=2`);
  });
});
