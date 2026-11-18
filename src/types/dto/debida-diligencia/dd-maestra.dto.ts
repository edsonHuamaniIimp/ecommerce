/** Item del catalogo maestro administrable de Debida Diligencia. */
export interface DdMaestraItemDTO {
  tipo: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
}

export interface DdMaestraResponseDTO {
  data: DdMaestraItemDTO[];
}
