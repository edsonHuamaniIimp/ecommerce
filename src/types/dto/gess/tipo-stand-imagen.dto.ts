/** Item del catalogo de imagenes referenciales por tipo de stand (RF-08). */
export interface TipoStandImagenDTO {
  /** Clave canonica del tipo (ver TIPOS_STAND_CATALOGO). */
  tipo: string;
  /** Etiqueta legible. */
  label: string;
  /** URL de la imagen referencial (null = sin subir). */
  imagenUrl: string | null;
}
