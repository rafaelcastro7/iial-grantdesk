/** Read stable database pages before ranking, never truncate the candidate pool silently. */
export async function readCatalogPages<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 500,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const result = await read(from, from + size - 1);
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < size) return rows;
  }
}

export function catalogPage<T>(rows: T[], offset: number, limit: number) {
  return { rows: rows.slice(offset, offset + limit), total: rows.length, hasMore: offset + limit < rows.length };
}