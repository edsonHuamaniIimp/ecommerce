import {
  MONEDAS,
  REGEX_DNI,
  REGEX_RUC,
  TIPOS_COMPROBANTE,
  type TipoComprobante,
} from "@/lib/shared/constants";

/** Datos minimos de la empresa que alimentan el contrato y la facturacion. */
export interface EmpresaReservaAdminFuente {
  razonSocial?: string | null;
  ruc?: string | null;
  direccionFiscal?: string | null;
  representanteUserId?: string | null;
  representanteLegalNombre?: string | null;
  representanteLegalDni?: string | null;
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
  const ruc = texto(empresa.ruc).replace(/\D/g, "");
  const dni = texto(empresa.representanteLegalDni).replace(/\D/g, "");
  const email =
    texto(empresa.representanteCorreo) ||
    texto(empresa.emailFacturacion) ||
    texto(empresa.emailContacto);

  if (!texto(empresa.razonSocial)) faltantesEmpresa.push("razón social");
  if (!REGEX_RUC.test(ruc)) faltantesEmpresa.push("RUC de 11 dígitos");
  if (!texto(empresa.direccionFiscal)) faltantesEmpresa.push("dirección fiscal");
  if (!email) faltantesEmpresa.push("correo de facturación");
  if (!texto(empresa.representanteUserId)) faltantesRepresentante.push("cuenta vinculada");
  if (!texto(empresa.representanteLegalNombre)) faltantesRepresentante.push("nombre");
  if (!dni) {
    faltantesRepresentante.push("documento");
  } else if (tipoComprobante === TIPOS_COMPROBANTE.BOLETA && !REGEX_DNI.test(dni)) {
    faltantesRepresentante.push("DNI de 8 dígitos para la boleta");
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
