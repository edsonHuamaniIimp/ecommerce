export interface DdLegalResolverRequestDTO {
  expedienteId: string;
  decision: "aprobar" | "rechazar";
  motivo: string | null;
  informeLegalNombre: string | null;
  informeLegalUrl: string | null;
}
