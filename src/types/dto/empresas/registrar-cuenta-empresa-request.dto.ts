/** Empresa a registrar en servicio-persona (se crea en la fuente si no existe). */
export interface RegistrarEmpresaFuenteDTO {
  nombre: string;
  /** Codigo de tipo de documento de empresa en servicio-persona (6 = RUC, 0 = no domiciliado). */
  idTipoDocumento: string;
  documento: string;
  direccion: string;
  correo: string;
  telefono: string;
  /** Codigo de pais del catalogo de ubigeo (75 = PERU). */
  pais: number;
  linkLogo?: string | null;
}

/** Persona de contacto: se reutiliza por documento o se crea en servicio-persona. */
export interface RegistrarPersonaContactoDTO {
  /** Codigo de tipo de documento de persona en servicio-persona (1 = DNI, 4 = CE, 7 = Pasaporte). */
  tipoDocumento: string;
  documento: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  nombres: string;
  celular?: string | null;
  direccion?: string | null;
}

/**
 * Registro de la relacion usuario (persona) - empresa:
 * asegura empresa y persona en servicio-persona y crea la cuenta local con sus
 * identificadores (sie_code / id_empresa), sin duplicar datos.
 */
export interface RegistrarCuentaEmpresaRequestDTO {
  /** sie_code de la empresa ya elegida en la busqueda (null = crearla en la fuente). */
  sieCodeEmpresa?: string | null;
  empresa: RegistrarEmpresaFuenteDTO;
  persona: RegistrarPersonaContactoDTO;
  /** Correo del acceso local (login del Portal del Cliente). */
  email: string;
  /** Rol local a asignar; por defecto cliente. */
  rolId?: string | null;
}
