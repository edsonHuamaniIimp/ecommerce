/** Persona tal como la devuelve servicio-persona (los campos sin valor se omiten). */
export interface PersonaApi {
  sie_code?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  nombres?: string;
  nombre_completo?: string;
  documento?: string;
  correo?: string;
  celular?: string;
}

/** Datos para crear una persona en servicio-persona (documento y tipo van juntos). */
export interface NuevaPersonaApi {
  apellido_paterno: string;
  apellido_materno?: string | null;
  nombres: string;
  id_tipo_documento: string;
  documento: string;
  correo?: string | null;
  celular?: string | null;
}

export interface IPersonaClient {
  /** Busca por documento exacto (DNI/CE/pasaporte); null si no existe en la fuente. */
  buscarPorDocumento(documento: string): Promise<PersonaApi | null>;
  /** Lista personas por termino de busqueda (prefijo de apellido paterno o DNI). */
  buscarPersonas(q: string): Promise<PersonaApi[]>;
  /** Crea la persona en la fuente y devuelve su `sie_code`. */
  crearPersona(dto: NuevaPersonaApi): Promise<PersonaApi>;
}
