import 'server-only';

import { prisma } from "@/lib/server/db";
import type { ActualizarEmpresaData, IEmpresaRepository } from "@/domain/ports/empresa-repository";
import type { EmpresaRepresentanteAdicionalInput } from "@/domain/models/empresa";
import type {
  CrearEmpresaData,
  EmpresaEntity,
  EmpresaRepresentanteAdicionalEntity,
  EmpresasListParams,
  EmpresasPaginatedResult,
} from "@/domain/models/empresa";
import { PAIS_DEFAULT, TIPOS_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_PERSONA } from "@/lib/shared/constants";
import type { EstadoEmpresa, TipoComprobante } from "@/lib/shared/constants";
import type { ConfigCuotasEmpresa } from "@/lib/shared/utils/cuotas";

interface EmpresaRow {
  id: string;
  ruc: string;
  tipoDocumento: string;
  pais: string;
  sieCode: string | null;
  razonSocial: string;
  logoUrl: string | null;
  nombreComercial: string | null;
  direccionFiscal: string | null;
  inicioOperaciones: Date | null;
  telefono: string | null;
  emailContacto: string | null;
  emailFacturacion: string | null;
  representanteLegalNombre: string | null;
  representanteLegalTipoDocumento: string;
  representanteLegalDni: string | null;
  representanteCorreo: string | null;
  representanteCelular: string | null;
  representanteDireccion: string | null;
  representanteSieCode: string | null;
  representanteUserId: string | null;
  partidaElectronica: string | null;
  nombreFriso: string | null;
  actividadEconomica: string | null;
  estadoContribuyente: string | null;
  facturarANombre: string | null;
  responsableExteminNombre: string | null;
  responsableExteminTelefono: string | null;
  responsableExteminTipoDocumento: string;
  responsableExteminDni: string | null;
  responsableExteminEmail: string | null;
  responsablePagosNombre: string | null;
  responsablePagosTelefono: string | null;
  responsablePagosTipoDocumento: string;
  responsablePagosDni: string | null;
  responsablePagosEmail: string | null;
  configCuotas: unknown | null;
  tipoComprobante: string;
  sitioWeb: string | null;
  representantesAdicionales?: EmpresaRepresentanteAdicionalEntity[] | null;
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
    pais: row.pais ?? "PE",
    sieCode: row.sieCode ?? null,
    razonSocial: row.razonSocial,
    logoUrl: row.logoUrl ?? null,
    nombreComercial: row.nombreComercial ?? null,
    direccionFiscal: row.direccionFiscal ?? null,
    inicioOperaciones: row.inicioOperaciones ?? null,
    telefono: row.telefono ?? null,
    emailContacto: row.emailContacto ?? null,
    emailFacturacion: row.emailFacturacion ?? null,
    representanteLegalNombre: row.representanteLegalNombre ?? null,
    representanteLegalTipoDocumento: row.representanteLegalTipoDocumento ?? "1",
    representanteLegalDni: row.representanteLegalDni ?? null,
    representanteCorreo: row.representanteCorreo ?? null,
    representanteCelular: row.representanteCelular ?? null,
    representanteDireccion: row.representanteDireccion ?? null,
    representanteSieCode: row.representanteSieCode ?? null,
    representanteUserId: row.representanteUserId ?? null,
    partidaElectronica: row.partidaElectronica ?? null,
    nombreFriso: row.nombreFriso ?? null,
    actividadEconomica: row.actividadEconomica ?? null,
    estadoContribuyente: row.estadoContribuyente ?? null,
    facturarANombre: row.facturarANombre ?? null,
    responsableExteminNombre: row.responsableExteminNombre ?? null,
    responsableExteminTelefono: row.responsableExteminTelefono ?? null,
    responsableExteminTipoDocumento: row.responsableExteminTipoDocumento ?? "1",
    responsableExteminDni: row.responsableExteminDni ?? null,
    responsableExteminEmail: row.responsableExteminEmail ?? null,
    responsablePagosNombre: row.responsablePagosNombre ?? null,
    responsablePagosTelefono: row.responsablePagosTelefono ?? null,
    responsablePagosTipoDocumento: row.responsablePagosTipoDocumento ?? "1",
    responsablePagosDni: row.responsablePagosDni ?? null,
    responsablePagosEmail: row.responsablePagosEmail ?? null,
    configCuotas: (row.configCuotas as ConfigCuotasEmpresa | null) ?? null,
    tipoComprobante: row.tipoComprobante as TipoComprobante,
    sitioWeb: row.sitioWeb ?? null,
    representantesAdicionales: (row.representantesAdicionales ?? []).map((rep) => ({
      id: rep.id,
      nombre: rep.nombre,
      tipoDocumento: rep.tipoDocumento,
      documento: rep.documento,
      correo: rep.correo ?? null,
      celular: rep.celular ?? null,
      direccion: rep.direccion ?? null,
      orden: rep.orden,
    })),
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
    const row = await prisma.empresa.findUnique({
      where: { id },
      include: { representantesAdicionales: { where: { flgActivo: true }, orderBy: { orden: "asc" } } },
    });
    return row ? mapRow(row as EmpresaRow) : null;
  }

  async findPaisesPendientes(limite = 50): Promise<EmpresaEntity[]> {
    const rows = await prisma.empresa.findMany({
      where: {
        tipoDocumento: TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO,
        pais: PAIS_DEFAULT,
        OR: [{ paisOrigen: null }, { paisOrigen: { not: "manual" } }],
      },
      orderBy: { updatedAt: "desc" },
      take: limite,
    });
    return rows.map((row) => mapRow(row as EmpresaRow));
  }

  async findByRuc(ruc: string): Promise<EmpresaEntity | null> {
    const row = await prisma.empresa.findUnique({
      where: { ruc },
      include: { representantesAdicionales: { where: { flgActivo: true }, orderBy: { orden: "asc" } } },
    });
    return row ? mapRow(row as EmpresaRow) : null;
  }

  async findBySieCode(sieCode: string): Promise<EmpresaEntity | null> {
    const row = await prisma.empresa.findFirst({
      where: { sieCode },
      include: { representantesAdicionales: { where: { flgActivo: true }, orderBy: { orden: "asc" } } },
    });
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

  async replaceRepresentantesAdicionales(
    empresaId: string,
    representantes: EmpresaRepresentanteAdicionalInput[],
  ): Promise<void> {
    const ids = representantes.map((r) => r.id).filter((id): id is string => Boolean(id));
    await prisma.$transaction(async (tx) => {
      await tx.empresaRepresentanteAdicional.updateMany({
        where: {
          empresaId,
          flgActivo: true,
          ...(ids.length > 0 ? { id: { notIn: ids } } : {}),
        },
        data: { flgActivo: false },
      });
      let orden = 0;
      for (const rep of representantes) {
        const data = {
          nombre: rep.nombre.trim(),
          tipoDocumento: rep.tipoDocumento?.trim() || TIPOS_DOCUMENTO_PERSONA.DNI,
          documento: rep.documento.trim(),
          correo: rep.correo?.trim() || null,
          celular: rep.celular?.trim() || null,
          direccion: rep.direccion?.trim() || null,
          orden,
          flgActivo: true,
        };
        if (rep.id) {
          await tx.empresaRepresentanteAdicional.updateMany({
            where: { id: rep.id, empresaId },
            data,
          });
        } else {
          await tx.empresaRepresentanteAdicional.create({ data: { empresaId, ...data } });
        }
        orden += 1;
      }
    });
  }
}
export const empresaRepo = new EmpresaPrismaRepository();
