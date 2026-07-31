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
