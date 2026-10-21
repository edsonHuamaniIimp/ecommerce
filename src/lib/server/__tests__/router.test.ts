import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { API_ERROR_CODES } from "@/lib/shared/constants";

const registrar = vi.fn();
vi.mock("@/lib/server/api-error-logger", () => ({
  apiErrorLogger: { registrar: (...args: unknown[]) => registrar(...args) },
}));

import { createRouter } from "../router";

function contexto(slug: string) {
  return { params: Promise.resolve({ slug: [slug] }) };
}

describe("createRouter (trazabilidad de errores)", () => {
  it("registra una respuesta 400 devuelta por el handler y conserva el body", async () => {
    const routes = createRouter({
      GET: {
        fallar: () => NextResponse.json(
          { success: false, error: { code: API_ERROR_CODES.VALIDATION, message: "Dato invalido" } },
          { status: 400 },
        ),
      },
    });

    const handler = routes.GET;
    if (!handler) throw new Error("GET no expuesto");
    const response = await handler(new Request("http://localhost/api/test/fallar"), contexto("fallar"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: API_ERROR_CODES.VALIDATION, message: "Dato invalido" },
    });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      code: API_ERROR_CODES.VALIDATION,
      message: "Dato invalido",
      action: "fallar",
    }));
  });

  it("registra una excepcion 500 con stack", async () => {
    const routes = createRouter({
      GET: {
        romper: () => { throw new Error("boom"); },
      },
    });

    const handler = routes.GET;
    if (!handler) throw new Error("GET no expuesto");
    const response = await handler(new Request("http://localhost/api/test/romper"), contexto("romper"));

    expect(response.status).toBe(500);
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({
      status: 500,
      code: API_ERROR_CODES.INTERNAL,
      message: "boom",
      action: "romper",
    }));
  });
});
