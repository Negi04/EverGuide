/** Supabase's API returns at most this many rows per request, without any error. */
export const PAGE_ROWS = 1000

/**
 * Read every row of a query by fetching it page by page. `page(from, to)` must apply
 * a stable order and `.range(from, to)`; reading stops at the first short page.
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGE_ROWS) return rows
  }
}
