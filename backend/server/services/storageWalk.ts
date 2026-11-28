/**
 * List every object under one folder of a storage bucket.
 *
 * Supabase storage lists one folder level at a time, so this walks down. Used
 * by the account export (to include every file), account deletion (to remove
 * every file, not only the ones a row still names) and the leftover-file
 * clean-up. One walker, so all three agree on what "the account's files" are.
 *
 * Paging advances by what came back and stops only on an empty page, so a
 * server that caps a page below the limit cannot truncate the list. Bounded in
 * depth and count so a runaway listing cannot hold a request open forever.
 */

export interface StoredObject {
  key: string;
  /** Bytes, as storage reports them; null when it does not say. */
  size: number | null;
  /** When the object was last written, ISO string; null when unknown. */
  updatedAt: string | null;
}

export interface ListableStorage {
  from(bucket: string): {
    list(
      prefix: string,
      opts: { limit: number; offset: number; sortBy?: { column: string; order: string } },
    ): Promise<{ data: { name: string; id: string | null; metadata?: any; updated_at?: string | null; created_at?: string | null }[] | null; error: { message?: string } | null }>;
  };
}

export async function listFolder(
  storage: ListableStorage,
  bucket: string,
  folder: string,
  opts: { maxDepth?: number; maxObjects?: number } = {},
): Promise<StoredObject[]> {
  const maxDepth = opts.maxDepth ?? 8;
  const maxObjects = opts.maxObjects ?? 50000;
  const out: StoredObject[] = [];

  const walk = async (prefix: string, depth: number): Promise<void> => {
    if (depth > maxDepth || out.length >= maxObjects) return;
    for (let offset = 0; ; ) {
      const { data, error } = await storage
        .from(bucket)
        .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(error.message || "storage list failed");
      if (!data?.length) return;
      offset += data.length;
      for (const item of data) {
        if (item.name === ".emptyFolderPlaceholder") continue; // storage bookkeeping, not a document
        const path = `${prefix}/${item.name}`;
        // A folder comes back with no id; a file has one.
        if (item.id == null) {
          await walk(path, depth + 1);
        } else {
          const size = Number(item.metadata?.size);
          out.push({
            key: path,
            size: Number.isFinite(size) && size >= 0 ? size : null,
            updatedAt: item.updated_at ?? item.created_at ?? null,
          });
          if (out.length >= maxObjects) return;
        }
      }
    }
  };

  await walk(folder, 0);
  return out;
}

/** The extra covers stored with a policy live only inside its report_data. */
export function companionUrls(reportData: unknown): string[] {
  const list = (reportData as any)?.__companions;
  if (!Array.isArray(list)) return [];
  return list.map((c: any) => c?.pdf_url).filter((u: unknown): u is string => typeof u === "string" && u.length > 0);
}
