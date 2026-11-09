import type { RecordatorioFacturacion } from "@/lib/shared/constants";

/** Cuerpo de POST `/api/facturacion/recordatorios/enviar`. */
export interface EnviarRecordatoriosRequestDTO {
  tipo: RecordatorioFacturacion;
  facturacionIds: string[];
}
