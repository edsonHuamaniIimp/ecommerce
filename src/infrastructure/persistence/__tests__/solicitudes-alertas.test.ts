import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  alerta: { findFirst: vi.fn(), create: vi.fn() },
  solicitud: { findUnique: vi.fn() },
  userRole: { findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/server/db", () => ({ prisma: prismaMock }));

import { SolicitudesPrismaRepository } from "../solicitudes-repository";
import { ALERTA_CLAVES } from "@/lib/shared/alert-templates";

describe("SolicitudesPrismaRepository - alertas con contexto y sin duplicados", () => {
  beforeEach(() => {
    Object.values(prismaMock.alerta).forEach((fn) => fn.mockReset());
    prismaMock.solicitud.findUnique.mockReset().mockResolvedValue({ gessStand: { eventoId: "ev-1" } });
    prismaMock.userRole.findFirst.mockReset().mockResolvedValue({ empresaId: "emp-1" });
    prismaMock.alerta.findFirst.mockResolvedValue(null);
  });

  const datos = { stands: "E-1", total: 1, documentos: ["a"] };

  it("guarda solicitud, evento y empresa", async () => {
    await new SolicitudesPrismaRepository().crearAlertaReserva({
      userId: "u1", solicitudId: "s1", tipo: "documentos_observados",
      clave: ALERTA_CLAVES.DOCUMENTOS_OBSERVADOS, datos,
    });
    expect(prismaMock.alerta.create.mock.calls[0]![0].data).toMatchObject({
      userId: "u1", solicitudId: "s1", eventoId: "ev-1", empresaId: "emp-1",
    });
  });

  it("no crea la alerta si ya existe una igual sin leer", async () => {
    prismaMock.alerta.findFirst.mockResolvedValue({ id: "x" });
    await new SolicitudesPrismaRepository().crearAlertaReserva({
      userId: "u1", solicitudId: "s1", tipo: "documentos_observados",
      clave: ALERTA_CLAVES.DOCUMENTOS_OBSERVADOS, datos,
    });
    expect(prismaMock.alerta.create).not.toHaveBeenCalled();
    expect(prismaMock.alerta.findFirst.mock.calls[0]![0].where).toMatchObject({ leida: false, solicitudId: "s1" });
  });

  it("alerta por rol: una por usuario, con el evento de la solicitud", async () => {
    prismaMock.userRole.findMany.mockResolvedValue([{ userId: "a1" }, { userId: "a1" }, { userId: "a2" }]);
    await new SolicitudesPrismaRepository().crearAlertaRol({
      rol: "admin", tipo: "contrato_firmado", clave: ALERTA_CLAVES.CONTRATO_FIRMADO_SUBIDO,
      datos: { stands: "E-1" }, url: "/x", solicitudId: "s1",
    });
    expect(prismaMock.alerta.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.alerta.create.mock.calls[0]![0].data).toMatchObject({ eventoId: "ev-1", empresaId: null, solicitudId: "s1" });
  });
});
