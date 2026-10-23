import { describe, expect, it, vi } from "vitest";
import { DdMatrizEvaluacionApplicationService } from "../dd-matriz-evaluacion-service";
import type { DdMatrizAdjuntoEntity, DdMatrizVinculoEntity } from "@/domain/models/dd-matriz-evaluacion";
import type { IDdMatrizEvaluacionRepository } from "@/domain/ports/dd-matriz-evaluacion-repository";
import {
  DD_MATRIZ_ADJUNTO_CATEGORIAS,
  DD_MATRIZ_AMBITOS,
  DD_MATRIZ_CONCLUSIONES,
  DD_MATRIZ_ORIGENES,
  DD_MATRIZ_RESULTADOS,
  DD_MATRIZ_RESULTADOS_FINALES,
  DD_MATRIZ_TIPOS_VINCULO,
  PERMISSIONS,
  ROLES,
} from "@/lib/shared/constants";

const BLOQUE_VACIO = { fecha: null, responsable: null, resultado: null, observaciones: null, conclusion: null };

function vinculo(parcial: Partial<DdMatrizVinculoEntity> = {}): DdMatrizVinculoEntity {
  return {
    id: "v-1",
    tipo: DD_MATRIZ_TIPOS_VINCULO.REPRESENTANTE,
    refKey: "representante",
    origen: DD_MATRIZ_ORIGENES.AUTOMATICO,
    nombre: "JUAN PEREZ",
    tipoDocumento: "DNI",
    documento: "12345678",
    nacionalidad: "Peruana",
    cargo: "Representante legal",
    ambito: DD_MATRIZ_AMBITOS.NACIONAL,
    ambitoEditado: false,
    fechaInicioActividades: null,
    estadoContribuyente: null,
    direccionLegal: null,
    historialIimp: null,
    beneficioMutuo: null,
    listas: {},
    sig: { ...BLOQUE_VACIO },
    reputacional: { ...BLOQUE_VACIO },
    compliance: { ...BLOQUE_VACIO },
    resultadoFinal: null,
    finalFecha: null,
    finalPor: null,
    creadoPor: "sistema",
    actualizadoPor: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    expediente: {
      expedienteId: "exp-1",
      codigo: "DD-2026-0001",
      estado: "aprobada",
      empresaRazonSocial: "YURA S.A.",
      empresaRuc: "20100000001",
      empresaDireccionFiscal: null,
      paisConstitucion: "Perú",
      actividadEconomica: null,
      tipoRelacionComercial: "exhibidor",
      motivo: "Exhibidor",
      eventoProyecto: "PERUMIN",
      fechaIngreso: new Date("2026-10-01T00:00:00Z"),
      revisadoPor: null,
      fechaRevision: null,
    },
    ...parcial,
  };
}

function informe(): DdMatrizAdjuntoEntity {
  return {
    id: "a-1",
    vinculoId: "v-1",
    categoria: DD_MATRIZ_ADJUNTO_CATEGORIAS.SIG_INFORME,
    nombre: "informe.pdf",
    url: "/uploads/x.pdf",
    mimeType: "application/pdf",
    tamano: 10,
    creadoPor: "sig@iimp.org.pe",
    createdAt: new Date(),
  };
}

function crear(v: DdMatrizVinculoEntity, adjuntos: DdMatrizAdjuntoEntity[] = []) {
  const repo = {
    sincronizarEvento: vi.fn().mockResolvedValue(0),
    listar: vi.fn(),
    findVinculo: vi.fn().mockResolvedValue(v),
    findVinculoEmpresa: vi.fn().mockResolvedValue(null),
    existeExpedienteEnEvento: vi.fn().mockResolvedValue(true),
    actualizarVinculo: vi.fn().mockImplementation(async (_id: string, cambios: Record<string, unknown>) => ({ ...v, ...cambios, sig: { ...v.sig, ...(cambios.sig as object) } })),
    crearVinculoManual: vi.fn(),
    eliminarVinculoManual: vi.fn(),
    listarAdjuntos: vi.fn().mockResolvedValue(adjuntos),
    findAdjunto: vi.fn(),
    crearAdjunto: vi.fn(),
    eliminarAdjunto: vi.fn(),
    registrarAuditoria: vi.fn().mockResolvedValue(undefined),
  } satisfies IDdMatrizEvaluacionRepository;
  return { repo, servicio: new DdMatrizEvaluacionApplicationService(repo) };
}

const sesion = (permissions: string[], roles: string[] = []) => ({
  email: "usuario@iimp.org.pe",
  roles,
  permissions: [PERMISSIONS.DD_MATRIZ, ...permissions],
  eventoId: "evento-1",
});

describe("DdMatrizEvaluacionApplicationService", () => {
  it("rechaza a quien no tiene dd:matriz", async () => {
    const { servicio } = crear(vinculo());
    await expect(
      servicio.detalle({ email: "x", roles: [], permissions: [PERMISSIONS.DD_REVISION], eventoId: "e" }, "v-1"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("listar exige evento y sincroniza antes de consultar", async () => {
    const { servicio, repo } = crear(vinculo());
    repo.listar.mockResolvedValue({ data: [], total: 0 });
    await servicio.listar(sesion([]), { page: 1, perPage: 10 });
    expect(repo.sincronizarEvento).toHaveBeenCalledWith("evento-1", "usuario@iimp.org.pe");
    await expect(servicio.listar({ ...sesion([]), eventoId: undefined }, {})).rejects.toMatchObject({ status: 400 });
  });

  it("SIG: ACEPTADO fija SIN OBSERVACIONES por defecto (acepta formato de negocio)", async () => {
    const { servicio, repo } = crear(vinculo());
    await servicio.guardar(sesion([PERMISSIONS.DD_REVISION]), { id: "v-1", sig: { resultado: "ACEPTADO" } });
    const cambios = repo.actualizarVinculo.mock.calls[0]?.[1];
    expect(cambios?.sig?.resultado).toBe(DD_MATRIZ_RESULTADOS.ACEPTADO);
    expect(cambios?.sig?.conclusion).toBe(DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES);
    expect(cambios?.sig?.responsable).toBe("usuario@iimp.org.pe");
  });

  it("SIG: OBSERVADO sin observacion se rechaza", async () => {
    const { servicio } = crear(vinculo());
    await expect(
      servicio.guardar(sesion([PERMISSIONS.DD_REVISION]), {
        id: "v-1",
        sig: { resultado: "observado", conclusion: "REQUIERE DEBIDA DILIGENCIA REFORZADA" },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("sin dd:revision no se edita la seccion SIG", async () => {
    const { servicio } = crear(vinculo());
    await expect(
      servicio.guardar(sesion([PERMISSIONS.DD_LEGAL]), { id: "v-1", sig: { resultado: "ACEPTADO" } }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("Compliance queda bloqueado sin informe de SIG", async () => {
    const bloqueado = vinculo({
      sig: { ...BLOQUE_VACIO, resultado: DD_MATRIZ_RESULTADOS.OBSERVADO, conclusion: DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA },
    });
    const { servicio } = crear(bloqueado, []);
    await expect(
      servicio.guardar(sesion([PERMISSIONS.DD_LEGAL]), { id: "v-1", compliance: { resultado: "ACEPTADO" } }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("Compliance se habilita con REQUIERE DD REFORZADA + informe adjunto", async () => {
    const habilitado = vinculo({
      sig: { ...BLOQUE_VACIO, resultado: DD_MATRIZ_RESULTADOS.OBSERVADO, conclusion: DD_MATRIZ_CONCLUSIONES.REQUIERE_DD_REFORZADA },
    });
    const { servicio, repo } = crear(habilitado, [informe()]);
    await servicio.guardar(sesion([PERMISSIONS.DD_LEGAL]), {
      id: "v-1",
      compliance: { resultado: "ACEPTADO", conclusion: "ACEPTADO CON OBSERVACIONES" },
    });
    expect(repo.actualizarVinculo.mock.calls[0]?.[1].compliance?.conclusion).toBe("aceptado_con_observaciones");
  });

  it("SIG solo puede ajustar la conclusion reputacional, no el resultado", async () => {
    const { servicio, repo } = crear(
      vinculo({ reputacional: { ...BLOQUE_VACIO, resultado: DD_MATRIZ_RESULTADOS.ACEPTADO, conclusion: DD_MATRIZ_CONCLUSIONES.EN_REVISION } }),
    );
    await servicio.guardar(sesion([PERMISSIONS.DD_REVISION]), {
      id: "v-1",
      reputacional: { conclusion: "SIN OBSERVACIONES" },
    });
    expect(repo.actualizarVinculo.mock.calls[0]?.[1].reputacional).toEqual({
      conclusion: DD_MATRIZ_CONCLUSIONES.SIN_OBSERVACIONES,
    });

    await expect(
      servicio.guardar(sesion([PERMISSIONS.DD_REVISION]), { id: "v-1", reputacional: { resultado: "OBSERVADO" } }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("resultado final: lo registra SIG o Compliance y acepta variantes", async () => {
    const { servicio, repo } = crear(vinculo());
    await servicio.guardar(sesion([PERMISSIONS.DD_REVISION]), { id: "v-1", resultadoFinal: "APTO CON OBSERVACIONES" });
    const cambios = repo.actualizarVinculo.mock.calls[0]?.[1];
    expect(cambios?.resultadoFinal).toBe(DD_MATRIZ_RESULTADOS_FINALES.APTO_CON_OBSERVACIONES);
    expect(cambios?.finalPor).toBe("usuario@iimp.org.pe");

    await expect(
      servicio.guardar(sesion([PERMISSIONS.DD_REPUTACION]), { id: "v-1", resultadoFinal: "APTO" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("filas automaticas: solo se corrige el ambito, no la identidad", async () => {
    const { servicio, repo } = crear(vinculo());
    await expect(
      servicio.guardar(sesion([PERMISSIONS.DD_REVISION]), { id: "v-1", identidad: { nombre: "OTRO" } }),
    ).rejects.toMatchObject({ status: 400 });

    await servicio.guardar(sesion([PERMISSIONS.DD_REVISION]), {
      id: "v-1",
      identidad: { ambito: DD_MATRIZ_AMBITOS.EXTRANJERO },
    });
    const cambios = repo.actualizarVinculo.mock.calls[0]?.[1];
    expect(cambios?.ambito).toBe(DD_MATRIZ_AMBITOS.EXTRANJERO);
    expect(cambios?.ambitoEditado).toBe(true);
  });

  it("listas: normaliza N.A y rechaza listas que no aplican al ambito", async () => {
    const { servicio, repo } = crear(vinculo());
    await servicio.guardar(sesion([PERMISSIONS.DD_REVISION]), {
      id: "v-1",
      listas: { conflicto_interes: "N.A.", peps_prp_persona: "no" },
    });
    expect(repo.actualizarVinculo.mock.calls[0]?.[1].listas).toEqual({ conflicto_interes: "na", peps_prp_persona: "no" });

    await expect(
      servicio.guardar(sesion([PERMISSIONS.DD_REVISION]), { id: "v-1", listas: { ofac: "no" } }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("no permite crear manualmente la fila de empresa", async () => {
    const { servicio } = crear(vinculo());
    await expect(
      servicio.agregarVinculo(sesion([PERMISSIONS.DD_REVISION]), {
        expedienteId: "exp-1",
        tipo: DD_MATRIZ_TIPOS_VINCULO.EMPRESA,
        nombre: "X",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("vinculoEmpresaDeExpediente sincroniza y devuelve el id de la fila de la empresa", async () => {
    const { servicio, repo } = crear(vinculo());
    repo.findVinculoEmpresa.mockResolvedValue(vinculo({ id: "v-empresa", tipo: DD_MATRIZ_TIPOS_VINCULO.EMPRESA }));
    const id = await servicio.vinculoEmpresaDeExpediente(sesion([]), "exp-1");
    expect(id).toBe("v-empresa");
    expect(repo.sincronizarEvento).toHaveBeenCalledWith("evento-1", "usuario@iimp.org.pe");
  });

  it("vinculoEmpresaDeExpediente: 404 si el expediente no esta en la matriz y 403 sin dd:matriz", async () => {
    const { servicio, repo } = crear(vinculo());
    repo.findVinculoEmpresa.mockResolvedValue(null);
    await expect(servicio.vinculoEmpresaDeExpediente(sesion([]), "exp-x")).rejects.toMatchObject({ status: 404 });
    await expect(
      servicio.vinculoEmpresaDeExpediente({ email: "x", roles: [], permissions: [], eventoId: "e" }, "exp-1"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("administrador accede a todo sin permisos explicitos", async () => {
    const { servicio } = crear(vinculo());
    const detalle = await servicio.detalle(
      { email: "a", roles: [ROLES.ADMIN], permissions: [], eventoId: "e" },
      "v-1",
    );
    expect(detalle.permisos.editarSig).toBe(true);
    expect(detalle.permisos.editarCompliance).toBe(false);
  });
});
