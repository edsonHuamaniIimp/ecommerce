import type { DdDocumentoEstado, DdDocumentoTipo, DdVinculo } from "@/lib/shared/constants";

/** Datos que el cliente guarda desde el wizard de 4 pasos. */
export interface DdGuardarRequestDTO {
  tipoRelacionComercial: DdVinculo[];
  actividadEconomica: string | null;
  actividadEconomicaOtro: string | null;
  paisConstitucion: string | null;
  sitioWeb: string | null;
  emailRepresentante: string | null;
  aceptaDatos: boolean;
  aceptaVerificacion: boolean;
  declaraVerdad: boolean;
  representanteNombre: string | null;
  representanteTipoDocumento: string | null;
  representanteDocumento: string | null;
  representanteNacionalidad: string | null;
  beneficiarios: {
    nombre: string;
    documento: string;
    nacionalidad: string;
    porcentaje: number;
  }[];
  documentos: {
    tipo: DdDocumentoTipo;
    nombre: string;
    url: string;
    estado: DdDocumentoEstado;
  }[];
}
