import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type {
  DdEmpresaEstadoEntity,
  DdEmpresaResumen,
  DdExpedienteEntity,
} from "@/domain/models/debida-diligencia";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IDdConfiguracionRepository } from "@/domain/ports/dd-configuracion-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import {
  DD_ESTADOS,
  DD_MENSAJES,
  DD_ORIGENES,
  DD_RESULTADOS,
  PERMISSIONS,
} from "@/lib/shared/constants";

const EMPRESA = {
  id: "emp-1",
  ruc: "20312372895",
  razonSocial: "YURA S.A.",
  nombreComercial: null,
  sitioWeb: "https://yura.pe",
  emailContacto: null,
  representanteLegalNombre: "Ana Pérez",
  representanteLegalDni: "12345678",
  representanteCorreo: null,
  logoUrl: null,
} satisfies DdEmpresaResumen;

const EXPEDIENTE = {
  id: "exp-1",
  empresaId: EMPRESA.id,
  eventoId: "evento-1",
  codigo: "DD-2026-0001",
  estado: DD_ESTADOS.APROBADA,
  origen: DD_ORIGENES.FLUJO_REGULAR,
  declaraVerdad: true,
  vinculosCompletos: true,
  fechaAprobacion: new Date("2026-01-01"),
  fechaVencimiento: new Date("2099-01-01"),
  empresa: EMPRESA,
  representanteNombre: EMPRESA.representanteLegalNombre,
  beneficiarios: [],
  documentos: [],
  observaciones: [],
  sitioWeb: EMPRESA.sitioWeb,
} as unknown as DdExpedienteEntity;

function servicioCon(
  repo: IDebidaDiligenciaRepository,
  configuracion: Pick<IDdConfiguracionRepository, "obtener"> | null = null,
) {
  return new DebidaDiligenciaApplicationService(
    repo,
    { findEmpresaIdDeUsuario: vi.fn().mockResolvedValue(EMPRESA.id) } as unknown as IAuthRepository,
    {} as IDebidaDiligenciaNotificacionPort,
    {} as IDebidaDiligenciaDocumentoValidator,
    configuracion as IDdConfiguracionRepository | undefined,
  );
}

function crearRepo(): IDebidaDiligenciaRepository {
  return {
    findExpedientePorEmpresaEvento: vi.fn().mockResolvedValue(EXPEDIENTE),
    findExpedienteAprobadoVigentePorEmpresa: vi.fn().mockResolvedValue(null),
    findExpedienteAprobadoVigentePorEmpresaEvento: vi.fn().mockResolvedValue(null),
    findEmpresaResumen: vi.fn().mockResolvedValue(EMPRESA),
    findEmpresaEstado: vi.fn().mockResolvedValue(null),
    tieneVinculoNoApto: vi.fn().mockResolvedValue(false),
    tieneVinculoNoAptoPorDocumento: vi.fn().mockResolvedValue(false),
    listarNombresMatriz: vi.fn().mockResolvedValue([]),
    marcarVinculosCompletos: vi.fn().mockResolvedValue(undefined),
    listarNombresReputacion: vi.fn().mockResolvedValue([]),
    findExpedientePorId: vi.fn().mockResolvedValue(EXPEDIENTE),
    listarEmpresasEstados: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      perPage: 10,
      totalPages: 0,
      resumen: {
        total: 0,
        aptos: 0,
        aptosConObservaciones: 0,
        pendientes: 0,
        noAptos: 0,
        vigentes: 0,
        requierenNuevaEvaluacion: 0,
      },
    }),
    crearCasosReputacion: vi.fn().mockResolvedValue(undefined),
    listarVinculosReputacion: vi.fn().mockResolvedValue([]),
    listarVinculosConCasoReputacion: vi.fn().mockResolvedValue([]),
    actualizarDictamenMatriz: vi.fn().mockResolvedValue(undefined),
    registrarAuditoria: vi.fn().mockResolvedValue(undefined),
    registrarHistorial: vi.fn().mockResolvedValue(undefined),
  } as unknown as IDebidaDiligenciaRepository;
}

const SESION = {
  email: "logistica@iimp.org.pe",
  roles: [],
  permissions: [PERMISSIONS.DD_REVISION],
  eventoId: "evento-1",
};

describe("bloqueo por NO APTO de la matriz", () => {
  it("bloquea la empresa cuando un vínculo quedó NO APTO y la configuración está activa", async () => {
    const repo = crearRepo();
    (repo.tieneVinculoNoApto as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const servicio = servicioCon(repo, {
      obtener: vi.fn().mockResolvedValue({ noAptoBloqueaEmpresa: true }),
    });

    const evaluacion = await servicio.evaluacionDeUsuario(
      "cliente@iimp.org.pe",
      "evento-1",
    );

    expect(evaluacion.aptoParaContratar).toBe(false);
    expect(evaluacion.mensaje).toBe(DD_MENSAJES.NO_APTO_BLOQUEA_EMPRESA);
  });

  it("no bloquea si la configuración desactiva el bloqueo", async () => {
    const repo = crearRepo();
    (repo.tieneVinculoNoApto as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const servicio = servicioCon(repo, {
      obtener: vi.fn().mockResolvedValue({ noAptoBloqueaEmpresa: false }),
    });

    const evaluacion = await servicio.evaluacionDeUsuario(
      "cliente@iimp.org.pe",
      "evento-1",
    );

    expect(evaluacion.aptoParaContratar).toBe(true);
    expect(evaluacion.mensaje).toBeNull();
  });

  it("marca la empresa externa como bloqueada al listar empresas", async () => {
    const empresaExterna = {
      id: "ext-1",
      documento: EMPRESA.ruc,
      razonSocial: EMPRESA.razonSocial,
      tipoDocumento: "RUC",
      motivoEvaluacion: null,
      eventoProyecto: null,
      resultado: DD_RESULTADOS.APTO,
      estadoOrigen: "APTO",
      fechaIngreso: null,
      fechaRevision: null,
      fechaAprobacion: new Date("2026-01-01"),
      fechaVencimiento: new Date("2099-01-01"),
      declaracionVigenciaEstado: null,
      origen: "excel_dd",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies DdEmpresaEstadoEntity;
    const repo = crearRepo();
    (repo.listarEmpresasEstados as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [empresaExterna],
      total: 1,
      page: 1,
      perPage: 10,
      totalPages: 1,
      resumen: {
        total: 1,
        aptos: 1,
        aptosConObservaciones: 0,
        pendientes: 0,
        noAptos: 0,
        vigentes: 1,
        requierenNuevaEvaluacion: 0,
      },
    });
    (repo.tieneVinculoNoAptoPorDocumento as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const servicio = servicioCon(repo, {
      obtener: vi.fn().mockResolvedValue({ noAptoBloqueaEmpresa: true }),
    });

    const resultado = await servicio.empresas(
      { page: 1, perPage: 10 },
      { ...SESION, permissions: [PERMISSIONS.DD_VER] },
    );

    expect(resultado.data[0]?.puedeReservar).toBe(false);
    expect(resultado.data[0]?.puedeAvanzar).toBe(false);
    expect(resultado.data[0]?.mensaje).toBe(DD_MENSAJES.NO_APTO_BLOQUEA_EMPRESA);
  });
});

describe("declaración de vínculos completos", () => {
  it("guarda la declaración de SIG cuando están todos los vínculos", async () => {
    const repo = crearRepo();
    (repo.listarNombresMatriz as ReturnType<typeof vi.fn>).mockResolvedValue([
      "YURA S.A.",
      "Ana Pérez",
    ]);
    const servicio = servicioCon(repo);

    await servicio.declararVinculosCompletos(
      { expedienteId: EXPEDIENTE.id, completos: true },
      SESION,
    );

    expect(repo.marcarVinculosCompletos).toHaveBeenCalledWith(
      EXPEDIENTE.id,
      true,
      SESION.email,
    );
  });

  it("no permite declarar completos si falta un vínculo en la matriz", async () => {
    const repo = crearRepo();
    (repo.listarNombresMatriz as ReturnType<typeof vi.fn>).mockResolvedValue(["YURA S.A."]);
    const servicio = servicioCon(repo);

    await expect(
      servicio.declararVinculosCompletos(
        { expedienteId: EXPEDIENTE.id, completos: true },
        SESION,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.marcarVinculosCompletos).not.toHaveBeenCalled();
  });
});

describe("derivación incremental a Comunicaciones", () => {
  it("bloquea la derivación mientras no se haya declarado vínculos completos", async () => {
    const repo = crearRepo();
    (repo.findExpedientePorId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...EXPEDIENTE,
      vinculosCompletos: false,
    });
    const servicio = servicioCon(repo);

    await expect(
      servicio.derivarComunicaciones({ expedienteId: EXPEDIENTE.id }, SESION),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.crearCasosReputacion).not.toHaveBeenCalled();
  });

  it("deriva solo los vínculos seleccionados y conserva vinculoId", async () => {
    const repo = crearRepo();
    (repo.listarNombresMatriz as ReturnType<typeof vi.fn>).mockResolvedValue([
      "YURA S.A.",
      "Ana Pérez",
    ]);
    (repo.listarVinculosReputacion as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "v-empresa", nombre: "YURA S.A.", tipo: "empresa", tipoDocumento: "RUC", documento: "20312372895" },
      { id: "v-rep", nombre: "Ana Pérez", tipo: "representante", tipoDocumento: "DNI", documento: "12345678" },
    ]);
    const servicio = servicioCon(repo);

    await servicio.derivarComunicaciones(
      { expedienteId: EXPEDIENTE.id, vinculoIds: ["v-rep"] },
      SESION,
    );

    expect(repo.crearCasosReputacion).toHaveBeenCalledWith(
      EXPEDIENTE.id,
      [
        {
          vinculoId: "v-rep",
          nombreARevisar: "Ana Pérez",
          sitioWeb: EXPEDIENTE.sitioWeb,
          derivadoPor: SESION.email,
        },
      ],
    );
  });

  it("no duplica un vínculo que ya tiene caso reputacional", async () => {
    const repo = crearRepo();
    (repo.listarNombresMatriz as ReturnType<typeof vi.fn>).mockResolvedValue([
      "YURA S.A.",
      "Ana Pérez",
    ]);
    (repo.listarVinculosReputacion as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "v-empresa", nombre: "YURA S.A.", tipo: "empresa", tipoDocumento: "RUC", documento: "20312372895" },
      { id: "v-rep", nombre: "Ana Pérez", tipo: "representante", tipoDocumento: "DNI", documento: "12345678" },
    ]);
    (repo.listarVinculosConCasoReputacion as ReturnType<typeof vi.fn>).mockResolvedValue(["v-rep"]);
    const servicio = servicioCon(repo);

    const resultado = await servicio.derivarComunicaciones(
      { expedienteId: EXPEDIENTE.id, vinculoIds: ["v-rep"] },
      SESION,
    );

    expect(resultado).toEqual({ derivados: 0, existentes: 1, total: 1 });
    expect(repo.crearCasosReputacion).not.toHaveBeenCalled();
  });

  it("solo crea casos nuevos e incluye vínculos manuales de la matriz", async () => {
    const repo = crearRepo();
    (repo.listarNombresReputacion as ReturnType<typeof vi.fn>).mockResolvedValue(["YURA S.A."]);
    (repo.listarNombresMatriz as ReturnType<typeof vi.fn>).mockResolvedValue([
      "YURA S.A.",
      "Ana Pérez",
      "Proveedor Nuevo S.A.C.",
      "Proveedor Nuevo S.A.C.",
    ]);
    const servicio = servicioCon(repo);

    const resultado = await servicio.derivarComunicaciones({ expedienteId: EXPEDIENTE.id }, SESION);

    expect(resultado).toEqual({ derivados: 2, existentes: 1, total: 3 });
    const casos = (repo.crearCasosReputacion as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { nombreARevisar: string }[]
      | undefined;
    expect(casos?.map((caso) => caso.nombreARevisar)).toEqual(["Ana Pérez", "Proveedor Nuevo S.A.C."]);
  });

  it("no falla si todos los nombres ya fueron derivados", async () => {
    const repo = crearRepo();
    (repo.listarNombresMatriz as ReturnType<typeof vi.fn>).mockResolvedValue([
      "YURA S.A.",
      "Ana Pérez",
    ]);
    (repo.listarNombresReputacion as ReturnType<typeof vi.fn>).mockResolvedValue([
      "YURA S.A.",
      "Ana Pérez",
    ]);
    const servicio = servicioCon(repo);

    const resultado = await servicio.derivarComunicaciones({ expedienteId: EXPEDIENTE.id }, SESION);

    expect(resultado).toEqual({ derivados: 0, existentes: 2, total: 2 });
    expect(repo.crearCasosReputacion).not.toHaveBeenCalled();
  });

  it("bloquea si la matriz no tiene todos los vínculos de la solicitud", async () => {
    const repo = crearRepo();
    (repo.listarNombresMatriz as ReturnType<typeof vi.fn>).mockResolvedValue(["YURA S.A."]);
    const servicio = servicioCon(repo);

    await expect(
      servicio.derivarComunicaciones({ expedienteId: EXPEDIENTE.id }, SESION),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Ana") });
    expect(repo.crearCasosReputacion).not.toHaveBeenCalled();
  });
});



