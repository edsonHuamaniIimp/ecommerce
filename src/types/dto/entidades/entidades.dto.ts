/** POST /rest/searchpersonv00 */
export interface SearchPersonRequestDTO {
  documento?: string;
  nombre?: string;
}

/** POST /rest/searchempresa */
export interface SearchEmpresaRequestDTO {
  nroDocument?: string;
  razonSocial?: string;
}

export interface PersonaResultDTO {
  documento: string;
  id_tipo_documento: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  fecha_nacimiento: string;
  sexo: string;
  correo: string;
  celular: string;
  direccion: string;
  distrito: number;
  provincia: number;
  departamento: number;
  pais: number;
  empresa: string;
  id_empresa: string;
  ocupacion: string;
  id_ocupacion: string;
  asociado: boolean;
  sie_code: string;
  code: string;
  message: string;
}

export interface EmpresaResultDTO {
  [key: string]: unknown;
}

export interface SearchPersonResponseDTO {
  success: boolean;
  message: string;
  ListInfoPersona: PersonaResultDTO[];
}

export interface SearchEmpresaResponseDTO {
  success: boolean;
  message: string;
  ListInfoEmpresa: EmpresaResultDTO[];
}
