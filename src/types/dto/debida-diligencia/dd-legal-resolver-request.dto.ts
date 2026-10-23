import type { DdDocumentoTipo } from "@/lib/shared/constants";

export interface DdLegalResolverRequestDTO {
  expedienteId: string;
  decision: "aprobar" | "rechazar" | "observar";
  motivo: string | null;
  /** Documentos que Legal marca para correccion al observar. */
  documentosObservados?: DdDocumentoTipo[];
  informeLegalNombre: string | null;
  informeLegalUrl: string | null;
}
