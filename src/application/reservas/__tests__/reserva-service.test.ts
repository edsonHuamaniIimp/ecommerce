import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/server/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/server/mail-templates/reservas-email-templates", () => ({
  buildReservaConfirmationEmail: vi.fn(() => ({ subject: "s", html: "h" })),
  buildAdminNotificacionEmail: vi.fn(() => ({ subject: "s", html: "h" })),
}));

import { ReservaApplicationService } from "../reserva-service";
import type { IGessRepository } from "@/domain/ports/gess-repository";

function gessRepoCon(stands: Array<{ id: string; standCode: string; eventoId?: string | null; estado?: string | null }>) {
  const findById = vi.fn(async (id: string) => {
    const found = stands.find((s) => s.id === id);
    if (!found) return null;
    return {
      id: found.id,
      eventoId: found.eventoId ?? null,
      standApiId: found.id,
      standCode: found.standCode,
      tipoStand: null,
      medidas: null,
      estado: found.estado ?? "disponible",
      empresa: null,
      bloqueId: null,
      email: null,
      userId: null,
      rawData: null,
    };
  });
  const update = vi.fn(async () => ({}));
  return { repo: { findById, update } as unknown as IGessRepository, findById, update };
}

describe("ReservaApplicationService — validacion de evento", () => {
  it("acepta stands del mismo evento y aplica los cambios", async () => {
    const { repo, update } = gessRepoCon([
      { id: "g1", standCode: "A-1", eventoId: "evt-1" },
      { id: "g2", standCode: "A-2", eventoId: "evt-1" },
    ]);
    const svc = new ReservaApplicationService(repo);
    const res = await svc.crear({ standIds: ["g1", "g2"], eventoId: "evt-1" });
    expect(res.ok).toBe(true);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("rechaza stands de otro evento distinto al de la sesion", async () => {
    const { repo, update } = gessRepoCon([
      { id: "g1", standCode: "A-1", eventoId: "evt-1" },
      { id: "g2", standCode: "B-2", eventoId: "evt-2" },
    ]);
    const svc = new ReservaApplicationService(repo);
    const res = await svc.crear({ standIds: ["g1", "g2"], eventoId: "evt-1" });
    expect(res.ok).toBe(false);
    expect(res.conflicted).toContain("B-2 no pertenece al evento actual");
    expect(update).not.toHaveBeenCalled();
  });

  it("rechaza mezcla de eventos cuando no hay evento de sesion", async () => {
    const { repo, update } = gessRepoCon([
      { id: "g1", standCode: "A-1", eventoId: "evt-1" },
      { id: "g2", standCode: "B-2", eventoId: "evt-2" },
    ]);
    const svc = new ReservaApplicationService(repo);
    const res = await svc.crear({ standIds: ["g1", "g2"] });
    expect(res.ok).toBe(false);
    expect(res.conflicted).toContain("B-2 no pertenece al evento actual");
    expect(update).not.toHaveBeenCalled();
  });

  it("no aplica cambios parciales si hay un stand con conflicto", async () => {
    const { repo, update } = gessRepoCon([
      { id: "g1", standCode: "A-1", eventoId: "evt-1" },
      { id: "g2", standCode: "A-2", eventoId: "evt-1", estado: "en_evaluacion" },
    ]);
    const svc = new ReservaApplicationService(repo);
    const res = await svc.crear({ standIds: ["g1", "g2"], eventoId: "evt-1" });
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
