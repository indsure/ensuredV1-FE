/** Reads a customer list from an Excel or CSV file. Indian dates: day first. */
import type { CustomerDraft } from "@/lib/customers";

export type ReadRow = { draft: CustomerDraft | null; badDob: boolean };

const HEADS: Record<string, string[]> = {
  name: ["name", "customername", "fullname", "clientname", "client", "customer", "policyholder", "policyholdername"],
  phone: ["phone", "mobile", "mobileno", "mobilenumber", "phoneno", "phonenumber", "contact", "contactno", "contactnumber", "whatsapp"],
  email: ["email", "emailid", "mail", "emailaddress"],
  city: ["city", "town", "location", "place"],
  dob: ["dob", "dateofbirth", "birthdate", "birthday"],
  notes: ["notes", "note", "remarks", "remark", "comments"],
};
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/** YYYY-MM-DD, or null when it cannot be read as one real past date. */
export function readDob(raw: unknown): string | null {
  let y = 0, m = 0, d = 0;
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    // Excel dates arrive as local midnight, give or take rounding.
    const x = new Date(raw.getTime() + 60_000);
    [y, m, d] = [x.getFullYear(), x.getMonth() + 1, x.getDate()];
  } else {
    const s = String(raw ?? "").trim();
    const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
    const ind = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/.exec(s);
    if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
    else if (ind) [d, m, y] = [+ind[1], +ind[2], +ind[3]];
    else return null;
  }
  const t = new Date(y, m - 1, d);
  if (y < 1900 || t.getFullYear() !== y || t.getMonth() !== m - 1 || t.getDate() !== d || t.getTime() > Date.now()) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function rowsToDrafts(table: unknown[][]): ReadRow[] {
  const headAt = table.findIndex((r) => r.some((c) => HEADS.name.includes(norm(c))));
  if (headAt < 0) return [];
  const col: Record<string, number> = {};
  table[headAt].forEach((c, i) => {
    for (const [k, names] of Object.entries(HEADS)) if (!(k in col) && names.includes(norm(c))) col[k] = i;
  });
  const out: ReadRow[] = [];
  for (const r of table.slice(headAt + 1)) {
    const cell = (k: string) => (col[k] === undefined ? "" : String(r[col[k]] ?? "").trim());
    if (!r.some((c) => String(c ?? "").trim())) continue;
    const name = cell("name");
    const rawDob = col.dob === undefined ? "" : r[col.dob];
    const dob = rawDob === "" || rawDob == null ? null : readDob(rawDob);
    // A phone column read as a number comes out as 9876543210 or 9.87e9; keep digits only.
    const phoneCell = col.phone === undefined ? "" : r[col.phone];
    const phone = typeof phoneCell === "number" ? String(Math.round(phoneCell)) : cell("phone");
    out.push({
      draft: name ? { name: name.slice(0, 160), phone, email: cell("email"), city: cell("city"), dob, notes: cell("notes") } : null,
      badDob: !!rawDob && !dob,
    });
  }
  return out;
}

export async function readCustomerRows(file: File): Promise<ReadRow[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error("The file is larger than 5 MB.");
  const XLSX = await import("xlsx");
  // raw keeps CSV text as typed: without it 05/06/1980 is read as 6 May.
  const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, raw: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  return rowsToDrafts(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][]).slice(0, 5000);
}
