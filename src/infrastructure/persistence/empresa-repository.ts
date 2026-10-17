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
  tipoDocumento: string;
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
  representanteCorreo: string | null;
  representanteCelular: string | null;
  representanteDireccion: string | null;
  representanteSieCode: string | null;
  partidaElectronica: string | null;
  tipoComprobante: string;
  sitioWeb: string | null;
  estado: string;
  cuentaCreada: boolean;
  /** Cuentas de acceso vinculadas (solo se incluye en el listado paginado). */
  usuarios?: { email: string; ruc: string | null }[] | null;
  primerAccesoCompletado: boolean;
  datosValidadosEn: Date | null;
  creadoPor: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Cuenta de acceso principal de la ficha: la del RUC o, si no, la primera vinculada. */
function principalCuenta(row: EmpresaRow): { email: string; ruc: string | null } | null {
  const cuentas = row.usuarios ?? [];
  return cuentas.find((u) => u.ruc === row.ruc) ?? cuentas[0] ?? null;
}

function mapRow(row: EmpresaRow): EmpresaEntity {
  return {
    id: row.id,
    ruc: row.ruc,
    tipoDocumento: row.tipoDocumento,
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
    representanteCorreo: row.representanteCorreo ?? null,
    representanteCelular: row.representanteCelular ?? null,
    representanteDireccion: row.representanteDireccion ?? null,
    representanteSieCode: row.representanteSieCode ?? null,
    partidaElectronica: row.partidaElectronica ?? null,
    tipoComprobante: row.tipoComprobante as TipoComprobante,
    sitioWeb: row.sitioWeb ?? null,
    estado: row.estado as EstadoEmpresa,
    cuentaCreada: row.cuentaCreada ?? false,
    cuentaEmail: principalCuenta(row)?.email ?? null,
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
        include: { usuarios: { select: { email: true, ruc: true } } },
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

  async findBySieCode(sieCode: string): Promise<EmpresaEntity | null> {
    const row = await prisma.empresa.findFirst({ where: { sieCode } });
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
