// Copies the portal's pure modules into the bot, byte for byte, so the bot runs the SAME code:
//   lib/draftMessage.ts            message templates (renewal reminders)
//   lib/health-engine-logic.ts     the cover calculator engine
//   lib/data/rider-data.ts         its rider table
//   lib/data/insurer-aliases.ts    partner-insurer name resolution
// The bot cannot import them in place on EC2 (the frontend is not deployed there).
// test/units.test.ts fails if any copy differs from the portal source: run `npm run sync`.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
export const SHARED = ["draftMessage.ts", "health-engine-logic.ts", "data/rider-data.ts", "data/insurer-aliases.ts", "city-tier-util.ts", "data/zones.ts", "policyValue.ts", "policyParams.ts"];
for (const rel of SHARED) {
  const src = path.resolve(here, "../../frontend/client/src/lib", rel);
  const dst = path.resolve(here, "../src/shared", rel);
  mkdirSync(path.dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  console.log("synced", rel);
}
