import { REGEX_EMAIL, TIPOS_DOCUMENTO_EMPRESA } from "@/lib/shared/constants";
import { resolverTipoDocumentoEmpresa, validarDocumentoEmpresa } from "./documento-empresa";
import { validarDocumentoPersona } from "./documento-persona";
import { dateUtils } from "./date";

/** Campos de la ficha de empresa que se validan antes de guardar. */
export interface EmpresaFormValidacionLike {
  ruc: string;
  tipoDocumento: string;
  pais: string;
  razonSocial: string;
  nombreComercial?: string;
  telefono?: string;
  tipoComprobante?: string;
  sitioWeb?: string;
  nombreFriso?: string;
  facturarANombre?: string;
  actividadEconomica?: string;
  estadoContribuyente?: string;
  inicioOperaciones: string;
  partidaElectronica: string;
  emailContacto: string;
  emailFacturacion: string;
  direccionFiscal: string;
  representanteLegalNombre: string;
  representanteLegalTipoDocumento: string;
  representanteLegalDni: string;
  representanteCorreo: string;
  representanteCelular: string;
  representanteDireccion: string;
  responsableExteminNombre?: string;
  responsableExteminTelefono?: string;
  responsableExteminTipoDocumento: string;
  responsableExteminDni: string;
  responsableExteminEmail: string;
  responsablePagosNombre?: string;
  responsablePagosTelefono?: string;
  responsablePagosTipoDocumento: string;
  responsablePagosDni: string;
  responsablePagosEmail: string;
}

export type EmpresaFormErrores = Partial<Record<keyof EmpresaFormValidacionLike, string>>;

export interface EmpresaFormValidacionOpciones {
  /** true para el perfil: exige tambien los campos comerciales y de coordinacion. */
  requerirTodos?: boolean;
}

/**
 * Reglas de validacion compartidas por /auth/validar-datos y el perfil.
 * Deben coincidir con el endpoint de validacion de la empresa.
 */
export function erroresFormularioEmpresa(
  form: EmpresaFormValidacionLike,
  opciones: EmpresaFormValidacionOpciones = {},
): EmpresaFormErrores {
  const nuevos: EmpresaFormErrores = {};
  if (!form.pais.trim()) nuevos.pais = "Selecciona el pais de la empresa";
  if (!form.razonSocial.trim()) nuevos.razonSocial = "La razon social es obligatoria";

  const tipoDocumento = resolverTipoDocumentoEmpresa(form.tipoDocumento, form.ruc);
  if (!tipoDocumento) {
    nuevos.tipoDocumento = "Selecciona el tipo de documento";
  } else {
    const errorDocumento = validarDocumentoEmpresa(tipoDocumento, form.ruc);
    if (errorDocumento) nuevos.ruc = errorDocumento;
  }
  if (tipoDocumento === TIPOS_DOCUMENTO_EMPRESA.RUC && !form.partidaElectronica.trim()) {
    nuevos.partidaElectronica = "La partida electronica es obligatoria para empresas con RUC";
  }

  if (!form.inicioOperaciones.trim()) {
    nuevos.inicioOperaciones = "La fecha de inicio de operaciones es obligatoria";
  } else if (!dateUtils.isValid(form.inicioOperaciones)) {
    nuevos.inicioOperaciones = "La fecha de inicio de operaciones es invalida";
  }

  if (form.emailFacturacion.trim() && !REGEX_EMAIL.test(form.emailFacturacion.trim())) {
    nuevos.emailFacturacion = "Correo invalido";
  }
  if (form.emailContacto.trim() && !REGEX_EMAIL.test(form.emailContacto.trim())) {
    nuevos.emailContacto = "Correo invalido";
  }
  /* El domicilio fiscal no es una direccion web (error frecuente de captura). */
  if (/^(https?:\/\/|www\.)/i.test(form.direccionFiscal.trim())) {
    nuevos.direccionFiscal = "Ingresa el domicilio fiscal, no una direccion web";
  }
  if (form.responsableExteminEmail.trim() && !REGEX_EMAIL.test(form.responsableExteminEmail.trim())) {
    nuevos.responsableExteminEmail = "Correo invalido";
  }
  if (form.responsablePagosEmail.trim() && !REGEX_EMAIL.test(form.responsablePagosEmail.trim())) {
    nuevos.responsablePagosEmail = "Correo invalido";
  }

  if (!form.representanteLegalNombre.trim()) {
    nuevos.representanteLegalNombre = "El nombre del representante legal es obligatorio";
  }
  const dni = form.representanteLegalDni.trim();
  if (!dni) {
    nuevos.representanteLegalDni = "El documento del representante legal es obligatorio";
  } else {
    const errorDni = validarDocumentoPersona(form.representanteLegalTipoDocumento, dni);
    if (errorDni) nuevos.representanteLegalDni = errorDni;
  }

  const validarDocumentoOpcional = (
    tipo: string,
    documento: string,
    campo: "responsableExteminDni" | "responsablePagosDni",
  ) => {
    const valor = documento.trim();
    if (!valor) return;
    const error = validarDocumentoPersona(tipo, valor);
    if (error) nuevos[campo] = error;
  };
  validarDocumentoOpcional(
    form.responsableExteminTipoDocumento,
    form.responsableExteminDni,
    "responsableExteminDni",
  );
  validarDocumentoOpcional(
    form.responsablePagosTipoDocumento,
    form.responsablePagosDni,
    "responsablePagosDni",
  );

  if (opciones.requerirTodos) {
    const obligatorios: Array<[keyof EmpresaFormValidacionLike, string]> = [
      ["nombreComercial", "El nombre comercial es obligatorio"],
      ["telefono", "El telefono de la empresa es obligatorio"],
      ["direccionFiscal", "La direccion fiscal es obligatoria"],
      ["sitioWeb", "El sitio web es obligatorio"],
      ["emailContacto", "El correo de contacto es obligatorio"],
      ["emailFacturacion", "El correo de facturacion es obligatorio"],
      ["nombreFriso", "El nombre en el friso es obligatorio"],
      ["facturarANombre", "El nombre para facturar es obligatorio"],
      ["actividadEconomica", "La actividad economica es obligatoria"],
      ["estadoContribuyente", "El estado del contribuyente es obligatorio"],
      ["tipoComprobante", "El tipo de comprobante es obligatorio"],
      ["responsableExteminNombre", "El nombre del responsable EXTEMIN es obligatorio"],
      ["responsableExteminTelefono", "El telefono del responsable EXTEMIN es obligatorio"],
      ["responsableExteminDni", "El documento del responsable EXTEMIN es obligatorio"],
      ["responsableExteminEmail", "El correo del responsable EXTEMIN es obligatorio"],
      ["responsablePagosNombre", "El nombre del responsable de pagos es obligatorio"],
      ["responsablePagosTelefono", "El telefono del responsable de pagos es obligatorio"],
      ["responsablePagosDni", "El documento del responsable de pagos es obligatorio"],
      ["responsablePagosEmail", "El correo del responsable de pagos es obligatorio"],
    ];
    for (const [campo, mensaje] of obligatorios) {
      if (!String(form[campo] ?? "").trim()) nuevos[campo] = mensaje;
    }
  }
  const correoRep = form.representanteCorreo.trim();
  if (!correoRep) {
    nuevos.representanteCorreo = "El correo del representante legal es obligatorio";
  } else if (!REGEX_EMAIL.test(correoRep)) {
    nuevos.representanteCorreo = "Correo invalido";
  }
  if (!form.representanteCelular.trim()) {
    nuevos.representanteCelular = "El celular del representante legal es obligatorio";
  }
  if (!form.representanteDireccion.trim()) {
    nuevos.representanteDireccion = "La direccion del representante legal es obligatoria";
  }

  return nuevos;
}
