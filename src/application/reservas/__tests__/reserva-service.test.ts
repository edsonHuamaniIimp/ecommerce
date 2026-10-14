import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/server/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  enviarEmailPlantilla: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/server/idioma", () => ({
  resolverIdiomaUsuario: vi.fn().mockResolvedValue("es"),
  resolverIdiomaPeticion: vi.fn().mockResolvedValue("es"),
}));

import { ReservaApplicationService } from "../reserva-service";
import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";

/** Repositorio de auth falso (idioma del correo + empresa del solicitante). */
function authRepoFalso(perfil: { ruc?: string | null; razonSocial?: string | null } | null = null): IAuthRepository {
  return {
    findPerfilByEmail: vi.fn(async () =>
      perfil
        ? { empresa: { ruc: perfil.ruc ?? "", razonSocial: perfil.razonSocial ?? "" }, nombreEmpresa: perfil.razonSocial ?? null }
        : null,
    ),
  } as unknown as IAuthRepository;
}

function gessRepoCon(
  stands: Array<{
    id: string;
    standCode: string;
    eventoId?: string | null;
    estado?: string | null;
    preReservaRuc?: string | null;
    preReservaSie?: string | null;
    preReservaRazonSocial?: string | null;
  }>,
) {
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
      preReservaRuc: found.preReservaRuc ?? null,
      preReservaSie: found.preReservaSie ?? null,
      preReservaRazonSocial: found.preReservaRazonSocial ?? null,
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
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso());
    const res = await svc.crear({ standIds: ["g1", "g2"], eventoId: "evt-1" });
    expect(res.ok).toBe(true);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("rechaza stands de otro evento distinto al de la sesion", async () => {
    const { repo, update } = gessRepoCon([
      { id: "g1", standCode: "A-1", eventoId: "evt-1" },
      { id: "g2", standCode: "B-2", eventoId: "evt-2" },
    ]);
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso());
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
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso());
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
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso());
    const res = await svc.crear({ standIds: ["g1", "g2"], eventoId: "evt-1" });
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("permite a la empresa dueña reservar su pre-reserva", async () => {
    const { repo, update } = gessRepoCon([
      {
        id: "g1",
        standCode: "A-1",
        eventoId: "evt-1",
        estado: "pre_reservado",
        preReservaRuc: "20123456789",
        preReservaRazonSocial: "Minera Cordillera S.A.C.",
      },
    ]);
    const svc = new ReservaApplicationService(
      repo,
      undefined,
      authRepoFalso({ ruc: "20123456789", razonSocial: "Minera Cordillera S.A.C." }),
    );
    const res = await svc.crear({ standIds: ["g1"], eventoId: "evt-1", userEmail: "duena@minera.pe" });
    expect(res.ok).toBe(true);
    expect(update).toHaveBeenCalledWith("g1", expect.objectContaining({ estado: "en_evaluacion" }));
  });

  it("rechaza a terceros reservar un stand pre-reservado", async () => {
    const { repo, update } = gessRepoCon([
      { id: "g1", standCode: "A-1", eventoId: "evt-1", estado: "pre_reservado", preReservaRuc: "20123456789" },
    ]);
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso({ ruc: "20999999999" }));
    const res = await svc.crear({ standIds: ["g1"], eventoId: "evt-1", userEmail: "tercero@otra.pe" });
    expect(res.ok).toBe(false);
    expect(res.conflicted).toContain("A-1 esta pre-reservado para otra empresa");
    expect(update).not.toHaveBeenCalled();
  });

  it("rechaza la pre-reserva si el solicitante no tiene empresa identificada", async () => {
    const { repo } = gessRepoCon([
      { id: "g1", standCode: "A-1", eventoId: "evt-1", estado: "pre_reservado", preReservaRuc: "20123456789" },
    ]);
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso());
    const res = await svc.crear({ standIds: ["g1"], eventoId: "evt-1" });
    expect(res.ok).toBe(false);
    expect(res.conflicted).toContain("A-1 esta pre-reservado para otra empresa");
  });
});
