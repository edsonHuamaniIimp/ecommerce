import { TIPOS_SOLICITUD } from "@/lib/shared/constants";

export function permiteCorreosSolicitud(tipoSolicitud: string | null | undefined): boolean {
  return tipoSolicitud !== TIPOS_SOLICITUD.RESERVA_EMPRESA;
}
