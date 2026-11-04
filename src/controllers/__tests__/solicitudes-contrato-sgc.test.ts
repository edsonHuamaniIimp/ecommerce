import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/lib/shared/constants";

const getSession = vi.fn();
const detalle = vi.fn();
const obtenerDescargaContrato = vi.fn();

vi.mock("@/lib/server/auth", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

vi.mock("@/lib/server/services", () => ({
  services: {
    solicitudes: { detalle: (...args: unknown[]) => detalle(...args) },
    sgc: {
      obtenerDescargaContrato: (...args: unknown[]) => obtenerDescargaContrato(...args),
    },
  },
}));

import { solicitudesController } from "../solicitudes.controller";

const SOLICITUD_ID = "64b43919-2074-4657-9806-28b39a9e1a4f";

function request(): Request {
  return new Request(`http://localhost/api/solicitudes/contrato-sgc?id=${SOLICITUD_ID}`);
}

describe("GET /api/solicitudes/contrato-sgc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      sub: "user-1",
      permissions: ["mis-reservas:view"],
    });
    detalle.mockResolvedValue({
      id: SOLICITUD_ID,
      userId: "user-1",
      sgcLifecycleStatus: "finalized",
    });
    obtenerDescargaContrato.mockResolvedValue({
      url: "https://sgc.example/contrato.pdf",
      expiresInSeconds: 60,
    });
  });

  it("devuelve el enlace al titular de la solicitud", async () => {
    const response = await solicitudesController.contratoSgc(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.url).toBe("https://sgc.example/contrato.pdf");
    expect(obtenerDescargaContrato).toHaveBeenCalledWith(SOLICITUD_ID);
  });

  it("rechaza a otro cliente sin permisos de staff", async () => {
    detalle.mockResolvedValue({
      id: SOLICITUD_ID,
      userId: "user-2",
      sgcLifecycleStatus: "finalized",
    });

    const response = await solicitudesController.contratoSgc(request());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe(API_ERROR_CODES.FORBIDDEN);
    expect(obtenerDescargaContrato).not.toHaveBeenCalled();
  });

  it("no expone el contrato si el SGC aun no lo aprobo", async () => {
    detalle.mockResolvedValue({
      id: SOLICITUD_ID,
      userId: "user-1",
      sgcLifecycleStatus: "observed",
    });

    const response = await solicitudesController.contratoSgc(request());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe(API_ERROR_CODES.NOT_FOUND);
    expect(obtenerDescargaContrato).not.toHaveBeenCalled();
  });

  it("devuelve 404 si el SGC no tiene contrato descargable", async () => {
    obtenerDescargaContrato.mockResolvedValue(null);

    const response = await solicitudesController.contratoSgc(request());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.message).toBe("No hay contrato firmado disponible");
  });
});
