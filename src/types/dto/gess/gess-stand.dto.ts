export interface GessStandDTO {
  id: string;
  eventoId: string;
  standApiId: string;
  standCode: string;
  tipoStand: string | null;
  medidas: string | null;
  estado: string | null;
  empresa: string | null;
  /** Logo de la empresa/usuario que reservo el stand (se pinta en el mapa). */
  empresaLogo?: string | null;
  /** Imagen referencial del tipo de stand (RF-08). */
  tipoImagen?: string | null;
  pabellon: string | null;
  ubicacion: string | null;
  rawData: unknown;
  bloqueId: string | null;
  email?: string | null;
  userId?: string | null;
  documentos: unknown;
  imagenes: unknown;
  /** Categoria por url de imagen: { "<url>": "<categoria>" }. */
  imagenesCategorias: unknown;
  /** Categoria por url de documento: { "<url>": "<categoria>" }. */
  documentosCategorias: unknown;
  /** Pre-reserva (bloqueo con empresa o titulo, sin solicitud): snapshot y autor. */
  preReservaRazonSocial?: string | null;
  preReservaTitulo?: string | null;
  preReservaRuc?: string | null;
  preReservaSie?: string | null;
  preReservaLogoUrl?: string | null;
  preReservaNota?: string | null;
  preReservaPor?: string | null;
  preReservaAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
