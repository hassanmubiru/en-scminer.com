export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function parsePagination(
  query: Record<string, string | undefined>,
  defaultLimit = 12,
  maxLimit = 100,
): { page: number; limit: number; offset: number } {
  const page  = Math.max(1, parseInt(query['page']  ?? '1',  10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query['limit'] ?? String(defaultLimit), 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export function paginate<T>(
  items: T[], total: number, page: number, limit: number,
): PaginatedResult<T> {
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
