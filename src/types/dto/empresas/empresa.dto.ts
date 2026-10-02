/** Empresa exhibidora registrada por el backoffice (respuesta API). */
export interface EmpresaDTO {
  id: string;
  ruc: string;
  razonSocial: string;
  /** Logo (URL) que se pinta en los stands reservados del mapa. */
  logoUrl: string | null;
  nombreComercial: string | null;
  direccionFiscal: string | null;
  telefono: string | null;
  emailContacto: string | null;
  emailFacturacion: string | null;
  representanteLegalNombre: string | null;
  representanteLegalDni: string | null;
  tipoComprobante: string;
  sitioWeb: string | null;
  estado: string;
  cuentaCreada: boolean;
  primerAccesoCompletado: boolean;
  datosValidadosEn: string | null;
  creadoPor: string | null;
  createdAt: string;
  updatedAt: string;
}
