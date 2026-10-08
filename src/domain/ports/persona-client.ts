/** Persona tal como la devuelve servicio-persona (los campos sin valor se omiten). */
export interface PersonaApi {
  sie_code?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  nombres?: string;
  nombre_completo?: string;
  id_tipo_documento?: string;
  documento?: string;
  direccion?: string;
  correo?: string;
  celular?: string;
}

/** Datos para crear/actualizar una persona en servicio-persona (documento y tipo van juntos). */
export interface NuevaPersonaApi {
  apellido_paterno: string;
  apellido_materno?: string | null;
  nombres: string;
  id_tipo_documento: string;
  documento: string;
  direccion?: string | null;
  correo?: string | null;
  celular?: string | null;
}

export interface IPersonaClient {
  /**
   * Busca por documento exacto (DNI/CE/pasaporte); null si no existe en la fuente.
   * Con `tipoDocumento` usa `GET /personas/documento` (exacto, cualquier tipo);
   * sin el, busca por nombre con el termino como DNI (comportamiento previo).
   */
  buscarPorDocumento(documento: string, tipoDocumento?: string): Promise<PersonaApi | null>;
  /** Lista personas por termino de busqueda (prefijo de apellido paterno o DNI). */
  buscarPersonas(q: string): Promise<PersonaApi[]>;
  /** Obtiene la persona completa por su `sie_code` (null si no existe o esta de baja). */
  obtenerPersona(sieCode: string): Promise<PersonaApi | null>;
  /** Crea la persona en la fuente y devuelve su `sie_code`. */
  crearPersona(dto: NuevaPersonaApi): Promise<PersonaApi>;
  /** Actualiza la persona en la fuente (`PUT /personas/{codigo}`; el logo/foto no se toca). */
  actualizarPersona(sieCode: string, dto: NuevaPersonaApi): Promise<PersonaApi>;
  /** Sube la foto de la persona (`POST /personas/{codigo}/foto`, bytes JPG/PNG/WEBP hasta 5 MB). */
  subirFoto(sieCode: string, imagen: Buffer, contentType: string): Promise<void>;
  /** Quita la foto de la persona (`DELETE /personas/{codigo}/foto`). */
  borrarFoto(sieCode: string): Promise<void>;
}
