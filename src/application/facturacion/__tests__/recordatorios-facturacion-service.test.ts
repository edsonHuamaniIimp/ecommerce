import { describe, it, expect, vi } from "vitest";
import { RecordatoriosFacturacionApplicationService } from "../recordatorios-facturacion-service";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { RECORDATORIOS_FACTURACION } from "@/lib/shared/constants";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IFacturacionRepository, RecordatorioCandidatoRow } from "@/domain/ports/facturacion-repository";
import type { IReservaIimpClient } from "@/domain/ports/reserva-iimp-client";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));
vi.mock("@/lib/server/email", () => ({
  enviarEmailPlantilla: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/server/idioma", () => ({
  resolverIdiomaPeticion: vi.fn().mockResolvedValue("es"),
}));

function candidato(overrides: Partial<RecordatorioCandidatoRow> = {}): RecordatorioCandidatoRow {
  return {
    facturacionId: "f1",
    solicitudId: "s1",
    standCode: "44",
    empresa: "ACME S.A.C.",
    email: "pagos@acme.pe",
    moneda: "US$",
    cuotasPendientes: 1,
    montoPendiente: 1000,
    requisitos: null,
    iimpContrato: null,
    iimpCuentaCorriente: null,
    ...overrides,
  };
}

function crearSvc(rows: RecordatorioCandidatoRow[], archivos: (solicitudId: string) => Promise<unknown> = async () => []) {
  const repo = {
    listarCandidatosRecordatorio: vi.fn().mockResolvedValue(rows),
    registrarNotificacionRecordatorio: vi.fn().mockResolvedValue(undefined),
  } as unknown as Pick<IFacturacionRepository, "listarCandidatosRecordatorio" | "registrarNotificacionRecordatorio">;
  const reserva = {
    listarArchivos: vi.fn().mockImplementation(({ numeroSolicitud }: { numeroSolicitud: string }) => archivos(numeroSolicitud)),
  } as unknown as Pick<IReservaIimpClient, "listarArchivos">;
  const auth = { findPerfilByEmail: vi.fn().mockResolvedValue(null) } as unknown as IAuthRepository;
  return { svc: new RecordatoriosFacturacionApplicationService(repo, reserva, auth), repo };
}

describe("RecordatoriosFacturacionApplicationService", () => {
  it("separa sin solicitud y documentos pendientes, ignorando pagadas, sin requisitos o sin verificar", async () => {
    const rows = [
      candidato(),
      candidato({
        facturacionId: "f2",
        solicitudId: "s2",
        empresa: "BETA S.A.C.",
        email: "pagos@beta.pe",
        iimpContrato: "0000000001",
        iimpCuentaCorriente: "7",
        requisitos: { oc: true, hes: true, cuota: 1 },
      }),
      candidato({
        facturacionId: "f3",
        solicitudId: "s3",
        iimpContrato: "0000000002",
        iimpCuentaCorriente: "8",
        requisitos: { oc: true, cuota: 1 },
      }),
      candidato({
        facturacionId: "f4",
        solicitudId: "s4",
        iimpContrato: "0000000003",
        iimpCuentaCorriente: "9",
        requisitos: { hes: true, cuota: 1 },
      }),
      candidato({ facturacionId: "f5", cuotasPendientes: 0, montoPendiente: 0 }),
      candidato({
        facturacionId: "f6",
        iimpContrato: "0000000004",
        iimpCuentaCorriente: "10",
        requisitos: { ninguna: true },
      }),
    ];
    const { svc } = crearSvc(rows, async (numeroSolicitud) => {
      if (numeroSolicitud.endsWith("s2")) return [{ tipo: "OC", cuota: null }, { tipo: "DETRACCION", cuota: 1 }];
      if (numeroSolicitud.endsWith("s3")) return [{ tipo: "OC", cuota: 1 }];
      throw new Error("IIMP no disponible");
    });

    const resultado = await svc.listarCandidatos();

    expect(resultado.sinSolicitud.map((c) => c.facturacionId)).toEqual(["f1"]);
    expect(resultado.documentosPendientes).toEqual([
      expect.objectContaining({ facturacionId: "f2", faltantes: ["HES"] }),
    ]);
    expect(resultado.noVerificados).toBe(1);
  });

  it("envia el recordatorio de solicitud y registra el historial", async () => {
    const { svc, repo } = crearSvc([candidato()]);

    const resultado = await svc.enviar(
      { tipo: RECORDATORIOS_FACTURACION.SIN_SOLICITUD, facturacionIds: ["f1"] },
      "facturacion@iimp.org.pe",
    );

    expect(resultado).toEqual({ enviados: 1, fallidos: 0, detalle: [{ facturacionId: "f1", ok: true }] });
    expect(enviarEmailPlantilla).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "pagos@acme.pe",
        plantilla: "facturacion-recordatorio-solicitud",
        datos: { razonSocial: "ACME S.A.C.", standCodes: "44" },
      }),
    );
    expect(repo.registrarNotificacionRecordatorio).toHaveBeenCalledWith(
      "f1",
      expect.stringContaining("pagos@acme.pe"),
      "facturacion@iimp.org.pe",
    );
  });

  it("envia el recordatorio de documentos con las etiquetas de los faltantes", async () => {
    const { svc, repo } = crearSvc(
      [
        candidato({
          facturacionId: "f2",
          solicitudId: "s2",
          iimpContrato: "0000000001",
          iimpCuentaCorriente: "7",
          requisitos: { oc: true, hes: true, cuota: 1 },
        }),
      ],
      async () => [{ tipo: "OC", cuota: null }],
    );

    const resultado = await svc.enviar(
      { tipo: RECORDATORIOS_FACTURACION.DOCUMENTOS_PENDIENTES, facturacionIds: ["f2"] },
      "facturacion@iimp.org.pe",
    );

    expect(resultado.enviados).toBe(1);
    expect(enviarEmailPlantilla).toHaveBeenCalledWith(
      expect.objectContaining({
        plantilla: "facturacion-recordatorio-documentos",
        datos: expect.objectContaining({ faltantes: ["Hoja de entrada (HES)"] }),
      }),
    );
    expect(repo.registrarNotificacionRecordatorio).toHaveBeenCalledTimes(1);
  });

  it("reporta fallos sin registrar historial si el correo no se envia", async () => {
    vi.mocked(enviarEmailPlantilla).mockResolvedValueOnce(false);
    const { svc, repo } = crearSvc([candidato()]);

    const resultado = await svc.enviar(
      { tipo: RECORDATORIOS_FACTURACION.SIN_SOLICITUD, facturacionIds: ["f1"] },
      "facturacion@iimp.org.pe",
    );

    expect(resultado).toMatchObject({ enviados: 0, fallidos: 1 });
    expect(repo.registrarNotificacionRecordatorio).not.toHaveBeenCalled();
  });

  it("rechaza ids que ya no cumplen el criterio", async () => {
    const { svc } = crearSvc([candidato()]);

    const resultado = await svc.enviar(
      { tipo: RECORDATORIOS_FACTURACION.DOCUMENTOS_PENDIENTES, facturacionIds: ["f1"] },
      "facturacion@iimp.org.pe",
    );

    expect(resultado).toMatchObject({ enviados: 0, fallidos: 1 });
    expect(resultado.detalle[0]?.error).toContain("no cumple");
  });

  it("no notifica empresas sin correo", async () => {
    const { svc } = crearSvc([candidato({ email: null })]);

    const resultado = await svc.enviar(
      { tipo: RECORDATORIOS_FACTURACION.SIN_SOLICITUD, facturacionIds: ["f1"] },
      "facturacion@iimp.org.pe",
    );

    expect(resultado).toMatchObject({ enviados: 0, fallidos: 1 });
    expect(resultado.detalle[0]?.error).toContain("correo");
  });

  it("rechaza un tipo de recordatorio invalido", async () => {
    const { svc } = crearSvc([]);

    await expect(
      svc.enviar({ tipo: "otro" as never, facturacionIds: ["f1"] }, "facturacion@iimp.org.pe"),
    ).rejects.toMatchObject({ status: 400 });
  });
});
