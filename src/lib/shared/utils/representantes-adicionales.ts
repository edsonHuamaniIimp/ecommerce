import { REGEX_EMAIL, TIPOS_DOCUMENTO_PERSONA } from "@/lib/shared/constants";
import { validarDocumentoPersona } from "./documento-persona";

export interface RepresentanteAdicionalForm {
  id?: string;
  nombre: string;
  tipoDocumento: string;
  documento: string;
  correo: string;
  celular: string;
  direccion: string;
}

export type RepresentanteAdicionalErrores = Partial<Record<keyof RepresentanteAdicionalForm, string>>;

export function representanteAdicionalVacio(): RepresentanteAdicionalForm {
  return {
    nombre: "",
    tipoDocumento: TIPOS_DOCUMENTO_PERSONA.DNI,
    documento: "",
    correo: "",
    celular: "",
    direccion: "",
  };
}

export function erroresRepresentanteAdicional(rep: RepresentanteAdicionalForm): RepresentanteAdicionalErrores {
  const errores: RepresentanteAdicionalErrores = {};
  if (!rep.nombre.trim()) errores.nombre = "El nombre es obligatorio";
  const documento = rep.documento.trim();
  if (!documento) {
    errores.documento = "El documento es obligatorio";
  } else {
    const error = validarDocumentoPersona(rep.tipoDocumento, documento);
    if (error) errores.documento = error;
  }
  if (!rep.correo.trim()) errores.correo = "El correo es obligatorio";
  else if (!REGEX_EMAIL.test(rep.correo.trim())) errores.correo = "Correo invalido";
  if (!rep.celular.trim()) errores.celular = "El celular es obligatorio";
  if (!rep.direccion.trim()) errores.direccion = "La direccion es obligatoria";
  return errores;
}

export function erroresRepresentantesAdicionales(reps: RepresentanteAdicionalForm[]): RepresentanteAdicionalErrores[] {
  return reps.map(erroresRepresentanteAdicional);
}

export function representanteAdicionalDesdeDTO(rep: {
  id?: string;
  nombre: string;
  tipoDocumento?: string | null;
  documento: string;
  correo?: string | null;
  celular?: string | null;
  direccion?: string | null;
}): RepresentanteAdicionalForm {
  return {
    id: rep.id,
    nombre: rep.nombre ?? "",
    tipoDocumento: rep.tipoDocumento || TIPOS_DOCUMENTO_PERSONA.DNI,
    documento: rep.documento ?? "",
    correo: rep.correo ?? "",
    celular: rep.celular ?? "",
    direccion: rep.direccion ?? "",
  };
}

export function representanteAdicionalPayload(rep: RepresentanteAdicionalForm) {
  return {
    ...(rep.id ? { id: rep.id } : {}),
    nombre: rep.nombre.trim(),
    tipoDocumento: rep.tipoDocumento,
    documento: rep.documento.trim(),
    correo: rep.correo.trim() || null,
    celular: rep.celular.trim() || null,
    direccion: rep.direccion.trim() || null,
  };
}
