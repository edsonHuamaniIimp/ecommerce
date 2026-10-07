import 'client-only';

import { internalApi } from "./internal-api";
import type { ContratoGeneradoDTO } from "@/types/dto/contratos/contrato-generado.dto";
import type { DatosContratoDTO } from "@/types/dto/contratos/datos-contrato.dto";
import type { Idioma } from "@/lib/shared/constants";

/** Fachada cliente del generador de contratos (RF-11) y firma digital (RF-12). */
export const contratosService = {
  generar(body: {
    solicitudId: string;
    /** Cuotas configuradas (1..3): porcentaje + fecha de pago (yyyy-mm-dd). */
    cuotas: Array<{ porcentaje: number; fechaVencimiento: string }>;
    /** Idioma del contrato (F3): el que ve el usuario en la UI. */
    idioma?: Idioma;
    /** Datos del exhibidor capturados en el wizard (cuerpo del contrato). */
    contrato?: DatosContratoDTO;
  }) {
    return internalApi.post<ContratoGeneradoDTO>("/api/contratos/generar", body);
  },

  /** Firma digital con la imagen del perfil; devuelve el contrato firmado (RF-12). */
  firmar(body: { solicitudId: string; idioma?: Idioma; contrato?: DatosContratoDTO }) {
    return internalApi.post<{ docxUrl: string; pdfUrl: string | null; nombre: string }>("/api/contratos/firmar", body);
  },

  /** Borrador del contrato (paso Contrato): NO crea la solicitud. */
  borrador(body: {
    standIds: string[];
    cuotas: Array<{ porcentaje: number; fechaVencimiento: string }>;
    idioma?: Idioma;
    /** Datos del exhibidor capturados en el wizard (cuerpo del contrato). */
    contrato?: DatosContratoDTO;
  }) {
    return internalApi.post<ContratoGeneradoDTO>("/api/contratos/borrador", body);
  },

  /** Firma digital del borrador (antes de que exista la solicitud). */
  firmarBorrador(body: {
    standIds: string[];
    cuotas: Array<{ porcentaje: number; fechaVencimiento: string }>;
    idioma?: Idioma;
    /** Datos del exhibidor capturados en el wizard (cuerpo del contrato). */
    contrato?: DatosContratoDTO;
  }) {
    return internalApi.post<{ docxUrl: string; pdfUrl: string | null; nombre: string }>("/api/contratos/firmar-borrador", body);
  },
};
