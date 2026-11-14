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
import { enviarEmailPlantilla } from "@/lib/server/email";
import type { IGessRepository } from "@/domain/ports/gess-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { ISolicitudesRepository } from "@/domain/ports/solicitudes-repository";
import type { IEventoRepository } from "@/domain/ports/evento-repository";
import type { IEmpresaRepository } from "@/domain/ports/empresa-repository";
import { TIPOS_SOLICITUD } from "@/lib/shared/constants";

/** Repositorio de auth falso (idioma del correo + empresa del solicitante). */
function authRepoFalso(perfil: { ruc?: string | null; razonSocial?: string | null; configCuotas?: { maxCuotas: number; fechas: string[]; porcentajes?: number[] } | null } | null = null): IAuthRepository {
  return {
    findPerfilByEmail: vi.fn(async () =>
      perfil
        ? { empresa: { ruc: perfil.ruc ?? "", razonSocial: perfil.razonSocial ?? "", configCuotas: perfil.configCuotas ?? null }, nombreEmpresa: perfil.razonSocial ?? null }
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
    medidas?: string | null;
    bloqueId?: string | null;
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
      medidas: found.medidas ?? null,
      estado: found.estado ?? "disponible",
      empresa: null,
      bloqueId: found.bloqueId ?? null,
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

  it("notifica a los receptores internos configurados", async () => {
    vi.mocked(enviarEmailPlantilla).mockClear();
    const { repo } = gessRepoCon([{ id: "g1", standCode: "A-1", eventoId: "evt-1", medidas: "7440.00 USD", bloqueId: "B-1" }]);
    const configuracionRepo = {
      obtenerPortal: vi.fn(async () => ({
        notificacionesSolicitudesEmails: ["analista@iimp.org.pe", "compras@iimp.org.pe"],
      })),
    } as never;
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso(), undefined, configuracionRepo);

    await svc.crear({ standIds: ["g1"], eventoId: "evt-1", userEmail: "cliente@empresa.pe" });

    const envios = vi.mocked(enviarEmailPlantilla).mock.calls
      .filter(([params]) => params.plantilla === "reserva-admin")
      .map(([params]) => params.to);
    expect(envios).toEqual(["analista@iimp.org.pe", "compras@iimp.org.pe"]);
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

describe("ReservaApplicationService - hold temporal", () => {
  it("publica el evento de bloqueo cuando el hold se crea completo", async () => {
    const repo = {
      crearHold: vi.fn(async () => ({ ok: true, conflictos: [] })),
      findById: vi.fn(async (id: string) => ({ id, standCode: "A-1", eventoId: "evt-1" })),
    } as unknown as IGessRepository;
    const standEvents = {
      standReservado: vi.fn(),
      standHold: vi.fn(async () => {}),
      standReleased: vi.fn(),
    };
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso(), standEvents);

    const hold = await svc.crearHold(["g1"], "evt-1", "user-1", undefined);

    expect(hold.holdId).toBeTruthy();
    expect(hold.expiresAt).toBeTruthy();
    expect(standEvents.standHold).toHaveBeenCalledWith(expect.objectContaining({
      eventoId: "evt-1",
      standIds: ["g1"],
      standCodes: ["A-1"],
    }));
  });

  it("usa los minutos configurados desde /dashboard/configuracion", async () => {
    const repo = {
      crearHold: vi.fn(async () => ({ ok: true, conflictos: [] })),
      findById: vi.fn(async (id: string) => ({ id, standCode: "A-1", eventoId: "evt-1" })),
    } as unknown as IGessRepository;
    const standEvents = { standReservado: vi.fn(), standHold: vi.fn(async () => {}), standReleased: vi.fn() };
    const configuracionRepo = { obtenerPortal: vi.fn(async () => ({ holdReservaMinutos: 10 })) } as never;
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso(), standEvents, configuracionRepo);

    const hold = await svc.crearHold(["g1"], "evt-1", "user-1", undefined);

    expect(hold.reservaEnMinutos).toBe(10);
    const minutosRestantes = (new Date(hold.expiresAt).getTime() - Date.now()) / 60_000;
    expect(minutosRestantes).toBeGreaterThan(9.5);
    expect(minutosRestantes).toBeLessThanOrEqual(10);
  });

  it("permite crear el hold de una pre-reserva propia", async () => {
    const crearHold = vi.fn(async () => ({ ok: true, conflictos: [] }));
    const repo = {
      crearHold,
      findById: vi.fn(async (id: string) => ({
        id,
        standCode: "144",
        eventoId: "evt-1",
        estado: "pre_reservado",
        preReservaRuc: "20312372895",
        preReservaRazonSocial: "YURA S.A.",
      })),
    } as unknown as IGessRepository;
    const standEvents = { standReservado: vi.fn(), standHold: vi.fn(async () => {}), standReleased: vi.fn() };
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso({ ruc: "20312372895", razonSocial: "YURA S.A." }), standEvents);

    const hold = await svc.crearHold(["g1"], "evt-1", "user-1", "correo@correo.com");

    expect(hold.holdId).toBeTruthy();
    expect(crearHold).toHaveBeenCalledWith(expect.objectContaining({
      standIds: ["g1"],
      preReservadosPropios: ["g1"],
    }));
  });

  it("no publica evento ni devuelve hold cuando otro cliente bloqueo el stand", async () => {
    const repo = {
      crearHold: vi.fn(async () => ({ ok: false, conflictos: ["A-1"] })),
      findById: vi.fn(async (id: string) => ({ id, standCode: "A-1", eventoId: "evt-1" })),
    } as unknown as IGessRepository;
    const standEvents = {
      standReservado: vi.fn(),
      standHold: vi.fn(),
      standReleased: vi.fn(),
    };
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso(), standEvents);

    await expect(svc.crearHold(["g1"], "evt-1", "user-1", undefined)).rejects.toThrow("A-1");
    expect(standEvents.standHold).not.toHaveBeenCalled();
  });

  it("rechaza la reserva final si el hold ya expiro", async () => {
    const { repo, update } = gessRepoCon([{ id: "g1", standCode: "A-1", eventoId: "evt-1" }]);
    (repo as unknown as { validarHold: () => Promise<boolean> }).validarHold = vi.fn(async () => false);
    const svc = new ReservaApplicationService(repo, undefined, authRepoFalso());

    const res = await svc.crear({ standIds: ["g1"], eventoId: "evt-1", holdId: "hold-1", userSub: "user-1" });

    expect(res.ok).toBe(false);
    expect(res.message).toContain("expiro");
    expect(update).not.toHaveBeenCalled();
  });
});
describe("ReservaApplicationService - snapshot de cuotas", () => {
  it("persiste el cronograma del wizard al crear la solicitud", async () => {
    const { repo } = gessRepoCon([{ id: "g1", standCode: "A-1", eventoId: "evt-1", medidas: "7440.00 USD", bloqueId: "B-1" }]);
    const solicitudesRepo = {
      crearSolicitud: vi.fn(async () => "sol-1"),
      crearRevisionInicial: vi.fn(async () => ({})),
      guardarPlanCuotas: vi.fn(async () => undefined),
      crearAlertaRevision: vi.fn(async () => undefined),
      crearAlertaReserva: vi.fn(async () => undefined),
    } as unknown as ISolicitudesRepository;
    const svc = new ReservaApplicationService(repo, solicitudesRepo, authRepoFalso());

    const res = await svc.crear({
      standIds: ["g1"],
      eventoId: "evt-1",
      userSub: "user-1",
      cuotas: [
        { porcentaje: 40, fechaVencimiento: "2026-11-15" },
        { porcentaje: 30, fechaVencimiento: "2027-02-15" },
        { porcentaje: 30, fechaVencimiento: "2027-06-15" },
      ],
    });

    expect(res.ok).toBe(true);
    expect(solicitudesRepo.guardarPlanCuotas).toHaveBeenCalledWith(
      "sol-1",
      expect.objectContaining({
        modalidad: "tres_cuotas",
        cuotas: expect.arrayContaining([
          expect.objectContaining({ porcentaje: 40, fechaVencimiento: "2026-11-15" }),
          expect.objectContaining({ porcentaje: 30, fechaVencimiento: "2027-02-15" }),
          expect.objectContaining({ porcentaje: 30, fechaVencimiento: "2027-06-15" }),
        ]),
      }),
    );
  });

  it("rechaza cuotas que no coinciden con los porcentajes configurados por el IIMP", async () => {
    const { repo, update } = gessRepoCon([{ id: "g1", standCode: "A-1", eventoId: "evt-1" }]);
    const solicitudesRepo = {
      crearSolicitud: vi.fn(async () => "sol-1"),
      crearRevisionInicial: vi.fn(async () => ({})),
      guardarPlanCuotas: vi.fn(async () => undefined),
      crearAlertaRevision: vi.fn(async () => undefined),
      crearAlertaReserva: vi.fn(async () => undefined),
    } as unknown as ISolicitudesRepository;
    const svc = new ReservaApplicationService(
      repo,
      solicitudesRepo,
      authRepoFalso({
        configCuotas: {
          maxCuotas: 2,
          fechas: ["2099-01-15", "2099-06-15"],
          porcentajes: [60, 40],
        },
      }),
    );

    const res = await svc.crear({
      standIds: ["g1"],
      eventoId: "evt-1",
      userEmail: "cliente@empresa.pe",
      userSub: "user-1",
      cuotas: [
        { porcentaje: 50, fechaVencimiento: "2099-01-15" },
        { porcentaje: 50, fechaVencimiento: "2099-06-15" },
      ],
    });

    expect(res.ok).toBe(false);
    expect(res.message).toContain("cronograma");
    expect(update).not.toHaveBeenCalled();
    expect(solicitudesRepo.guardarPlanCuotas).not.toHaveBeenCalled();
  });

  it("guarda la Modalidad 4 cuando el cronograma coincide con la configuracion", async () => {
    const { repo } = gessRepoCon([{ id: "g1", standCode: "A-1", eventoId: "evt-1", medidas: "7440.00 USD", bloqueId: "B-1" }]);
    const solicitudesRepo = {
      crearSolicitud: vi.fn(async () => "sol-1"),
      crearRevisionInicial: vi.fn(async () => ({})),
      guardarPlanCuotas: vi.fn(async () => undefined),
      crearAlertaRevision: vi.fn(async () => undefined),
      crearAlertaReserva: vi.fn(async () => undefined),
    } as unknown as ISolicitudesRepository;
    const svc = new ReservaApplicationService(
      repo,
      solicitudesRepo,
      authRepoFalso({
        configCuotas: {
          maxCuotas: 2,
          fechas: ["2099-01-15", "2099-06-15"],
          porcentajes: [60, 40],
        },
      }),
    );

    const res = await svc.crear({
      standIds: ["g1"],
      eventoId: "evt-1",
      userEmail: "cliente@empresa.pe",
      userSub: "user-1",
      cuotas: [
        { porcentaje: 60, fechaVencimiento: "2099-01-15" },
        { porcentaje: 40, fechaVencimiento: "2099-06-15" },
      ],
    });

    expect(res.ok).toBe(true);
    expect(solicitudesRepo.guardarPlanCuotas).toHaveBeenCalledWith(
      "sol-1",
      expect.objectContaining({ modalidad: "personalizado" }),
    );
  });
});
describe("ReservaApplicationService - moneda del contrato", () => {
  it("convierte el precio a soles antes del IGV y guarda el snapshot", async () => {
    const { repo } = gessRepoCon([{ id: "g1", standCode: "A-1", eventoId: "evt-1", medidas: "7440.00 USD", bloqueId: "B-1" }]);
    const solicitudesRepo = {
      crearSolicitud: vi.fn(async () => "sol-1"),
      crearRevisionInicial: vi.fn(async () => ({})),
      guardarPlanCuotas: vi.fn(async () => undefined),
      crearAlertaRevision: vi.fn(async () => undefined),
      crearAlertaReserva: vi.fn(async () => undefined),
    } as unknown as ISolicitudesRepository;
    const eventoRepo = {
      findById: vi.fn(async () => ({ tipoCambio: 3.75 })),
    } as unknown as IEventoRepository;
    const svc = new ReservaApplicationService(repo, solicitudesRepo, authRepoFalso(), undefined, undefined, eventoRepo);

    const res = await svc.crear({
      standIds: ["g1"],
      eventoId: "evt-1",
      userSub: "user-1",
      moneda: "PEN",
      cuotas: [{ porcentaje: 100, fechaVencimiento: "2026-11-15" }],
    });

    expect(res.ok).toBe(true);
    expect(solicitudesRepo.crearSolicitud).toHaveBeenCalledWith(
      ["g1"],
      "user-1",
      undefined,
      null,
      { actor: "user-1", ip: null },
      { moneda: "PEN", tipoCambio: 3.75 },
      undefined,
    );
    expect(solicitudesRepo.guardarPlanCuotas).toHaveBeenCalledWith(
      "sol-1",
      expect.objectContaining({ moneda: "PEN", tipoCambio: 3.75 }),
    );
  });
});

describe("ReservaApplicationService - tipo de solicitud", () => {
  it("marca como reserva_empresa la solicitud creada desde la reserva administrativa", async () => {
    const { repo } = gessRepoCon([{ id: "g1", standCode: "A-1", eventoId: "evt-1", estado: "pre_reservado", preReservaRuc: "20123456789", preReservaRazonSocial: "Empresa de Prueba S.A.C.", medidas: "7440.00 USD", bloqueId: "B-1" }]);
    const solicitudesRepo = {
      crearSolicitud: vi.fn(async () => "sol-1"),
      marcarOrdenPago: vi.fn(async () => undefined),
      guardarPlanCuotas: vi.fn(async () => undefined),
      crearAlertaRevision: vi.fn(async () => undefined),
      crearAlertaReserva: vi.fn(async () => undefined),
      habilitarContrato: vi.fn(async () => undefined),
    } as unknown as ISolicitudesRepository;
    const authRepo = {
      findPerfilByEmail: vi.fn(async () => ({ empresa: { ruc: "20123456789", razonSocial: "Empresa de Prueba S.A.C." } })),
      findByEmail: vi.fn(async () => [{ userId: "user-rep" }]),
    } as unknown as IAuthRepository;
    const empresaRepo = {
      findByRuc: vi.fn(async () => ({
        ruc: "20123456789",
        estado: "activa",
        razonSocial: "Empresa de Prueba S.A.C.",
        tipoDocumento: "6",
        tipoComprobante: "01",
        direccionFiscal: "Av. Prueba 123",
        telefono: null,
        emailContacto: "representante@empresa.pe",
        representanteCorreo: "representante@empresa.pe",
        representanteLegalNombre: "Representante Legal",
        representanteLegalDni: "12345678",
        representanteUserId: "user-rep",
      })),
    } as unknown as IEmpresaRepository;
    const contratoService = {
      generar: vi.fn(async () => ({ docxUrl: "/contrato.docx", pdfUrl: null, nombre: "contrato" })),
    };
    const svc = new ReservaApplicationService(
      repo,
      solicitudesRepo,
      authRepo,
      undefined,
      undefined,
      undefined,
      empresaRepo,
      contratoService as never,
    );

    const res = await svc.crearAdministrativa({
      eventoId: "evt-1",
      empresaRuc: "20123456789",
      standIds: ["g1"],
      moneda: "USD",
      tipoComprobante: "boleta",
      cuotas: [{ porcentaje: 100, fechaVencimiento: "2026-11-15" }],
      actorEmail: "admin@iimp.org.pe",
    });

    expect(res.ok).toBe(true);
    expect(vi.mocked(solicitudesRepo.crearSolicitud).mock.calls[0]?.[6]).toBe(
      TIPOS_SOLICITUD.RESERVA_EMPRESA,
    );
    expect(vi.mocked(solicitudesRepo.crearSolicitud).mock.calls[0]?.[3]).toEqual(
      expect.objectContaining({ tipoComprobante: "boleta" }),
    );
    expect(contratoService.generar).toHaveBeenCalledWith(expect.objectContaining({
      solicitudId: "sol-1",
      userEmail: "representante@empresa.pe",
    }));
    expect(solicitudesRepo.habilitarContrato).toHaveBeenCalledWith("sol-1");
    expect(solicitudesRepo.marcarOrdenPago).not.toHaveBeenCalled();
    expect(res.estado).toBe("pendiente");
  });

  it("rechaza una empresa sin representante legal con cuenta vinculada", async () => {
    const { repo } = gessRepoCon([{ id: "g1", standCode: "A-1", eventoId: "evt-1", medidas: "7440.00 USD", bloqueId: "B-1" }]);
    const solicitudesRepo = {
      crearSolicitud: vi.fn(async () => "sol-1"),
      marcarOrdenPago: vi.fn(async () => undefined),
    } as unknown as ISolicitudesRepository;
    const empresaRepo = {
      findByRuc: vi.fn(async () => ({
        ruc: "20123456789",
        estado: "activa",
        razonSocial: "Empresa sin representante S.A.C.",
        tipoDocumento: "6",
        tipoComprobante: "01",
        emailContacto: "contacto@empresa.pe",
        representanteCorreo: "representante@empresa.pe",
        representanteLegalNombre: "Representante Legal",
        representanteUserId: null,
      })),
    } as unknown as IEmpresaRepository;
    const svc = new ReservaApplicationService(
      repo,
      solicitudesRepo,
      authRepoFalso(),
      undefined,
      undefined,
      undefined,
      empresaRepo,
    );

    await expect(svc.crearAdministrativa({
      eventoId: "evt-1",
      empresaRuc: "20123456789",
      standIds: ["g1"],
      cuotas: [{ porcentaje: 100, fechaVencimiento: "2026-11-15" }],
      actorEmail: "admin@iimp.org.pe",
    })).rejects.toMatchObject({ status: 400 });

    expect(solicitudesRepo.crearSolicitud).not.toHaveBeenCalled();
  });
});
