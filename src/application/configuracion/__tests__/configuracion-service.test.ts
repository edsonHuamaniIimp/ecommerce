import { describe, expect, it, vi } from "vitest";
import { ConfiguracionApplicationService } from "../configuracion-service";
import { MAX_CONTACTOS_FACTURACION, MAX_RECEPTORES_NOTIFICACIONES_SOLICITUDES, PERMISSIONS } from "@/lib/shared/constants";
import type { IConfiguracionRepository } from "@/domain/ports/configuracion-repository";
import type { PortalConfigEntity } from "@/domain/models/configuracion";

vi.mock("@/lib/server/router", () => ({
  DomainError: class DomainError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 400) {
      super(message);
      this.name = "DomainError";
    }
  },
}));

/** Repositorio falso con la config guardada capturada. */
function fakeRepo(existente: PortalConfigEntity | null = null) {
  const guardados: unknown[] = [];
  const notificacionesGuardadas: string[][] = [];
  const repo = {
    obtenerPortal: vi.fn(async () => existente),
    guardarPortal: vi.fn(async (data: unknown) => {
      guardados.push(data);
      return { ...(data as object), updatedAt: new Date() } as PortalConfigEntity;
    }),
    obtenerNotificacionesSolicitudes: vi.fn(async () => []),
    guardarNotificacionesSolicitudes: vi.fn(async (emails: string[]) => {
      notificacionesGuardadas.push(emails);
      return emails;
    }),
  } as unknown as IConfiguracionRepository;
  return { repo, guardados, notificacionesGuardadas };
}

describe("ConfiguracionApplicationService", () => {
  it("autorizarGestion permite admin:full y portal:manage; rechaza al resto", () => {
    const service = new ConfiguracionApplicationService(fakeRepo().repo);
    expect(() => service.autorizarGestion([PERMISSIONS.ADMIN_FULL])).not.toThrow();
    expect(() => service.autorizarGestion([PERMISSIONS.PORTAL_MANAGE])).not.toThrow();
    expect(() => service.autorizarGestion([PERMISSIONS.EMPRESAS_MANAGE])).toThrowError(/Sin permiso/);
  });

  it("obtenerPortal devuelve config vacia si nunca se guardo", async () => {
    const service = new ConfiguracionApplicationService(fakeRepo().repo);
    const config = await service.obtenerPortal();
    expect(config).toMatchObject({ mesaAyudaEmail: null, contactoEmail: null, manualUrl: null, reglamentoUrl: null });
    expect(config.facturacionEmails).toEqual([]);
    expect(config.facturacionTelefonos).toEqual([]);
  });

  it("actualizarPortal normaliza vacios a null y guarda quien edito", async () => {
    const { repo, guardados } = fakeRepo();
    const service = new ConfiguracionApplicationService(repo);

    await service.actualizarPortal(
      { mesaAyudaEmail: "  soporte@iimp.org.pe ", contactoEmail: " c@iimp.org.pe ", manualUrl: "", reglamentoUrl: null },
      "admin@iimp.org.pe",
    );

    expect(guardados[0]).toEqual({
      mesaAyudaEmail: "soporte@iimp.org.pe",
      contactoEmail: "c@iimp.org.pe",
      facturacionEmails: [],
      facturacionTelefonos: [],
      manualUrl: null,
      reglamentoUrl: null,
      holdReservaMinutos: 25,
      maxStandsReserva: 2,
      mantenimientoActivo: false,
      mantenimientoInicio: null,
      mantenimientoFin: null,
      mantenimientoPermiteCerrar: false,
      updatedBy: "admin@iimp.org.pe",
    });
  });


  it("guarda receptores de nuevas solicitudes en minusculas, sin duplicados y con limite", async () => {
    const { repo, notificacionesGuardadas } = fakeRepo();
    const service = new ConfiguracionApplicationService(repo);

    await service.actualizarNotificacionesSolicitudes(
      [" Analista@IIMP.org.pe ", "analista@iimp.org.pe", "compras@iimp.org.pe"],
      [PERMISSIONS.PORTAL_MANAGE],
      "admin@iimp.org.pe",
    );

    expect(notificacionesGuardadas[0]).toEqual(["analista@iimp.org.pe", "compras@iimp.org.pe"]);
    await expect(service.actualizarNotificacionesSolicitudes(
      Array.from({ length: MAX_RECEPTORES_NOTIFICACIONES_SOLICITUDES + 1 }, (_, i) => `r${i}@iimp.org.pe`),
      [PERMISSIONS.PORTAL_MANAGE],
      null,
    )).rejects.toMatchObject({ status: 400 });
  });

  it("exige permiso portal:manage para guardar receptores", async () => {
    const service = new ConfiguracionApplicationService(fakeRepo().repo);
    await expect(
      service.actualizarNotificacionesSolicitudes(["a@iimp.org.pe"], [PERMISSIONS.EMPRESAS_MANAGE], null),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("exige inicio y fin cuando el mantenimiento esta activo", async () => {
    const service = new ConfiguracionApplicationService(fakeRepo().repo);
    await expect(
      service.actualizarPortal({ mantenimientoActivo: true }, null),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rechaza una ventana de mantenimiento con fin anterior al inicio", async () => {
    const service = new ConfiguracionApplicationService(fakeRepo().repo);
    await expect(
      service.actualizarPortal(
        {
          mantenimientoActivo: true,
          mantenimientoInicio: "2026-10-20T12:00:00.000Z",
          mantenimientoFin: "2026-10-20T10:00:00.000Z",
        },
        null,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("guarda los minutos de bloqueo configurados y valida el rango", async () => {
    const { repo, guardados } = fakeRepo();
    const service = new ConfiguracionApplicationService(repo);

    await service.actualizarPortal({ holdReservaMinutos: 40 }, "admin@iimp.org.pe");

    expect(guardados[0]).toEqual(expect.objectContaining({ holdReservaMinutos: 40 }));
    await expect(service.actualizarPortal({ holdReservaMinutos: 0 }, null)).rejects.toMatchObject({ status: 400 });
    await expect(service.actualizarPortal({ holdReservaMinutos: 121 }, null)).rejects.toMatchObject({ status: 400 });
  });

  it("guarda el maximo de stands configurado y valida el rango", async () => {
    const { repo, guardados } = fakeRepo();
    const service = new ConfiguracionApplicationService(repo);

    await service.actualizarPortal({ maxStandsReserva: 3 }, "admin@iimp.org.pe");

    expect(guardados[0]).toEqual(expect.objectContaining({ maxStandsReserva: 3 }));
    await expect(service.actualizarPortal({ maxStandsReserva: 0 }, null)).rejects.toMatchObject({ status: 400 });
    await expect(service.actualizarPortal({ maxStandsReserva: 51 }, null)).rejects.toMatchObject({ status: 400 });
  });

  it("rechaza correos invalidos y URLs sin http(s)", async () => {
    const service = new ConfiguracionApplicationService(fakeRepo().repo);
    await expect(service.actualizarPortal({ mesaAyudaEmail: "no-es-correo" }, null)).rejects.toMatchObject({ status: 400 });
    await expect(service.actualizarPortal({ manualUrl: "ftp://archivos" }, null)).rejects.toMatchObject({ status: 400 });
  });

  it("guarda varios correos y telefonos de facturacion con trim y deduplicado", async () => {
    const { repo, guardados } = fakeRepo();
    const service = new ConfiguracionApplicationService(repo);

    await service.actualizarPortal(
      {
        facturacionEmails: [" facturacion@iimp.org.pe ", "cobranzas@iimp.org.pe", "facturacion@iimp.org.pe", ""],
        facturacionTelefonos: [" +51 999 888 777 ", "+51 999 888 777", "01 555 1234"],
      },
      null,
    );

    expect(guardados[0]).toEqual(expect.objectContaining({
      facturacionEmails: ["facturacion@iimp.org.pe", "cobranzas@iimp.org.pe"],
      facturacionTelefonos: ["+51 999 888 777", "01 555 1234"],
    }));
  });

  it("rechaza contactos de facturacion invalidos o que superan el maximo", async () => {
    const service = new ConfiguracionApplicationService(fakeRepo().repo);
    await expect(service.actualizarPortal({ facturacionEmails: ["no-es-correo"] }, null)).rejects.toMatchObject({ status: 400 });
    await expect(service.actualizarPortal({ facturacionTelefonos: ["abc"] }, null)).rejects.toMatchObject({ status: 400 });
    const seis = Array.from({ length: MAX_CONTACTOS_FACTURACION + 1 }, (_, i) => `contacto${i}@iimp.org.pe`);
    await expect(service.actualizarPortal({ facturacionEmails: seis }, null)).rejects.toMatchObject({ status: 400 });
  });
});
