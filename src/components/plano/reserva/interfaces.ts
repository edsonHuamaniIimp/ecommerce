/** Datos del formulario de reserva — paso Datos. */
export interface FormDatos {
  razonSocial: string;
  tipoDocumento: string;
  numeroDocumento: string;
  direccion: string;
  telefono: string;
  contacto: string;
  email: string;
  tipoComprobante: string;
}

/** Datos del exhibidor para el cuerpo del contrato — paso Cuotas. */
export interface DatosContratoForm {
  razonSocial: string;
  ruc: string;
  direccion: string;
  representante: string;
  representanteDni: string;
  partidaElectronica: string;
}

/** True si los datos obligatorios del contrato estan completos (partida es opcional). */
export function datosContratoValidos(datos: DatosContratoForm): boolean {
  return Boolean(
    datos.razonSocial.trim() &&
    datos.ruc.trim() &&
    datos.direccion.trim() &&
    datos.representante.trim() &&
    datos.representanteDni.trim(),
  );
}

/** Info vinculada de un stand desde BD + API. */
export interface GessLinkedInfo {
  standCode: string;
  tipoStand: string | null;
  empresa: string | null;
  estado: string | null;
  medidas: string | null;
  documentos: string[];
  imagenes: string[];
  reserved: boolean;
  dbId: string;
}

/** Definicion de un step para el indicador visual. */
export interface StepDef {
  key: string;
  label: string;
  done: boolean;
}
