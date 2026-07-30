export interface PaginatedRequestDTO {
  page?: number;
  per_page?: number;
  search?: string;
}

export interface PaginatedResponseDTO<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}
