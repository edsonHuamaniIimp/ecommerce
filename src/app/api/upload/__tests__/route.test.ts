import { describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/lib/shared/constants";

const registrar = vi.fn();
vi.mock("@/lib/server/api-error-logger", () => ({
  apiErrorLogger: { registrar: (...args: unknown[]) => registrar(...args) },
}));

import { POST } from "../route";

function requestConArchivo(nombre: string, contenido = "x"): Request {
  const form = new FormData();
  form.append("file", new File([contenido], nombre, { type: "application/octet-stream" }));
  return new Request("http://localhost/api/upload", { method: "POST", body: form });
}

describe("POST /api/upload (trazabilidad)", () => {
  it("rechaza y registra un formato no permitido", async () => {
    const response = await POST(requestConArchivo("malicioso.exe"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe(API_ERROR_CODES.VALIDATION);
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      code: API_ERROR_CODES.VALIDATION,
      message: expect.stringContaining("Formato no permitido"),
    }));
  });
});
