import 'server-only';

import { prisma } from "@/lib/server/db";
import type { ActualizarEmpresaData, IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type {
  CrearEmpresaData,
  EmpresaEntity,
  EmpresasListParams,
  EmpresasPaginatedResult,
} from "@/domain/models/empresa";
import type { EstadoEmpresa, TipoComprobante } from "@/lib/shared/constants";

interface EmpresaRow {
  id: string;
  ruc: string;
  sieCode: string | null;
  razonSocial: string;
  logoUrl: string | null;
  nombreComercial: string | null;
  direccionFiscal: string | null;
  telefono: string | null;
  emailContacto: string | null;
  emailFacturacion: string | null;
  representanteLegalNombre: string | null;
  representanteLegalDni: string | null;
  partidaElectronica: string | null;
  tipoComprobante: string;
  sitioWeb: string | null;
  estado: string;
  cuentaCreada: boolean;
  primerAccesoCompletado: boolean;
  datosValidadosEn: Date | null;
  creadoPor: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: EmpresaRow): EmpresaEntity {
  return {
    id: row.id,
    ruc: row.ruc,
    sieCode: row.sieCode ?? null,
    razonSocial: row.razonSocial,
    logoUrl: row.logoUrl ?? null,
    nombreComercial: row.nombreComercial ?? null,
    direccionFiscal: row.direccionFiscal ?? null,
    telefono: row.telefono ?? null,
    emailContacto: row.emailContacto ?? null,
    emailFacturacion: row.emailFacturacion ?? null,
    representanteLegalNombre: row.representanteLegalNombre ?? null,
    representanteLegalDni: row.representanteLegalDni ?? null,
    partidaElectronica: row.partidaElectronica ?? null,
    tipoComprobante: row.tipoComprobante as TipoComprobante,
    sitioWeb: row.sitioWeb ?? null,
    estado: row.estado as EstadoEmpresa,
    cuentaCreada: row.cuentaCreada ?? false,
    primerAccesoCompletado: row.primerAccesoCompletado ?? false,
    datosValidadosEn: row.datosValidadosEn ?? null,
    creadoPor: row.creadoPor ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class EmpresaPrismaRepository implements IEmpresaRepository {
  async listarPaginated(params: EmpresasListParams): Promise<EmpresasPaginatedResult> {
    const where: Record<string, unknown> = {};
    if (params.estado) where.estado = params.estado;
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { razonSocial: { contains: q, mode: "insensitive" } },
        { ruc: { contains: q } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.empresa.findMany({
        where: where as never,
        orderBy: { razonSocial: "asc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
      prisma.empresa.count({ where: where as never }),
    ]);
    return {
      data: rows.map((row) => mapRow(row as EmpresaRow)),
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages: Math.ceil(total / params.perPage),
    };
  }

  async findById(id: string): Promise<EmpresaEntity | null> {
    const row = await prisma.empresa.findUnique({ where: { id } });
    return row ? mapRow(row as EmpresaRow) : null;
  }

  async findByRuc(ruc: string): Promise<EmpresaEntity | null> {
    const row = await prisma.empresa.findUnique({ where: { ruc } });
    return row ? mapRow(row as EmpresaRow) : null;
  }

  async create(data: CrearEmpresaData): Promise<EmpresaEntity> {
    const row = await prisma.empresa.create({ data: data as never });
    return mapRow(row as EmpresaRow);
  }

  async update(id: string, data: ActualizarEmpresaData): Promise<EmpresaEntity> {
    const row = await prisma.empresa.update({ where: { id }, data: data as never });
    return mapRow(row as EmpresaRow);
  }
}

export const empresaRepo = new EmpresaPrismaRepository();
