// The Supabase SDK (~170 KB) is not needed to paint any public page, so code
// that runs on every page (API helpers, the analytics identity sync) reaches it
// through this async getter instead of a static import. That keeps it out of
// the entry bundle: it is fetched the first time something actually asks for a
// session. Pages that are themselves lazy chunks keep importing `supabase`
// from ./supabase directly.
export function getSupabase() {
  return import("./supabase").then((m) => m.supabase);
}
