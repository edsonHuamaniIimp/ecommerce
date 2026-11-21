import { describe, expect, it, vi } from "vitest";
import { TIPOS_SOLICITUD } from "@/lib/shared/constants";
import { enviarEmailPlantilla } from "@/lib/server/email";
import { notificarContratoObservadoSgc } from "../contrato-observado";

vi.mock("@/lib/server/email", () => ({
  enviarEmailPlantilla: vi.fn().mockResolvedValue(true),
}));

describe("notificarContratoObservadoSgc", () => {
  it("no envia correo interno para reserva_empresa", async () => {
    const solicitudes = {
      detalle: vi.fn().mockResolvedValue({
        tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA,
        standCode: "BLOQUE-868",
        empresa: "REPRESENTACIONES PERUVIAN TRADING S.A.",
      }),
      crearAlertaRevision: vi.fn().mockResolvedValue(undefined),
    };

    await notificarContratoObservadoSgc({
      solicitudId: "sol-1",
      resultado: {
        aplica: true,
        auto: false,
        yaRegenerado: false,
        error: null,
        observacion: {
          title: "Contrato",
          message: "Corrige el contrato",
          status: "open",
          requiresDocumentChange: true,
        },
      } as never,
      solicitudes: solicitudes as never,
      configuracion: {
        obtenerNotificacionesSolicitudes: vi.fn().mockResolvedValue(["admin@iimp.org.pe"]),
      } as never,
    });

    expect(solicitudes.crearAlertaRevision).toHaveBeenCalled();
    expect(enviarEmailPlantilla).not.toHaveBeenCalled();
  });
});
