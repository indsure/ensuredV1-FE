/**
 * PostgREST returns at most 1000 rows a call, and says nothing when it stops
 * there. A book bigger than that showed a list, a count and totals that were
 * quietly wrong. This reads page after page until a short page comes back.
 *
 * `page(from, to)` must build the same query each time with a stable, unique
 * order (end with .order("id")), or rows can repeat or go missing between
 * pages. 50 pages (50,000 rows) is the ceiling, far past any real book.
 */
const PAGE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let n = 0; n < 50; n++) {
    const { data, error } = await page(n * PAGE, n * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}
