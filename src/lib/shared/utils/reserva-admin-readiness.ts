import {
  MONEDAS,
  TIPOS_COMPROBANTE,
  TIPOS_DOCUMENTO_EMPRESA,
  TIPOS_DOCUMENTO_PERSONA,
  type TipoComprobante,
} from "@/lib/shared/constants";
import { normalizarDocumentoPersona, normalizarTipoDocumentoPersona, validarDocumentoPersona } from "./documento-persona";
import { normalizarDocumentoEmpresa, resolverTipoDocumentoEmpresa, validarDocumentoEmpresa } from "./documento-empresa";

/** Datos minimos de la empresa que alimentan el contrato y la facturacion. */
export interface EmpresaReservaAdminFuente {
  razonSocial?: string | null;
  ruc?: string | null;
  tipoDocumento?: string | null;
  pais?: string | null;
  direccionFiscal?: string | null;
  representanteUserId?: string | null;
  representanteLegalNombre?: string | null;
  representanteLegalDni?: string | null;
  /** TIPOS_DOCUMENTO_PERSONA; si falta se asume DNI. */
  representanteLegalTipoDocumento?: string | null;
  representanteCorreo?: string | null;
  emailContacto?: string | null;
  emailFacturacion?: string | null;
}

export interface ReadinessReservaAdmin {
  ok: boolean;
  /** Lista plana para mensajes de API. */
  faltantes: string[];
  faltantesEmpresa: string[];
  faltantesRepresentante: string[];
  faltantesGenerales: string[];
  faltantesPago: string[];
}

function texto(valor: string | null | undefined): string {
  return String(valor ?? "").trim();
}

/**
 * Valida los ingredientes que necesitan el contrato y la facturacion antes de
 * crear una reserva administrativa. No valida el plan de cuotas (lo valida el
 * servicio de reservas) ni la firma (se completa despues, antes de firmar).
 */
export function validarEmpresaReservaAdministrativa(
  empresa: EmpresaReservaAdminFuente,
  tipoComprobante: TipoComprobante | string,
  tipoPago: string,
): ReadinessReservaAdmin {
  const faltantesEmpresa: string[] = [];
  const faltantesRepresentante: string[] = [];
  const faltantesGenerales: string[] = [];
  const faltantesPago: string[] = [];
  const documento = normalizarDocumentoEmpresa(empresa.ruc);
  const tipoDocumento = documento
    ? resolverTipoDocumentoEmpresa(empresa.tipoDocumento, documento)
    : null;
  const tipoDocumentoRepresentante = normalizarTipoDocumentoPersona(
    texto(empresa.representanteLegalTipoDocumento) || TIPOS_DOCUMENTO_PERSONA.DNI,
  );
  const dni = normalizarDocumentoPersona(tipoDocumentoRepresentante, empresa.representanteLegalDni);
  const email =
    texto(empresa.representanteCorreo) ||
    texto(empresa.emailFacturacion) ||
    texto(empresa.emailContacto);

  if (!texto(empresa.razonSocial)) faltantesEmpresa.push("razón social");
  if (!tipoDocumento || validarDocumentoEmpresa(tipoDocumento, documento)) faltantesEmpresa.push("RUC de 11 dígitos");
  if (!texto(empresa.direccionFiscal)) faltantesEmpresa.push("dirección fiscal");
  if (!email) faltantesEmpresa.push("correo de facturación");
  /* La cuenta vinculada del representante NO es requisito: la reserva puede crearse sin ella
     (la solicitud queda sin dueno de portal hasta que se vincule la cuenta). */
  if (!texto(empresa.representanteLegalNombre)) faltantesRepresentante.push("nombre");
  if (!dni) {
    faltantesRepresentante.push("documento");
  } else if (
    tipoComprobante === TIPOS_COMPROBANTE.BOLETA &&
    tipoDocumento !== TIPOS_DOCUMENTO_EMPRESA.NO_DOMICILIADO && /* empresa extranjera: la boleta va a la empresa, no al representante */
    validarDocumentoPersona(tipoDocumentoRepresentante, dni)
  ) {
    /* La boleta admite DNI (8 digitos), carne de extranjeria o pasaporte (alfanumerico). */
    faltantesRepresentante.push(
      tipoDocumentoRepresentante === TIPOS_DOCUMENTO_PERSONA.DNI
        ? "DNI de 8 dígitos para la boleta"
        : "documento válido (alfanumérico, máx. 15) para la boleta",
    );
  }
  if (tipoComprobante !== TIPOS_COMPROBANTE.FACTURA && tipoComprobante !== TIPOS_COMPROBANTE.BOLETA) {
    faltantesGenerales.push("tipo de facturación");
  }
  if (tipoPago !== MONEDAS.USD && tipoPago !== MONEDAS.PEN) {
    faltantesPago.push("tipo de pago");
  }

  const faltantes = [
    ...faltantesEmpresa.map((faltante) => `Empresa: ${faltante}`),
    ...faltantesRepresentante.map((faltante) => `Representante legal: ${faltante}`),
    ...faltantesGenerales.map((faltante) => `Facturación: ${faltante}`),
    ...faltantesPago.map((faltante) => `Pago: ${faltante}`),
  ];

  return {
    ok: faltantes.length === 0,
    faltantes,
    faltantesEmpresa,
    faltantesRepresentante,
    faltantesGenerales,
    faltantesPago,
  };
}
