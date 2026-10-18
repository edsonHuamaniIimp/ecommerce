export interface DdDocumentoAValidar {
  url: string;
  nombre: string;
  tipo: string;
}

/** Puerto de validacion de documentos del expediente (contenido real, no solo metadatos). */
export interface DdInformeLegalAValidar {
  url: string;
  nombre: string;
}

export interface IDebidaDiligenciaDocumentoValidator {
  validarDocumento(documento: DdDocumentoAValidar): Promise<void>;
  validarInformeLegal(documento: DdInformeLegalAValidar): Promise<void>;
}
