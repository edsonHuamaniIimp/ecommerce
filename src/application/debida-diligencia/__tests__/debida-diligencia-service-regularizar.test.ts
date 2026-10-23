import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type { DdExpedienteEntity } from "@/domain/models/debida-diligencia";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import { DD_DOCUMENTOS, DD_ESTADOS, PERMISSIONS } from "@/lib/shared/constants";

const EXPEDIENTE = {
  id: "exp-otro",
  empresaId: "emp-1",
  eventoId: "evento-2",
  estado: DD_ESTADOS.APROBADA,
  tipoRelacionComercial: ["exhibidor"],
  actividadEconomica: "Servicios",
  actividadEconomicaOtro: null,
  paisConstitucion: "Perú",
  sitioWeb: "https://empresa.pe",
  emailRepresentante: "contacto@empresa.pe",
  aceptaDatos: true,
  aceptaVerificacion: true,
  declaraVerdad: true,
  representanteNombre: "Representante",
  representanteTipoDocumento: "DNI",
  representanteDocumento: "12345678",
  representanteNacionalidad: "Perú",
  fechaAprobacion: new Date("2026-06-16"),
  fechaVencimiento: new Date("2026-12-16"),
  documentos: [],
  beneficiarios: [],
} as unknown as DdExpedienteEntity;

const session = {
  email: "cliente@empresa.pe",
  roles: [],
  permissions: [PERMISSIONS.DD_FORMULARIO],
  eventoId: "evento-1",
};

function crearServicio() {
  const guardado = {
    ...EXPEDIENTE,
    documentos: [
      {
        id: "doc-1",
        tipo: DD_DOCUMENTOS.DECLARACION_VIGENCIA,
        nombre: "declaracion.docx",
        url: "/uploads/declaracion.docx",
        estado: "cargado",
      },
    ],
  } as unknown as DdExpedienteEntity;
  const repo = {
    findExpedientePorId: vi.fn().mockResolvedValue(EXPEDIENTE),
    guardarFormulario: vi.fn().mockResolvedValue(guardado),
    registrarAuditoria: vi.fn().mockResolvedValue(undefined),
  } as unknown as IDebidaDiligenciaRepository;
  const authRepo = {
    findEmpresaIdDeUsuario: vi.fn().mockResolvedValue("emp-1"),
  } as unknown as IAuthRepository;
  const servicio = new DebidaDiligenciaApplicationService(
    repo,
    authRepo,
    {} as IDebidaDiligenciaNotificacionPort,
    { validarDocumento: vi.fn().mockResolvedValue(undefined) } as unknown as IDebidaDiligenciaDocumentoValidator,
  );
  return { servicio, repo };
}

describe("regularizarDeclaracionVigencia", () => {
  it("adjunta la declaración a una DD aprobada de otro evento", async () => {
    const { servicio, repo } = crearServicio();

    const resultado = await servicio.regularizarDeclaracionVigencia(
      {
        expedienteId: EXPEDIENTE.id,
        nombre: "declaracion.docx",
        url: "/uploads/declaracion.docx",
      },
      session,
    );

    expect(resultado.documentos.some((d) => d.tipo === DD_DOCUMENTOS.DECLARACION_VIGENCIA)).toBe(
      true,
    );
    expect(repo.guardarFormulario).toHaveBeenCalledWith(
      EXPEDIENTE.id,
      expect.objectContaining({
        documentos: expect.arrayContaining([
          expect.objectContaining({ tipo: DD_DOCUMENTOS.DECLARACION_VIGENCIA }),
        ]),
      }),
      session.email,
    );
  });

  it("rechaza regularizar una DD del evento activo", async () => {
    const { servicio } = crearServicio();

    await expect(
      servicio.regularizarDeclaracionVigencia(
        {
          expedienteId: EXPEDIENTE.id,
          nombre: "declaracion.docx",
          url: "/uploads/declaracion.docx",
        },
        { ...session, eventoId: "evento-2" },
      ),
    ).rejects.toThrow("evento activo");
  });
});
