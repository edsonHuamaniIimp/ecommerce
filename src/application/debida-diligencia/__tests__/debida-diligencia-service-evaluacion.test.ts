import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type { DdEmpresaEstadoEntity, DdEmpresaResumen, DdExpedienteEntity } from "@/domain/models/debida-diligencia";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import {
  DD_DOCUMENTO_ESTADOS,
  DD_DOCUMENTOS,
  DD_ESTADOS,
  DD_ORIGENES,
  DD_RESULTADOS,
  PERMISSIONS,
} from "@/lib/shared/constants";

const EMPRESA = {
  id: "emp-1",
  ruc: "20312372895",
  razonSocial: "YURA S.A.",
  nombreComercial: null,
  sitioWeb: null,
  emailContacto: null,
  representanteLegalNombre: null,
  representanteLegalDni: null,
  representanteCorreo: null,
  logoUrl: null,
} satisfies DdEmpresaResumen;

const EXPEDIENTE_BASE = {
  id: "exp-1",
  empresaId: EMPRESA.id,
  eventoId: "evento-1",
  codigo: "DD-2026-0001",
  estado: DD_ESTADOS.RECHAZADA,
  declaraVerdad: true,
  fechaVencimiento: null,
  empresa: EMPRESA,
  documentos: [],
  observaciones: [],
} as unknown as DdExpedienteEntity;

function crearServicio(
  expediente: DdExpedienteEntity | null = null,
  empresaId: string | null = EMPRESA.id,
  estadoExterno: DdEmpresaEstadoEntity | null = null,
) {
  const repo = {
    findExpedientePorEmpresaEvento: vi.fn().mockResolvedValue(expediente),
    findExpedienteAprobadoVigentePorEmpresa: vi.fn().mockResolvedValue(null),
    tieneExpedienteImportadoAprobadoVigente: vi.fn().mockResolvedValue(false),
    findExpedienteAprobadoVigentePorEmpresaEvento: vi.fn().mockResolvedValue(expediente),
    findEmpresaResumen: vi.fn().mockResolvedValue(empresaId ? EMPRESA : null),
    findEmpresaEstado: vi.fn().mockResolvedValue(estadoExterno),
  } as unknown as IDebidaDiligenciaRepository;
  const authRepo = {
    findEmpresaIdDeUsuario: vi.fn().mockResolvedValue(empresaId),
  } as unknown as IAuthRepository;
  const servicio = new DebidaDiligenciaApplicationService(
    repo,
    authRepo,
    {} as IDebidaDiligenciaNotificacionPort,
    {} as IDebidaDiligenciaDocumentoValidator,
  );
  return { servicio, repo, authRepo };
}

describe("obtenerMiExpediente", () => {
  it("usa la DD aprobada vigente de otro evento cuando no hay DD en el evento activo", async () => {
    const { servicio, repo } = crearServicio(null);
    const otroEvento = {
      ...EXPEDIENTE_BASE,
      id: "exp-otro",
      eventoId: "evento-2",
      estado: DD_ESTADOS.APROBADA,
      origen: DD_ORIGENES.IMPORTADO,
      fechaAprobacion: new Date(),
      fechaVencimiento: new Date("2099-01-01"),
    } as DdExpedienteEntity;
    (repo.findExpedienteAprobadoVigentePorEmpresa as ReturnType<typeof vi.fn>).mockResolvedValue(
      otroEvento,
    );

    const resultado = await servicio.obtenerMiExpediente({
      email: "cliente@iimp.org.pe",
      roles: [],
      permissions: [PERMISSIONS.DD_FORMULARIO],
      eventoId: "evento-1",
    });

    expect(resultado.esOtroEvento).toBe(true);
    expect(resultado.expediente?.id).toBe("exp-otro");
    expect(resultado.puedeRegularizarDeclaracionVigencia).toBe(true);
  });

  it("no exige revalidación para una DD importada del evento activo", async () => {
    const activa = {
      ...EXPEDIENTE_BASE,
      id: "exp-activa-importada",
      estado: DD_ESTADOS.APROBADA,
      origen: DD_ORIGENES.IMPORTADO,
      fechaAprobacion: new Date("2026-06-03"),
      fechaVencimiento: new Date("2099-01-01"),
      documentos: [],
    } as DdExpedienteEntity;
    const { servicio } = crearServicio(activa);

    const resultado = await servicio.obtenerMiExpediente({
      email: "cliente@iimp.org.pe",
      roles: [],
      permissions: [PERMISSIONS.DD_FORMULARIO],
      eventoId: "evento-1",
    });

    expect(resultado.esOtroEvento).toBe(false);
    expect(resultado.requiereDeclaracionVigencia).toBe(false);
    expect(resultado.puedeRegularizarDeclaracionVigencia).toBe(false);
    expect(resultado.declaracionVigenciaEstado).toBeNull();
  });

  it("prioriza una DD vigente sobre un borrador del evento activo", async () => {
    const borrador = {
      ...EXPEDIENTE_BASE,
      id: "exp-borrador",
      estado: DD_ESTADOS.BORRADOR,
    } as DdExpedienteEntity;
    const { servicio, repo } = crearServicio(borrador);
    const vigente = {
      ...EXPEDIENTE_BASE,
      id: "exp-vigente",
      eventoId: "evento-1",
      estado: DD_ESTADOS.APROBADA,
      fechaAprobacion: new Date(),
      fechaVencimiento: new Date("2099-01-01"),
    } as DdExpedienteEntity;
    (repo.findExpedienteAprobadoVigentePorEmpresa as ReturnType<typeof vi.fn>).mockResolvedValue(
      vigente,
    );

    const resultado = await servicio.obtenerMiExpediente({
      email: "cliente@iimp.org.pe",
      roles: [],
      permissions: [PERMISSIONS.DD_FORMULARIO],
      eventoId: "evento-1",
    });

    expect(resultado.esOtroEvento).toBe(false);
    expect(resultado.expediente?.id).toBe("exp-vigente");
  });

  it("mantiene la DD activa cuando ya esta aprobada y vigente", async () => {
    const activa = {
      ...EXPEDIENTE_BASE,
      id: "exp-activa",
      eventoId: "evento-1",
      estado: DD_ESTADOS.APROBADA,
      fechaAprobacion: new Date(),
      fechaVencimiento: new Date("2099-01-01"),
    } as DdExpedienteEntity;
    const { servicio, repo } = crearServicio(activa);

    const resultado = await servicio.obtenerMiExpediente({
      email: "cliente@iimp.org.pe",
      roles: [],
      permissions: [PERMISSIONS.DD_FORMULARIO],
      eventoId: "evento-1",
    });

    expect(resultado.esOtroEvento).toBe(false);
    expect(resultado.expediente?.id).toBe("exp-activa");
    expect(repo.findExpedienteAprobadoVigentePorEmpresa).not.toHaveBeenCalled();
  });
});

describe("evaluacionDeUsuario", () => {
  it("bloquea cuando la cuenta no tiene empresa o expediente DD", async () => {
    const { servicio } = crearServicio(null, null);
    const evaluacion = await servicio.evaluacionDeUsuario("sin-empresa@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(false);
    expect(evaluacion.resultado).toBe(DD_RESULTADOS.PENDIENTE);
    expect(evaluacion.mensaje).toContain("no ha pasado por Debida Diligencia");
  });

  it("bloquea y reporta el rechazo de la debida diligencia", async () => {
    const { servicio } = crearServicio(EXPEDIENTE_BASE);
    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(false);
    expect(evaluacion.resultado).toBe(DD_RESULTADOS.NO_APTO);
    expect(evaluacion.mensaje).toContain("fue rechazada");
  });

  it("marca APTO pendiente de declaración cuando la DD vigente es de otro evento", async () => {
    const { servicio, repo } = crearServicio(null);
    const vigenteOtroEvento = {
      ...EXPEDIENTE_BASE,
      id: "exp-otro",
      eventoId: "evento-2",
      estado: DD_ESTADOS.APROBADA,
      origen: DD_ORIGENES.IMPORTADO,
      fechaAprobacion: new Date("2026-06-16"),
      fechaVencimiento: new Date("2026-12-16"),
      documentos: [],
    } as DdExpedienteEntity;
    (repo.findExpedienteAprobadoVigentePorEmpresa as ReturnType<typeof vi.fn>).mockResolvedValue(
      vigenteOtroEvento,
    );

    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.resultado).toBe(DD_RESULTADOS.APTO);
    expect(evaluacion.aptoParaContratar).toBe(false);
    expect(evaluacion.requiereDeclaracionVigencia).toBe(true);
    expect(evaluacion.mensaje).toContain("Declaración jurada de vigencia");
  });

  it("permite contratar cuando la declaracion ya esta aprobada", async () => {
    const aprobada = {
      ...EXPEDIENTE_BASE,
      estado: DD_ESTADOS.APROBADA,
      origen: DD_ORIGENES.IMPORTADO,
      fechaAprobacion: new Date("2026-06-03"),
      fechaVencimiento: new Date("2099-01-01"),
      documentos: [
        {
          tipo: DD_DOCUMENTOS.DECLARACION_VIGENCIA,
          estado: DD_DOCUMENTO_ESTADOS.APROBADO,
        },
      ],
    } as DdExpedienteEntity;
    const { servicio } = crearServicio(aprobada);
    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(true);
    expect(evaluacion.requiereDeclaracionVigencia).toBe(false);
    expect(evaluacion.declaracionVigenciaEstado).toBe(DD_DOCUMENTO_ESTADOS.APROBADO);
  });

  it("permite revisar con una DD aprobada y vigente", async () => {
    const aprobada = {
      ...EXPEDIENTE_BASE,
      estado: DD_ESTADOS.APROBADA,
      fechaVencimiento: new Date("2099-01-01"),
    } as DdExpedienteEntity;
    const { servicio } = crearServicio(aprobada);
    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(true);
    expect(evaluacion.resultado).toBe(DD_RESULTADOS.APTO);
    expect(evaluacion.mensaje).toBeNull();
  });

  it("no bloquea una DD importada aprobada del evento activo", async () => {
    const aprobada = {
      ...EXPEDIENTE_BASE,
      estado: DD_ESTADOS.APROBADA,
      origen: DD_ORIGENES.IMPORTADO,
      fechaAprobacion: new Date("2026-10-19"),
      fechaVencimiento: new Date("2099-04-19"),
      documentos: [],
    } as DdExpedienteEntity;
    const { servicio } = crearServicio(aprobada);
    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(true);
    expect(evaluacion.requiereDeclaracionVigencia).toBe(false);
    expect(evaluacion.declaracionVigenciaEstado).toBeNull();
  });

  it("bloquea una DD importada mientras la declaracion esta cargada", async () => {
    const aprobada = {
      ...EXPEDIENTE_BASE,
      eventoId: "evento-2",
      estado: DD_ESTADOS.APROBADA,
      origen: DD_ORIGENES.IMPORTADO,
      fechaAprobacion: new Date("2026-06-03"),
      fechaVencimiento: new Date("2099-01-01"),
      documentos: [
        {
          tipo: DD_DOCUMENTOS.DECLARACION_VIGENCIA,
          estado: DD_DOCUMENTO_ESTADOS.CARGADO,
        },
      ],
    } as DdExpedienteEntity;
    const { servicio } = crearServicio(aprobada);
    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.resultado).toBe(DD_RESULTADOS.APTO);
    expect(evaluacion.aptoParaContratar).toBe(false);
    expect(evaluacion.requiereDeclaracionVigencia).toBe(true);
    expect(evaluacion.declaracionVigenciaEstado).toBe(DD_DOCUMENTO_ESTADOS.CARGADO);
    expect(evaluacion.mensaje).toContain("pendiente de validación");
  });

  it("bloquea una DD importada mientras la declaracion esta observada", async () => {
    const aprobada = {
      ...EXPEDIENTE_BASE,
      eventoId: "evento-2",
      estado: DD_ESTADOS.APROBADA,
      origen: DD_ORIGENES.IMPORTADO,
      fechaAprobacion: new Date("2026-06-03"),
      fechaVencimiento: new Date("2099-01-01"),
      documentos: [
        {
          tipo: DD_DOCUMENTOS.DECLARACION_VIGENCIA,
          estado: DD_DOCUMENTO_ESTADOS.OBSERVADO,
        },
      ],
    } as DdExpedienteEntity;
    const { servicio } = crearServicio(aprobada);
    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(false);
    expect(evaluacion.requiereDeclaracionVigencia).toBe(true);
    expect(evaluacion.declaracionVigenciaEstado).toBe(DD_DOCUMENTO_ESTADOS.OBSERVADO);
    expect(evaluacion.mensaje).toContain("observada");
  });

  it("usa la DD aprobada vigente aunque exista un borrador posterior", async () => {
    const borrador = {
      ...EXPEDIENTE_BASE,
      estado: DD_ESTADOS.BORRADOR,
    } as DdExpedienteEntity;
    const aprobada = {
      ...EXPEDIENTE_BASE,
      estado: DD_ESTADOS.APROBADA,
      fechaVencimiento: new Date("2099-01-01"),
    } as DdExpedienteEntity;
    const { servicio, repo } = crearServicio(borrador);
    (repo.findExpedienteAprobadoVigentePorEmpresaEvento as ReturnType<typeof vi.fn>).mockResolvedValue(aprobada);

    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(true);
    expect(evaluacion.expediente?.id).toBe(aprobada.id);
  });

  it("usa el APTO externo/manual como bypass aunque no haya expediente interno", async () => {
    const externo = {
      id: "ext-1",
      documento: EMPRESA.ruc,
      razonSocial: EMPRESA.razonSocial,
      tipoDocumento: "RUC",
      motivoEvaluacion: null,
      eventoProyecto: null,
      resultado: DD_RESULTADOS.APTO,
      estadoOrigen: "APTO",
      fechaIngreso: null,
      fechaRevision: new Date("2026-10-18"),
      fechaVencimiento: new Date("2099-01-01"),
      origen: "manual_apto",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies DdEmpresaEstadoEntity;
    const { servicio } = crearServicio(null, EMPRESA.id, externo);
    const evaluacion = await servicio.evaluacionDeUsuario("cliente@iimp.org.pe", "evento-1");

    expect(evaluacion.aptoParaContratar).toBe(true);
    expect(evaluacion.resultado).toBe(DD_RESULTADOS.APTO);
    expect(evaluacion.expediente).toBeNull();
  });
});
