import type { CrearEmpresaRequestDTO } from "./crear-empresa-request.dto";

/** Edicion parcial de empresa: solo se actualizan los campos enviados. */
export interface ActualizarEmpresaRequestDTO extends Partial<CrearEmpresaRequestDTO> {
  id: string;
}
