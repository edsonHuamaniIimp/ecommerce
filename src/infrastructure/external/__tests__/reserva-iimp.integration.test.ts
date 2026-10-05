/**
 * Test de integracion OPCIONAL contra el ambiente de Pruebas del IIMP.
 *
 * No corre en CI ni en `vitest run src` (queda en skip): se habilita con
 * `IIMP_INTEGRATION=1` y exige que `LISTSTAND_API_URL` apunte a Pruebas.
 * Crea una reserva REAL en el ambiente de Pruebas (contrato + factura de la
 * 1ra cuota) con una empresa de prueba; nunca usar contra Produccion.
 *
 * Uso:
 *   $env:IIMP_INTEGRATION="1"
 *   $env:LISTSTAND_API_URL="https://secure2.iimp.org:8443/servicio-eventos-pruebas/api"
 *   $env:LISTSTAND_USUARIO="..."; $env:LISTSTAND_CLAVE="..."
 *   npx vitest run src/infrastructure/external/__tests__/reserva-iimp.integration.test.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ListstandClient, resetListstandTokenCache } from "../liststand-client";
import { ReservaIimpClient } from "../reserva-iimp-client";
import type { ReservaIimpInput } from "@/domain/ports/reserva-iimp-client";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

/* PERUMIN 38 en el API del IIMP (doc API-RESERVA-STAND-INTEGRACION.md). */
const TIP_EV_COD = 2;
const EVEN_COD = 19;
const EMAIL_PRUEBA = "ext_analistaprogramador3@iimp.org.pe";

const habilitado = process.env.IIMP_INTEGRATION === "1" && (process.env.LISTSTAND_API_URL ?? "").includes("pruebas");

describe.skipIf(!habilitado)("Reserva IIMP contra el ambiente de Pruebas (integracion)", () => {
  beforeEach(() => {
    resetListstandTokenCache();
  });

  it("login + liststand: informa los stands cargados en Pruebas", async () => {
    const filas = await new ListstandClient().fetchStands(TIP_EV_COD, EVEN_COD);
    const libres = filas.filter((f) => f.estado === "LIBRE");
    console.log(`[IIMP Pruebas] stands=${filas.length} libres=${libres.length}`);
    if (filas.length > 0) {
      console.log(`[IIMP Pruebas] primer stand libre:`, libres[0] ?? filas[0]);
    }
    /* El login y el listado deben responder; el catalogo puede estar vacio. */
    expect(Array.isArray(filas)).toBe(true);
  });

  it("reserva real en Pruebas: contrato + cuenta corriente + factura de la 1ra cuota", async (ctx) => {
    const filas = await new ListstandClient().fetchStands(TIP_EV_COD, EVEN_COD);
    const libres = filas.filter((f) => f.estado === "LIBRE").map((f) => String(f.stand));
    if (libres.length === 0) {
      console.warn("[IIMP Pruebas] sin stands LIBRE en el evento; no se reserva.");
      ctx.skip();
      return;
    }

    const input: ReservaIimpInput = {
      tipEvCod: TIP_EV_COD,
      evenCod: EVEN_COD,
      stands: libres.slice(0, 2),
      tipoFacturacion: "01",
      tipDocFacturacion: "6",
      numDocFacturacion: "20999999999",
      razonSocial: "PRUEBA INTEGRACION CONTRATOS STANDS S.A.C.",
      dirFacturacion: "AV. PRUEBA 123, LIMA",
      friso: "CONTRATOS STANDS TEST",
      contactos: {
        contrato: {
          nombre: "Prueba Integracion",
          cargo: "Representante Legal",
          tipoDocumento: "1",
          numDocumento: "12345678",
          email: EMAIL_PRUEBA,
        },
        pagos: { nombre: "Prueba Integracion", email: EMAIL_PRUEBA },
      },
      cuotas: [
        { porcentaje: 40, fecha: "2026-12-01" },
        { porcentaje: 60, fecha: "2027-01-15" },
      ],
    };

    const resultado = await new ReservaIimpClient().reservar(input);
    console.log("[IIMP Pruebas] reserva:", JSON.stringify({
      stands: input.stands,
      contrato: resultado.contrato,
      cuentaCorriente: resultado.cuentaCorriente,
      cliente: resultado.cliente.codigo,
      documento: resultado.cuotas[0]?.documento ?? null,
      total: resultado.total,
    }, null, 2));

    expect(resultado.contrato).toMatch(/^\d{10}$/);
    expect(resultado.cuentaCorriente).toBeGreaterThan(0);
    expect(resultado.cuotas[0]?.documento).toBeTruthy();
    expect(resultado.cuotas[1]?.documento ?? null).toBeNull();
  });
});
