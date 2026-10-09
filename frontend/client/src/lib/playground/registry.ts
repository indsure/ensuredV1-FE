// Holds the playground (demo) mock once it has been fetched. It lives apart from
// ../supabase so main.tsx can load the demo before the first render without
// statically pulling the Supabase SDK into the entry bundle.
type PlaygroundModule = typeof import("./mockClient");

let playground: PlaygroundModule | null = null;

export function getPlayground(): PlaygroundModule | null {
  return playground;
}

// The mock and its seed data are a separate chunk, so ordinary visitors never
// download the demo. main.tsx awaits this before the first render when the flag
// is already set, and PlaygroundEntry awaits it before turning the flag on, so
// no query can run against the real client while the mock is still on its way.
export async function loadPlayground(): Promise<void> {
  if (!playground) playground = await import("./mockClient");
  playground.installPlaygroundFetch();
}
