import type { FilaCargaEmpresaDTO } from "./fila-carga-empresa.dto";

/** Fila validada (estado: lista | advertencia | error) con sus motivos. */
export interface FilaCargaValidadaDTO extends FilaCargaEmpresaDTO {
  estado: string;
  mensajes: string[];
  /** sie_code completado desde servicio-persona al validar. */
  sieCode?: string | null;
}
