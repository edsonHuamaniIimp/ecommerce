import { beforeEach, describe, expect, it, vi } from "vitest";

const { trigger, detalle, registrarAdjunto, eliminarAdjunto, capturar } = vi.hoisted(() => ({
  trigger: vi.fn(),
  detalle: vi.fn(),
  registrarAdjunto: vi.fn(),
  eliminarAdjunto: vi.fn(),
  capturar: vi.fn(),
}));

vi.mock("@/lib/server/pusher", () => ({
  getPusher: () => ({ trigger }),
  canalUsuario: (id: string) => `private-usuario-${id}`,
}));
vi.mock("@/lib/server/services", () => ({
  services: { ddMatrizEvaluacion: { detalle, registrarAdjunto, eliminarAdjunto } },
}));
vi.mock("@/lib/server/storage", () => ({ getStorage: () => ({ upload: async () => "/uploads/x.pdf" }) }));
vi.mock("@/infrastructure/browser/dd-evidencia-captura", () => ({ capturarEvidenciaPdf: capturar }));

import { estadoAutomatizacion, iniciarAutomatizacionGeneral } from "../dd-matriz-automatizacion";
import { DD_AUTOMATIZACION_EVENTO, DD_AUTOMATIZACION_ESTADOS } from "@/lib/shared/constants";

const session = { email: "a@b.c", roles: [], permissions: [], eventoId: "e1" } as never;
const espera = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("automatizacion general de evidencias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detalle.mockResolvedValue({
      vinculo: { nombre: "ACME SAC", documento: "20123456789", tipo: "empresa", ambito: "nacional", tipoDocumento: "RUC" },
      adjuntos: [],
    });
    capturar.mockResolvedValue({ bytes: Buffer.from("%PDF-1.4"), mimeType: "application/pdf", nombre: "ev.pdf" });
    registrarAdjunto.mockResolvedValue({ id: "adj" });
  });

  it("responde al instante en curso y avisa por push al terminar", async () => {
    const job = await iniciarAutomatizacionGeneral(session, "u1", "v1");
    expect(job.estado).toBe(DD_AUTOMATIZACION_ESTADOS.EN_CURSO);
    expect(job.total).toBeGreaterThan(0);
    expect(job.canal).toBe("private-usuario-u1");

    await vi.waitFor(() => expect(trigger).toHaveBeenCalled(), { timeout: 3000 });
    expect(trigger.mock.calls[0]?.[0]).toBe("private-usuario-u1");
    expect(trigger.mock.calls[0]?.[1]).toBe(DD_AUTOMATIZACION_EVENTO);
    const final = estadoAutomatizacion("u1", job.jobId);
    expect(final?.estado).toBe(DD_AUTOMATIZACION_ESTADOS.COMPLETADA);
    expect(final?.procesados).toBe(job.total);
  });

  it("marca con errores los criterios que fallan y sigue con el resto", async () => {
    capturar.mockRejectedValueOnce(new Error("portal caido"));
    const job = await iniciarAutomatizacionGeneral(session, "u2", "v2");
    await vi.waitFor(() => expect(trigger).toHaveBeenCalled(), { timeout: 3000 });
    const final = estadoAutomatizacion("u2", job.jobId);
    expect(final?.estado).toBe(DD_AUTOMATIZACION_ESTADOS.CON_ERRORES);
    expect(final?.criterios[0]).toMatchObject({ estado: "error", mensaje: "portal caido" });
    expect(final?.criterios.slice(1).every((criterio) => criterio.estado === "ok")).toBe(true);
  });

  it("no reutiliza el estado de otro usuario", async () => {
    const job = await iniciarAutomatizacionGeneral(session, "u3", "v3");
    await espera();
    expect(estadoAutomatizacion("otro", job.jobId)).toBeNull();
  });
});
