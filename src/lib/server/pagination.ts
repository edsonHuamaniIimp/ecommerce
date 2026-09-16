import 'server-only';

import type { PaginatedResponseDTO } from "@/types/dto/pagination.dto";

export interface PaginationParams {
  page?: number;
  perPage?: number;
  search?: string;
  searchFields?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export function parsePagination(params: PaginationParams, defaultPerPage = 10) {
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(params.perPage) || defaultPerPage));
  const skip = (page - 1) * perPage;
  return { page, perPage, skip, take: perPage };
}

export function buildSearchFilter(search: string, fields: string[]): Record<string, unknown>[] | undefined {
  const q = search?.trim();
  if (!q) return undefined;
  return fields.map((field) => ({
    [field]: { contains: q, mode: "insensitive" },
  }));
}

export function paginatedResponse<T>(data: T[], total: number, page: number, perPage: number): PaginatedResponseDTO<T> {
  return {
    data,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  };
}
