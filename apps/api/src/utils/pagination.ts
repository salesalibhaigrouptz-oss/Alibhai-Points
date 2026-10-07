/**
 * Shared pagination helper for consistent pagination across all endpoints
 */

export interface PaginationParams {
  page?: string;
  page_size?: string;
  limit?: string;
}

export interface PaginationResult {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationResult;
}

/**
 * Parse and validate pagination parameters from query string
 */
export function parsePaginationParams(params: PaginationParams, defaultPageSize = 20, maxPageSize = 100): {
  page: number;
  page_size: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, parseInt(params.page_size || params.limit || String(defaultPageSize), 10))
  );
  const offset = (page - 1) * pageSize;

  return { page, page_size: pageSize, offset };
}

/**
 * Build pagination result metadata
 */
export function buildPaginationResult(
  page: number,
  pageSize: number,
  total: number
): PaginationResult {
  const totalPages = Math.ceil(total / pageSize);

  return {
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}

/**
 * Build a complete paginated response
 */
export function buildPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: buildPaginationResult(page, pageSize, total),
  };
}
