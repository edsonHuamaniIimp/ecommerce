import type { EmpresaEntity, EmpresasPaginatedResult } from "@/domain/models/empresa";
import type { EmpresaDTO, EmpresasPaginatedDTO } from "@/types/dto/empresas";

/** Entidad de dominio -> DTO de respuesta (fechas ISO para la API). */
export function mapEmpresaToDTO(entity: EmpresaEntity): EmpresaDTO {
  return {
    id: entity.id,
    ruc: entity.ruc,
    razonSocial: entity.razonSocial,
    nombreComercial: entity.nombreComercial,
    direccionFiscal: entity.direccionFiscal,
    telefono: entity.telefono,
    emailContacto: entity.emailContacto,
    emailFacturacion: entity.emailFacturacion,
    representanteLegalNombre: entity.representanteLegalNombre,
    representanteLegalDni: entity.representanteLegalDni,
    tipoComprobante: entity.tipoComprobante,
    sitioWeb: entity.sitioWeb,
    estado: entity.estado,
    cuentaCreada: entity.cuentaCreada,
    primerAccesoCompletado: entity.primerAccesoCompletado,
    datosValidadosEn: entity.datosValidadosEn ? entity.datosValidadosEn.toISOString() : null,
    creadoPor: entity.creadoPor,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

/** Resultado paginado del dominio -> DTO de respuesta. */
export function mapEmpresasPaginatedToDTO(result: EmpresasPaginatedResult): EmpresasPaginatedDTO {
  return {
    data: result.data.map(mapEmpresaToDTO),
    total: result.total,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}
