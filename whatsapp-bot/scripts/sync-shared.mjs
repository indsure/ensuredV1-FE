// Copies the portal's pure message-template module into the bot, byte for byte.
// The bot cannot import it in place on EC2 (its date-fns import would resolve against a
// frontend node_modules that is not deployed there). test/shared.test.ts fails if the copy
// and the portal source ever differ, so the two can never drift silently.
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../../frontend/client/src/lib/draftMessage.ts");
const dst = path.resolve(here, "../src/shared/draftMessage.ts");
copyFileSync(src, dst);
console.log("synced", path.relative(process.cwd(), dst));
