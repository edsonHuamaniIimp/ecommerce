export interface CrearSolicitudCuentaRequestDTO {
  email: string;
  nombre: string;
  apellidos: string;
  telefono?: string;
  razonSocial: string;
  ruc?: string;
  cargo?: string;
  mensaje?: string;
}
