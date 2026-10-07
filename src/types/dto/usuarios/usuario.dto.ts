/** Usuario del Portal del Cliente (bandeja de Usuarios). La persona vive en servicio-persona. */
export interface UsuarioPortalDTO {
  id: string;
  email: string;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
  rol: string;
  empresaId: string | null;
  /** Codigo SIE de la empresa en la API de entidades (ej. E0000003804). */
  idEmpresa: string | null;
  empresa: string | null;
  /** true = tiene empresa vinculada (Portal del Cliente); false = usuario interno/sin empresa. */
  esPortal: boolean;
  /** Identificador de la persona en servicio-persona (sie_code). */
  sieCode: string | null;
  debeCambiarPassword: boolean;
}

/** Empresa elegida desde la API de entidades (codigo SIE + razon social). */
export interface EmpresaAccesoDTO {
  idEmpresa: string;
  nombreEmpresa: string;
  /** RUC opcional: si existe una empresa local con ese RUC se vincula tambien la FK. */
  ruc?: string | null;
}

/** Datos de la persona (se escriben en servicio-persona) + correo del acceso local. */
export interface NuevoUsuarioPortalDTO {
  email: string;
  tipoDocumento: string;
  documento: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  nombres: string;
  celular?: string | null;
  /** Direccion de la persona (la fuente la exige al crear/actualizar). */
  direccion?: string | null;
  /** Rol local a asignar; por defecto cliente. */
  rolId?: string | null;
}

export interface CrearUsuarioDTO extends NuevoUsuarioPortalDTO, EmpresaAccesoDTO {}

export interface CrearUsuariosLoteDTO extends EmpresaAccesoDTO {
  rolId?: string | null;
  usuarios: NuevoUsuarioPortalDTO[];
}

/** Persona de servicio-persona devuelta por la busqueda. */
export interface PersonaApiDTO {
  sie_code?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  nombres?: string;
  nombre_completo?: string;
  documento?: string;
  correo?: string;
  celular?: string;
}

/** Alta de cuenta local para una persona existente en servicio-persona. */
export interface CrearCuentaUsuarioDTO extends EmpresaAccesoDTO {
  sieCode: string;
  email: string;
  rolId?: string | null;
}

export interface ResultadoCreacionUsuarioDTO {
  email: string;
  creado: boolean;
  emailEnviado: boolean | null;
  error: string | null;
}

export interface ResultadoLoteUsuariosDTO {
  resultados: ResultadoCreacionUsuarioDTO[];
}

/** Asignar/cambiar la empresa (API de entidades) del acceso local. */
export interface ActualizarUsuarioDTO extends EmpresaAccesoDTO {
  id: string;
}

export interface EnviarAccesosUsuarioDTO {
  id: string;
}

export interface ResultadoEnvioAccesosDTO {
  email: string;
  emailEnviado: boolean;
}
