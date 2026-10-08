import 'server-only';

import { consultasClient } from "./consultas-client";
import type { DniConsulta, IConsultaDocumentoClient } from "@/domain/ports/consulta-documento-client";

/** Adaptador del cliente RENIEC/SUNAT existente (apis.net.pe) al puerto de consulta de documentos. */
export class ConsultaDocumentoClient implements IConsultaDocumentoClient {
  async consultarDni(numero: string): Promise<DniConsulta> {
    const data = (await consultasClient.consultarDni(numero)) as Record<string, unknown>;
    const texto = (valor: unknown) => (valor === undefined || valor === null ? undefined : String(valor));
    return {
      nombres: texto(data.nombres),
      apellidoPaterno: texto(data.apellidoPaterno),
      apellidoMaterno: texto(data.apellidoMaterno),
      nombreCompleto: texto(data.nombreCompleto),
    };
  }
}
