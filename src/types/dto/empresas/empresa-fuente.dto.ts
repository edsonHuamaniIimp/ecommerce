/** Empresa de servicio-persona devuelta por la busqueda (fuente). */
export interface EmpresaFuenteDTO {
  sieCode: string;
  nombre: string;
  /** Codigo de tipo de documento de empresa (6 = RUC, 0 = no domiciliado). */
  idTipoDocumento: string;
  documento: string;
  direccion: string | null;
  correo: string | null;
  telefono: string | null;
}
