export function parsePagination(query, defaultLimit = 12, maxLimit = 100) {
    const page = Math.max(1, parseInt(query['page'] ?? '1', 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query['limit'] ?? String(defaultLimit), 10) || defaultLimit));
    return { page, limit, offset: (page - 1) * limit };
}
export function paginate(items, total, page, limit) {
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
