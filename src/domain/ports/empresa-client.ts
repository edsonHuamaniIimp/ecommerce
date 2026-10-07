/** Empresa tal como la devuelve servicio-persona (los campos sin valor se omiten). */
export interface EmpresaApi {
  sie_code?: string;
  nombre?: string;
  id_tipo_documento?: string;
  documento?: string;
  direccion?: string;
  correo?: string;
  telefono?: string;
  link_logo?: string;
  pais?: number;
}

/** Datos para crear una empresa en servicio-persona (documento y tipo van juntos). */
export interface NuevaEmpresaApi {
  nombre: string;
  id_tipo_documento: string;
  documento: string;
  direccion: string;
  correo: string;
  telefono: string;
  pais: number;
  link_logo?: string | null;
}

export interface IEmpresaClient {
  /** Lista empresas por termino de busqueda (prefijo de razon social o RUC). */
  buscarEmpresas(q: string): Promise<EmpresaApi[]>;
  /** Busca por documento exacto (RUC o no domiciliado); null si no existe en la fuente. */
  buscarPorDocumento(tipoDocumento: string, numeroDocumento: string): Promise<EmpresaApi | null>;
  /** Crea la empresa en la fuente y devuelve su `sie_code`. */
  crearEmpresa(dto: NuevaEmpresaApi): Promise<EmpresaApi>;
  /** Actualiza la empresa en la fuente (cuerpo completo; no cambia el logo). */
  actualizarEmpresa(sieCode: string, dto: NuevaEmpresaApi): Promise<EmpresaApi>;
}
