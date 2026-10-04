/** Imagen referencial por tipo de stand (por evento; `eventoId` null = global). */
export interface TipoStandImagenEntity {
  id: string;
  /** Clave canonica del tipo (ver TIPOS_STAND_CATALOGO). */
  tipo: string;
  /** Evento al que aplica (null = imagen global de respaldo). */
  eventoId: string | null;
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
