import { REGEX_EMAIL, TIPOS_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_PERSONA } from "@/lib/shared/constants";
import { validarDocumentoEmpresa, resolverTipoDocumentoEmpresa } from "./documento-empresa";
import { validarDocumentoPersona } from "./documento-persona";
import { dateUtils } from "./date";

/** Subconjunto de la ficha de empresa usado para decidir si el perfil esta completo. */
export interface EmpresaPerfilLike {
  tipoDocumento?: string | null;
  ruc?: string | null;
  razonSocial?: string | null;
  pais?: string | null;
  inicioOperaciones?: string | null;
  partidaElectronica?: string | null;
  representanteLegalNombre?: string | null;
  representanteLegalTipoDocumento?: string | null;
  representanteLegalDni?: string | null;
  representanteCorreo?: string | null;
  representanteCelular?: string | null;
  representanteDireccion?: string | null;
  primerAccesoCompletado?: boolean;
}

export interface PerfilEmpresaEstado {
  pendiente: boolean;
  camposFaltantes: string[];
}

/**
 * Campos obligatorios de la ficha de empresa/representante para poder generar
 * correctamente el contrato. Espejo de las validaciones de /auth/validar-datos.
 */
export function camposFaltantesPerfilEmpresa(empresa: EmpresaPerfilLike | null | undefined): string[] {
  if (!empresa) return ["Empresa vinculada"];
  const faltantes: string[] = [];

  if (!String(empresa.razonSocial ?? "").trim()) faltantes.push("Razon social");
  if (!String(empresa.pais ?? "").trim()) faltantes.push("Pais");

  const documento = String(empresa.ruc ?? "").trim();
  const tipo = resolverTipoDocumentoEmpresa(empresa.tipoDocumento, documento);
  if (!documento || !tipo || validarDocumentoEmpresa(tipo, documento) !== null) {
    faltantes.push("Documento de la empresa");
  } else if (tipo === TIPOS_DOCUMENTO_EMPRESA.RUC && !String(empresa.partidaElectronica ?? "").trim()) {
    faltantes.push("Partida electronica");
  }

  const inicio = String(empresa.inicioOperaciones ?? "").trim();
  if (!inicio || !dateUtils.isValid(inicio)) faltantes.push("Inicio de operaciones");

  if (!String(empresa.representanteLegalNombre ?? "").trim()) faltantes.push("Nombre del representante legal");
  const tipoRepresentante = (empresa.representanteLegalTipoDocumento ?? TIPOS_DOCUMENTO_PERSONA.DNI) as string;
  const documentoRepresentante = String(empresa.representanteLegalDni ?? "").trim();
  if (!documentoRepresentante || validarDocumentoPersona(tipoRepresentante, documentoRepresentante) !== null) {
    faltantes.push("Documento del representante legal");
  }

  const correoRepresentante = String(empresa.representanteCorreo ?? "").trim();
  if (!correoRepresentante || !REGEX_EMAIL.test(correoRepresentante)) faltantes.push("Correo del representante legal");
  if (!String(empresa.representanteCelular ?? "").trim()) faltantes.push("Celular del representante legal");
  if (!String(empresa.representanteDireccion ?? "").trim()) faltantes.push("Direccion del representante legal");

  return faltantes;
}

/** Estado de completitud: incluye el flag de primer acceso y los campos obligatorios. */
export function empresaPerfilPendiente(empresa: EmpresaPerfilLike | null | undefined): PerfilEmpresaEstado {
  const camposFaltantes = camposFaltantesPerfilEmpresa(empresa);
  return {
    pendiente: !empresa?.primerAccesoCompletado || camposFaltantes.length > 0,
    camposFaltantes,
  };
}
