import { describe, expect, it, vi } from "vitest";
import { DebidaDiligenciaApplicationService } from "../debida-diligencia-service";
import type { DdExpedienteEntity } from "@/domain/models/debida-diligencia";
import type { IDebidaDiligenciaRepository } from "@/domain/ports/debida-diligencia-repository";
import type { IAuthRepository } from "@/domain/ports/auth-repository";
import type { IDebidaDiligenciaNotificacionPort } from "@/domain/ports/debida-diligencia-notificacion";
import type { IDebidaDiligenciaDocumentoValidator } from "@/domain/ports/debida-diligencia-documento-validator";
import {
  DD_ACCIONES_LEGAL,
  DD_ACCIONES_REVISION,
  DD_ESTADOS,
  DD_DOCUMENTOS,
  DD_HISTORIAL_TIPOS,
  PERMISSIONS,
} from "@/lib/shared/constants";

const EXPEDIENTE = {
  id: "exp-1",
  codigo: "DD-2026-0001",
  estado: DD_ESTADOS.EN_LEGAL,
  emailRepresentante: "contacto@yura.pe",
  motivoRechazo: "Documentación inconsistente",
  empresa: {
    razonSocial: "YURA S.A.",
    representanteCorreo: null,
    emailContacto: null,
  },
  fechaVencimiento: null,
} as unknown as DdExpedienteEntity;

function crearServicio() {
  const repo = {
    findExpedientePorId: vi.fn().mockResolvedValue(EXPEDIENTE),
    resolverDocumentos: vi.fn(),
    resolverObservaciones: vi.fn(),
    crearObservaciones: vi.fn(),
    listarObservaciones: vi.fn().mockResolvedValue([]),
    actualizarEstado: vi.fn(),
    registrarAuditoria: vi.fn(),
    registrarHistorial: vi.fn().mockResolvedValue(undefined),
    listarHistorial: vi.fn().mockResolvedValue([]),
  } as unknown as IDebidaDiligenciaRepository;
  const notificaciones = {
    expedienteAprobado: vi.fn(),
    expedienteRechazado: vi.fn(),
    expedienteObservado: vi.fn(),
  } as unknown as IDebidaDiligenciaNotificacionPort;
  const documentoValidator = {
    validarInformeLegal: vi.fn(),
  } as unknown as IDebidaDiligenciaDocumentoValidator;
  const servicio = new DebidaDiligenciaApplicationService(
    repo,
    {} as IAuthRepository,
    notificaciones,
    documentoValidator,
  );
  return { servicio, repo, notificaciones, documentoValidator };
}

const session = {
  email: "legal@iimp.org.pe",
  roles: [],
  permissions: [PERMISSIONS.DD_LEGAL],
};

const resolucionBase = {
  expedienteId: "exp-1",
  motivo: "Informe legal",
  informeLegalNombre: "informe.pdf",
  informeLegalUrl: "/uploads/informe.pdf",
};

describe("revisar - aprobación de Logística", () => {
  it("envía el correo de aprobación al cliente", async () => {
    const { servicio, repo, notificaciones } = crearServicio();
    (repo.findExpedientePorId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...EXPEDIENTE,
      estado: DD_ESTADOS.EN_REVISION,
    });
    (repo.actualizarEstado as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...EXPEDIENTE,
      estado: DD_ESTADOS.APROBADA,
      fechaVencimiento: new Date("2027-04-18"),
    });

    await servicio.revisar(
      {
        expedienteId: "exp-1",
        accion: DD_ACCIONES_REVISION.APROBAR,
        motivo: null,
        documentosObservados: [],
        observaciones: [],
        derivarComunicaciones: false,
      },
      {
        email: "logistica@iimp.org.pe",
        roles: [],
        permissions: [PERMISSIONS.DD_REVISION],
      },
    );

    expect(notificaciones.expedienteAprobado).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: "DD-2026-0001" }),
    );
    expect(repo.registrarHistorial).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ tipo: DD_HISTORIAL_TIPOS.APROBACION }),
    );
  });
});

describe("resolverLegal", () => {
  it("rechaza y notifica recién con la decisión de Legal", async () => {
    const { servicio, repo, notificaciones } = crearServicio();
    (repo.actualizarEstado as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...EXPEDIENTE,
      estado: DD_ESTADOS.RECHAZADA,
      motivoLegal: "Informe legal",
      motivoRechazo: "Documentación inconsistente",
    });

    await servicio.resolverLegal(
      { ...resolucionBase, decision: DD_ACCIONES_LEGAL.RECHAZAR },
      session,
    );

    expect(repo.actualizarEstado).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({
        estado: DD_ESTADOS.RECHAZADA,
        decisionLegal: DD_ACCIONES_LEGAL.RECHAZAR,
        informeLegalUrl: "/uploads/informe.pdf",
      }),
    );
    expect(notificaciones.expedienteRechazado).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: "Informe legal" }),
    );
    expect(repo.registrarHistorial).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ tipo: DD_HISTORIAL_TIPOS.LEGAL_RECHAZO }),
    );
  });

  it("aprueba la revisión y devuelve el expediente a Logística", async () => {
    const { servicio, repo, notificaciones } = crearServicio();
    (repo.actualizarEstado as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...EXPEDIENTE,
      estado: DD_ESTADOS.EN_REVISION,
    });

    await servicio.resolverLegal(
      { ...resolucionBase, decision: DD_ACCIONES_LEGAL.APROBAR },
      session,
    );

    expect(repo.resolverDocumentos).not.toHaveBeenCalled();
    expect(repo.actualizarEstado).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({
        estado: DD_ESTADOS.EN_REVISION,
        decisionLegal: DD_ACCIONES_LEGAL.APROBAR,
      }),
    );
    expect(notificaciones.expedienteAprobado).not.toHaveBeenCalled();
    expect(repo.registrarHistorial).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({ tipo: DD_HISTORIAL_TIPOS.LEGAL_APROBACION }),
    );
  });

  it("rechaza expedientes que no están en revisión legal", async () => {
    const { servicio, repo } = crearServicio();
    (repo.findExpedientePorId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...EXPEDIENTE,
      estado: DD_ESTADOS.APROBADA,
    });

    await expect(
      servicio.resolverLegal(
        { ...resolucionBase, decision: DD_ACCIONES_LEGAL.RECHAZAR },
        session,
      ),
    ).rejects.toThrow("no está pendiente de revisión legal");
  });

  it("exige informe legal al rechazar", async () => {
    const { servicio } = crearServicio();
    await expect(
      servicio.resolverLegal(
        {
          ...resolucionBase,
          decision: DD_ACCIONES_LEGAL.RECHAZAR,
          informeLegalUrl: null,
          informeLegalNombre: null,
        },
        session,
      ),
    ).rejects.toThrow("informe legal es obligatorio");
  });

  it("permite aprobar sin informe legal", async () => {
    const { servicio, repo, notificaciones, documentoValidator } = crearServicio();
    (repo.actualizarEstado as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...EXPEDIENTE,
      estado: DD_ESTADOS.APROBADA,
      fechaVencimiento: new Date("2027-04-17"),
    });

    await servicio.resolverLegal(
      {
        ...resolucionBase,
        decision: DD_ACCIONES_LEGAL.APROBAR,
        informeLegalNombre: null,
        informeLegalUrl: null,
      },
      session,
    );

    expect(documentoValidator.validarInformeLegal).not.toHaveBeenCalled();
    expect(notificaciones.expedienteAprobado).not.toHaveBeenCalled();
  });
});
  it("observa con una observacion de Legal y habilita la subsanacion del cliente", async () => {
    const { servicio, repo, notificaciones } = crearServicio();
    (repo.actualizarEstado as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...EXPEDIENTE,
      estado: DD_ESTADOS.OBSERVADA,
      decisionLegal: DD_ACCIONES_LEGAL.OBSERVAR,
    });
    (repo.listarObservaciones as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "obs-1",
        area: "legal",
        documentoTipo: null,
        texto: "Falta actualizar la vigencia de poderes.",
        estado: "abierta",
      },
    ]);

    await servicio.resolverLegal(
      {
        expedienteId: "exp-1",
        decision: DD_ACCIONES_LEGAL.OBSERVAR,
        motivo: "Falta actualizar la vigencia de poderes.",
        informeLegalNombre: null,
        informeLegalUrl: null,
      },
      session,
    );

    expect(repo.crearObservaciones).toHaveBeenCalledWith(
      "exp-1",
      [expect.objectContaining({ area: "legal", texto: "Falta actualizar la vigencia de poderes." })],
      "legal@iimp.org.pe",
    );
    expect(repo.actualizarEstado).toHaveBeenCalledWith(
      "exp-1",
      expect.objectContaining({
        estado: DD_ESTADOS.OBSERVADA,
        decisionLegal: DD_ACCIONES_LEGAL.OBSERVAR,
      }),
    );
    expect(notificaciones.expedienteObservado).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: "DD-2026-0001" }),
    );
  });

  it("registra la solicitud de un documento adicional de Legal", async () => {
    const { servicio, repo } = crearServicio();
    (repo.actualizarEstado as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...EXPEDIENTE,
      estado: DD_ESTADOS.OBSERVADA,
      decisionLegal: DD_ACCIONES_LEGAL.OBSERVAR,
    });
    (repo.listarObservaciones as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await servicio.resolverLegal(
      {
        expedienteId: "exp-1",
        decision: DD_ACCIONES_LEGAL.OBSERVAR,
        motivo: "Adjuntar carta de autorización vigente.",
        documentosObservados: [DD_DOCUMENTOS.ADICIONAL],
        informeLegalNombre: null,
        informeLegalUrl: null,
      },
      session,
    );

    expect(repo.crearObservaciones).toHaveBeenCalledWith(
      "exp-1",
      [
        expect.objectContaining({
          area: "legal",
          documentoTipo: DD_DOCUMENTOS.ADICIONAL,
          texto: "Adjuntar carta de autorización vigente.",
        }),
      ],
      "legal@iimp.org.pe",
    );
    expect(repo.resolverDocumentos).toHaveBeenCalledWith(
      "exp-1",
      [DD_DOCUMENTOS.ADICIONAL],
      "Adjuntar carta de autorización vigente.",
    );
  });