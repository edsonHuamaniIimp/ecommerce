/** Imagen referencial por tipo de stand (aplica a todos los stands de ese tipo). */
export interface TipoStandImagenEntity {
  id: string;
  /** Clave canonica del tipo (ver TIPOS_STAND_CATALOGO). */
  tipo: string;
  imagenUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Item del catalogo para la UI: tipo canonico + etiqueta + imagen (null = sin subir). */
export interface TipoStandImagenItem {
  tipo: string;
  label: string;
  imagenUrl: string | null;
}
