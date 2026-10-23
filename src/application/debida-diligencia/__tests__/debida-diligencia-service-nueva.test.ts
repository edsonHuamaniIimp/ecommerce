import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type { DdExpedienteEntity } from "@/domain/models/debida-diligencia";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import { DD_ESTADOS, PERMISSIONS } from "@/lib/shared/constants";

const EXPEDIENTE = {
  id: "exp-1",
  codigo: "DD-2026-0001",
  estado: DD_ESTADOS.APROBADA,
  fechaVencimiento: new Date("2020-01-01"),
} as DdExpedienteEntity;

function crearServicio(actual: DdExpedienteEntity | null) {
  const nuevo = { ...EXPEDIENTE, id: "exp-2", codigo: "DD-2026-0002", estado: DD_ESTADOS.BORRADOR };
  const repo = {
    findExpedientePorEmpresaEvento: vi.fn().mockResolvedValue(actual),
    siguienteCodigo: vi.fn().mockResolvedValue("DD-2026-0002"),
    crearExpediente: vi.fn().mockResolvedValue(nuevo),
    registrarAuditoria: vi.fn().mockResolvedValue(undefined),
  } as unknown as IDebidaDiligenciaRepository;
  const authRepo = {
    findEmpresaIdDeUsuario: vi.fn().mockResolvedValue("emp-1"),
  } as unknown as IAuthRepository;
  return {
    repo,
    servicio: new DebidaDiligenciaApplicationService(
      repo,
      authRepo,
      {} as IDebidaDiligenciaNotificacionPort,
      {} as IDebidaDiligenciaDocumentoValidator,
    ),
  };
}

const session = {
  email: "cliente@empresa.pe",
  roles: [],
  permissions: [PERMISSIONS.DD_FORMULARIO],
  eventoId: "evento-1",
};

describe("iniciarNueva", () => {
  it("crea una nueva DD cuando la aprobada ya venció", async () => {
    const { servicio, repo } = crearServicio(EXPEDIENTE);

    const nuevo = await servicio.iniciarNueva(session);

    expect(nuevo.id).toBe("exp-2");
    expect(repo.crearExpediente).toHaveBeenCalledWith(
      expect.objectContaining({ empresaId: "emp-1", eventoId: "evento-1" }),
    );
  });

  it("calcula los 6 meses desde la aprobacion cuando falta la fecha de cese", async () => {
    const vencida = {
      ...EXPEDIENTE,
      fechaVencimiento: null,
      fechaAprobacion: new Date("2020-01-01"),
    };
    const { servicio, repo } = crearServicio(vencida);

    await servicio.iniciarNueva(session);

    expect(repo.crearExpediente).toHaveBeenCalled();
  });

  it("mantiene vigente una aprobacion reciente sin fecha de cese", async () => {
    const vigente = {
      ...EXPEDIENTE,
      fechaVencimiento: null,
      fechaAprobacion: new Date(),
    };
    const { servicio } = crearServicio(vigente);

    await expect(servicio.iniciarNueva(session)).rejects.toThrow("no puede renovarse");
  });

  it("crea una nueva DD cuando la anterior fue rechazada", async () => {
    const rechazada = { ...EXPEDIENTE, estado: DD_ESTADOS.RECHAZADA, fechaVencimiento: null };
    const { servicio, repo } = crearServicio(rechazada);

    await servicio.iniciarNueva(session);

    expect(repo.crearExpediente).toHaveBeenCalled();
  });

  it("reutiliza el borrador editable y no crea otro", async () => {
    const borrador = { ...EXPEDIENTE, estado: DD_ESTADOS.BORRADOR };
    const { servicio, repo } = crearServicio(borrador);

    const resultado = await servicio.iniciarNueva(session);

    expect(resultado).toBe(borrador);
    expect(repo.crearExpediente).not.toHaveBeenCalled();
  });

  it("bloquea la renovación de una DD aprobada todavía vigente", async () => {
    const vigente = {
      ...EXPEDIENTE,
      fechaVencimiento: new Date("2099-01-01"),
    };
    const { servicio } = crearServicio(vigente);

    await expect(servicio.iniciarNueva(session)).rejects.toThrow("aún no puede renovarse");
  });
});
