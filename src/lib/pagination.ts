export const MAX_PAGE_SIZE = 50;

export type PaginationParams = {
  page: number;
  offset: number;
  limit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  offset: number;
  limit: number;
};

export function parsePaginationQuery(query: {
  page?: unknown;
  offset?: unknown;
}): PaginationParams | { error: string } {
  const limit = MAX_PAGE_SIZE;

  let page = 1;
  if (query.page !== undefined && query.page !== "") {
    const p = Number(query.page);
    if (!Number.isInteger(p) || p < 1) {
      return { error: "Query param page must be a positive integer" };
    }
    page = p;
  }

  let offset: number;
  if (query.offset !== undefined && query.offset !== "") {
    const o = Number(query.offset);
    if (!Number.isInteger(o) || o < 0) {
      return { error: "Query param offset must be a non-negative integer" };
    }
    offset = o;
  } else {
    offset = (page - 1) * limit;
  }

  return { page, offset, limit };
}
