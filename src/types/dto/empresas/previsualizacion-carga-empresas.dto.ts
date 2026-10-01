import type { FilaCargaValidadaDTO } from "./fila-carga-validada.dto";
import type { ResumenCargaEmpresasDTO } from "./resumen-carga-empresas.dto";

export interface PrevisualizacionCargaEmpresasDTO {
  filas: FilaCargaValidadaDTO[];
  resumen: ResumenCargaEmpresasDTO;
}
