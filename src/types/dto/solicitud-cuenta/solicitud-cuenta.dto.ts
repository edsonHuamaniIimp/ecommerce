export interface SolicitudCuentaDTO {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  razonSocial: string;
  ruc: string | null;
  cargo: string | null;
  mensaje: string | null;
  estado: string;
  motivoRechazo: string | null;
  revisadoPor: string | null;
  revisadoEn: string | null;
  createdAt: string;
}
