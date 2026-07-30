export interface FormDatos {
  razonSocial: string;
  ruc: string;
  contacto: string;
  email: string;
}

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

export interface StepDef {
  key: string;
  label: string;
  done: boolean;
}
