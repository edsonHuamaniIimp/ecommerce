export interface PerfilResult {
  email: string;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
  tipoUsuarioId: number | null;
  idEmpresa: string | null;
  nombreEmpresa: string | null;
  /** Empresa fiscal local vinculada (FK `empresa_id`); null si no hay registro local con su RUC. */
  empresa: {
    ruc: string;
    razonSocial: string;
    direccionFiscal: string | null;
    telefono: string | null;
    emailContacto: string | null;
    representanteLegalNombre: string | null;
  } | null;
  /** Logo propio del usuario (URL); tiene prioridad sobre el de su empresa en el mapa. */
  logoUrl: string | null;
  /** Firma digital del usuario (URL de la imagen); se usa para firmar contratos desde el portal. */
  firmaUrl: string | null;
  /** Idioma preferido (es | en). */
  idioma: string | null;
}
