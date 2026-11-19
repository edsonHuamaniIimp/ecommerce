import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type {
  DdIntegracionBusquedaParams,
  DdIntegracionBusquedaResult,
  DdIntegracionDocumentoEntity,
  DdIntegracionEmpresaEntity,
  DdIntegracionExpedienteEntity,
} from "@/domain/models/dd-integracion";
import type { IDdIntegracionRepository } from "@/domain/ports/dd-integracion-repository";
import { TIPOS_DOCUMENTO_EMPRESA } from "@/lib/shared/constants";
import { normalizarDocumentoEmpresa } from "@/lib/shared/utils/documento-empresa";

const empresaInclude = {
  debidasDiligencias: {
    orderBy: { createdAt: "desc" },
    include: {
      evento: {
        select: {
          id: true,
          anio: true,
          eventoPadre: { select: { nombre: true } },
        },
      },
      documentos: {
        orderBy: { tipo: "asc" },
        include: {
          versiones: { orderBy: { version: "asc" } },
        },
      },
    },
  },
} satisfies Prisma.EmpresaInclude;

type EmpresaRow = Prisma.EmpresaGetPayload<{ include: typeof empresaInclude }>;

function mapDocumento(
  documento: EmpresaRow["debidasDiligencias"][number]["documentos"][number],
): DdIntegracionDocumentoEntity {
  const versiones = documento.versiones.map((version) => ({
    id: version.id,
    version: version.version,
    nombre: version.nombre,
    url: version.url,
    creadoPor: version.creadoPor ?? null,
    createdAt: version.createdAt,
  }));
  const versionActual = versiones.at(-1)?.version ?? 1;
  return {
    id: documento.id,
    tipo: documento.tipo,
    nombre: documento.nombre,
    url: documento.url,
    estado: documento.estado,
    observacion: documento.observacion ?? null,
    updatedAt: documento.updatedAt,
    versionActual,
    versiones: versiones.length > 0
      ? versiones
      : [
          {
            id: documento.id,
            version: 1,
            nombre: documento.nombre,
            url: documento.url,
            creadoPor: null,
            createdAt: documento.updatedAt,
          },
        ],
  };
}

function mapExpediente(
  expediente: EmpresaRow["debidasDiligencias"][number],
): DdIntegracionExpedienteEntity {
  return {
    id: expediente.id,
    codigo: expediente.codigo,
    estado: expediente.estado,
    origen: expediente.origen,
    evento: {
      id: expediente.evento.id,
      nombre: `${expediente.evento.eventoPadre.nombre} ${expediente.evento.anio}`.trim(),
      anio: expediente.evento.anio,
    },
    fechaEnvio: expediente.fechaEnvio,
    fechaRevision: expediente.fechaRevision,
    fechaAprobacion: expediente.fechaAprobacion,
    fechaVencimiento: expediente.fechaVencimiento,
    documentos: expediente.documentos.map(mapDocumento),
  };
}

function mapEmpresa(empresa: EmpresaRow): DdIntegracionEmpresaEntity {
  return {
    id: empresa.id,
    ruc: empresa.ruc,
    tipoDocumento:
      empresa.tipoDocumento === TIPOS_DOCUMENTO_EMPRESA.RUC ? "RUC" : "RUT",
    razonSocial: empresa.razonSocial,
    nombreComercial: empresa.nombreComercial ?? null,
    pais: empresa.pais,
    estado: empresa.estado,
    expedientes: empresa.debidasDiligencias.map(mapExpediente),
  };
}

/** Repositorio M2M de consulta documental DD. */
export class DdIntegracionPrismaRepository implements IDdIntegracionRepository {
  async buscarDocumentos(
    params: DdIntegracionBusquedaParams,
  ): Promise<DdIntegracionBusquedaResult> {
    const where: Prisma.EmpresaWhereInput = {
      ...(params.documento
        ? { ruc: normalizarDocumentoEmpresa(params.documento) }
        : {}),
      ...(params.tipoDocumento === "RUC"
        ? { tipoDocumento: TIPOS_DOCUMENTO_EMPRESA.RUC }
        : params.tipoDocumento === "RUT"
          ? { tipoDocumento: TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO }
          : {}),
      ...(params.razonSocial
        ? { razonSocial: { contains: params.razonSocial, mode: "insensitive" } }
        : {}),
    };
    const skip = (params.page - 1) * params.perPage;
    const [rows, total] = await prisma.$transaction([
      prisma.empresa.findMany({
        where,
        include: empresaInclude,
        orderBy: { razonSocial: "asc" },
        skip,
        take: params.perPage,
      }),
      prisma.empresa.count({ where }),
    ]);

    return {
      data: rows.map(mapEmpresa),
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(total / params.perPage),
    };
  }
}
