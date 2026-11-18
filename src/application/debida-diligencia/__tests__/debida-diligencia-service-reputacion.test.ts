import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import {
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_RESULTADOS,
  DD_REPUTACION_ESTADOS,
  DD_REPUTACION_ORDEN,
  DD_REPUTACION_RESULTADOS,
  PERMISSIONS,
} from "@/lib/shared/constants";

function crearServicio() {
  const repo = {
    actualizarReputacion: vi.fn().mockResolvedValue({
      derivadoPor: "sig@iimp.org.pe",
      vinculoId: "v-1",
    }),
    actualizarDictamenMatriz: vi.fn().mockResolvedValue(undefined),
    iniciarReputacion: vi.fn().mockResolvedValue({
      estado: DD_REPUTACION_ESTADOS.EN_ANALISIS,
      vinculoId: "v-1",
    }),
    actualizarObservacionReputacion: vi.fn().mockResolvedValue({
      derivadoPor: "sig@iimp.org.pe",
      vinculoId: "v-1",
    }),
    actualizarObservacionMatriz: vi.fn().mockResolvedValue(undefined),
    registrarAuditoria: vi.fn().mockResolvedValue(undefined),
    listarReputacion: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      perPage: 10,
      totalPages: 0,
    }),
  } as unknown as IDebidaDiligenciaRepository;
  const notificaciones = {
    notificarLogistica: vi.fn(),
  } as unknown as IDebidaDiligenciaNotificacionPort;
  const servicio = new DebidaDiligenciaApplicationService(
    repo,
    {} as IAuthRepository,
    notificaciones,
    {} as IDebidaDiligenciaDocumentoValidator,
  );
  return { servicio, repo };
}

describe("reputacionResolver", () => {
  it("refleja el dictamen en la fila de matriz del vínculo", async () => {
    const { servicio, repo } = crearServicio();

    await servicio.reputacionResolver(
      {
        id: "caso-1",
        resultado: DD_REPUTACION_RESULTADOS.SIN_HALLAZGOS,
        comentario: "Sin antecedentes.",
        linkHallazgos: null,
        cerrar: true,
        notificar: false,
      },
      {
        email: "comunicaciones@iimp.org.pe",
        roles: [],
        permissions: [PERMISSIONS.DD_REPUTACION],
        eventoId: "evento-1",
      },
    );

    expect(repo.actualizarDictamenMatriz).toHaveBeenCalledWith(
      "v-1",
      expect.objectContaining({
        resultado: DD_MATRIZ_RESULTADOS.ACEPTADO,
        conclusion: DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES,
        observaciones: "Sin antecedentes.",
        responsable: "comunicaciones@iimp.org.pe",
      }),
    );
  });

  it("marca el vínculo en revisión al comenzar la revisión", async () => {
    const { servicio, repo } = crearServicio();

    const resultado = await servicio.iniciarReputacion("caso-1", {
      email: "comunicaciones@iimp.org.pe",
      roles: [],
      permissions: [PERMISSIONS.DD_REPUTACION],
      eventoId: "evento-1",
    });

    expect(resultado.estado).toBe(DD_REPUTACION_ESTADOS.EN_ANALISIS);
    expect(repo.iniciarReputacion).toHaveBeenCalledWith(
      "caso-1",
      "comunicaciones@iimp.org.pe",
    );
  });

  it("guarda un borrador sin cerrar ni escribir en la matriz", async () => {
    const { servicio, repo } = crearServicio();

    await servicio.reputacionObservar(
      {
        id: "caso-1",
        resultado: DD_REPUTACION_RESULTADOS.ACEPTADO,
        comentario: "Se encontró una nota de prensa.",
        linkHallazgos: "https://ejemplo.pe/nota",
        cerrar: false,
        notificar: false,
      },
      {
        email: "comunicaciones@iimp.org.pe",
        roles: [],
        permissions: [PERMISSIONS.DD_REPUTACION],
        eventoId: "evento-1",
      },
    );

    expect(repo.actualizarObservacionReputacion).toHaveBeenCalledWith(
      "caso-1",
      expect.objectContaining({
        estado: DD_REPUTACION_ESTADOS.EN_ANALISIS,
        resultado: DD_REPUTACION_RESULTADOS.ACEPTADO,
        comentario: "Se encontró una nota de prensa.",
        linkHallazgos: "https://ejemplo.pe/nota",
      }),
    );
    expect(repo.actualizarObservacionMatriz).not.toHaveBeenCalled();
    expect(repo.actualizarDictamenMatriz).not.toHaveBeenCalled();
  });

  it("al guardar y cerrar refleja el resultado en la matriz", async () => {
    const { servicio, repo } = crearServicio();

    await servicio.reputacionObservar(
      {
        id: "caso-1",
        resultado: DD_REPUTACION_RESULTADOS.OBSERVADO,
        comentario: "Antecedente registrado.",
        linkHallazgos: "https://ejemplo.pe/fuente",
        cerrar: true,
        notificar: false,
      },
      {
        email: "comunicaciones@iimp.org.pe",
        roles: [],
        permissions: [PERMISSIONS.DD_REPUTACION],
        eventoId: "evento-1",
      },
    );

    expect(repo.actualizarObservacionReputacion).toHaveBeenCalledWith(
      "caso-1",
      expect.objectContaining({
        estado: DD_REPUTACION_ESTADOS.CERRADA,
        resultado: DD_REPUTACION_RESULTADOS.OBSERVADO,
      }),
    );
    expect(repo.actualizarObservacionMatriz).toHaveBeenCalledWith(
      "v-1",
      expect.objectContaining({
        resultado: DD_REPUTACION_RESULTADOS.OBSERVADO,
        observaciones: "Antecedente registrado.\nFuente: https://ejemplo.pe/fuente",
      }),
    );
  });

  it("guarda los términos OBSERVADO y REQUIERE DEBIDA DILIGENCIA en la matriz", async () => {
    const { servicio, repo } = crearServicio();
    const sesion = {
      email: "comunicaciones@iimp.org.pe",
      roles: [],
      permissions: [PERMISSIONS.DD_REPUTACION],
      eventoId: "evento-1",
    };

    await servicio.reputacionResolver(
      {
        id: "caso-1",
        resultado: DD_REPUTACION_RESULTADOS.OBSERVADO,
        comentario: "Antecedente registrado.",
        linkHallazgos: "https://ejemplo.pe/fuente",
        cerrar: false,
        notificar: false,
      },
      sesion,
    );
    expect(repo.actualizarDictamenMatriz).toHaveBeenLastCalledWith(
      "v-1",
      expect.objectContaining({
        resultado: DD_MATRIZ_RESULTADOS.OBSERVADO,
        conclusion: DD_MATRIZ_CONCLUSIONES.OBSERVADO,
      }),
    );

    await servicio.reputacionResolver(
      {
        id: "caso-1",
        resultado: DD_REPUTACION_RESULTADOS.REQUIERE_DEBIDA_DILIGENCIA,
        comentario: "Requiere revisión adicional.",
        linkHallazgos: "https://ejemplo.pe/fuente",
        cerrar: false,
        notificar: false,
      },
      sesion,
    );
    expect(repo.actualizarDictamenMatriz).toHaveBeenLastCalledWith(
      "v-1",
      expect.objectContaining({
        resultado: DD_MATRIZ_RESULTADOS.OBSERVADO,
        conclusion: DD_MATRIZ_CONCLUSIONES.REQUIERE_DEBIDA_DILIGENCIA,
      }),
    );
  });
});

describe("reputacionListar", () => {
  it("traslada el rango de fechas y el orden al repositorio", async () => {
    const { servicio, repo } = crearServicio();

    await servicio.reputacionListar(
      {
        page: 2,
        perPage: 15,
        search: "  empresa  ",
        estado: "por_revisar",
        desde: "2026-01-01",
        hasta: "2026-01-31",
        orden: DD_REPUTACION_ORDEN.ANTIGUOS,
      },
      {
        email: "comunicaciones@iimp.org.pe",
        roles: [],
        permissions: [PERMISSIONS.DD_REPUTACION],
        eventoId: "evento-1",
      },
    );

    expect(repo.listarReputacion).toHaveBeenCalledWith({
      eventoId: "evento-1",
      page: 2,
      perPage: 15,
      search: "empresa",
      estado: "por_revisar",
      desde: "2026-01-01",
      hasta: "2026-01-31",
      orden: DD_REPUTACION_ORDEN.ANTIGUOS,
    });
  });
});
