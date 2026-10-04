/** Resultado de generar el contrato desde la plantilla (RF-11). */
export interface ContratoGeneradoDTO {
  docxUrl: string;
  pdfUrl: string | null;
  nombre: string;
  /** False cuando el conversor PDF (LibreOffice) no esta disponible en el entorno. */
  pdfDisponible: boolean;
}
