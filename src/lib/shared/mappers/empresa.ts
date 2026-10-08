import type { EmpresaEntity, EmpresasPaginatedResult } from "@/domain/models/empresa";
import type { EmpresaApi } from "@/domain/ports/empresa-client";
import type { PersonaApi } from "@/domain/ports/persona-client";
import { REGEX_RUC, TIPOS_DOCUMENTO_EMPRESA } from "@/lib/shared/constants";
import type { EmpresaDTO, EmpresaFuenteDTO, EmpresasPaginatedDTO, PersonaFuenteDTO } from "@/types/dto/empresas";

/** Entidad de dominio -> DTO de respuesta (fechas ISO para la API). */
export function mapEmpresaToDTO(entity: EmpresaEntity): EmpresaDTO {
  return {
    id: entity.id,
    ruc: entity.ruc,
    sieCode: entity.sieCode,
    razonSocial: entity.razonSocial,
    logoUrl: entity.logoUrl,
    nombreComercial: entity.nombreComercial,
    direccionFiscal: entity.direccionFiscal,
    telefono: entity.telefono,
    emailContacto: entity.emailContacto,
    emailFacturacion: entity.emailFacturacion,
    representanteLegalNombre: entity.representanteLegalNombre,
    representanteLegalDni: entity.representanteLegalDni,
    representanteCorreo: entity.representanteCorreo,
    representanteCelular: entity.representanteCelular,
    representanteDireccion: entity.representanteDireccion,
    partidaElectronica: entity.partidaElectronica,
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

/** Empresa de servicio-persona (fuente) -> DTO de respuesta de la busqueda. */
export function mapEmpresaFuenteToDTO(empresa: EmpresaApi): EmpresaFuenteDTO {
  const documento = empresa.documento ?? "";
  const tipo = empresa.id_tipo_documento ?? (REGEX_RUC.test(documento) ? TIPOS_DOCUMENTO_EMPRESA.RUC : TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO);
  return {
    sieCode: empresa.sie_code ?? "",
    nombre: empresa.nombre ?? "",
    idTipoDocumento: tipo,
    documento,
    direccion: empresa.direccion ?? null,
    correo: empresa.correo ?? null,
    telefono: empresa.telefono ?? null,
  };
}

/** Persona de servicio-persona (padron interno) -> DTO de respuesta. */
export function mapPersonaFuenteToDTO(persona: PersonaApi): PersonaFuenteDTO {
  return {
    sieCode: persona.sie_code ?? "",
    documento: persona.documento ?? "",
    nombreCompleto: persona.nombre_completo ?? "",
    direccion: persona.direccion ?? null,
    correo: persona.correo ?? null,
    celular: persona.celular ?? null,
  };
}
