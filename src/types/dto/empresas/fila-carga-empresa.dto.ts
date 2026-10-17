/** Fila cruda del archivo de carga masiva (texto). */
export interface FilaCargaEmpresaDTO {
  numero: number;
  /** Tipo de documento declarado ("" = autodetectar por el documento). */
  tipoDocumento: string;
  /** RUC o RUT/no domiciliado tal como viene en el archivo. */
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccionFiscal: string;
  telefono: string;
  emailContacto: string;
  emailFacturacion: string;
  representanteLegalNombre: string;
  representanteLegalDni: string;
  tipoComprobante: string;
  sitioWeb: string;
}
