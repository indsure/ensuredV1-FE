import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { INSURER_CONFIG } from "./insurer-config";

function splitSelectors(selectorList: string): string[] {
  return selectorList
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function selectorExists(page: Page, selector: string): Promise<boolean> {
  try {
    const el = await page.$(selector);
    return !!el;
  } catch {
    return false;
  }
}

async function waitForAnySelector(
  page: Page,
  selectors: string[],
  timeoutMs: number,
  initialUrl?: string
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // Heuristic: if the page navigated away from a login URL, treat as "logged in".
    try {
      const urlNow = page.url();
      const init = initialUrl ?? "";
      if (init && urlNow !== init && !/login|signin/i.test(urlNow)) return;
    } catch {}

    for (const sel of selectors) {
      if (await selectorExists(page, sel)) return;
    }
    await page.waitForTimeout(2000);
  }
  throw new Error("LOGIN_TIMEOUT");
}

function updateInsurerConfigFile(insurerKey: string, updates: { loginDetector: string; downloadSelector: string }) {
  const filePath = path.resolve(__dirname, "insurer-config.ts");
  const raw = fs.readFileSync(filePath, "utf-8");

  // Replace fields only within the target insurer object's braces.
  const startIdx = raw.indexOf(`${insurerKey}: {`);
  if (startIdx === -1) throw new Error(`Could not find insurer key block: ${insurerKey}`);

  const sliceFrom = raw.slice(startIdx);
  const endRel = sliceFrom.indexOf("},", sliceFrom.indexOf(`${insurerKey}: {`));
  if (endRel === -1) throw new Error(`Could not find end of insurer block: ${insurerKey}`);

  const before = raw.slice(0, startIdx);
  const block = sliceFrom.slice(0, endRel + 2); // include "},"
  const after = sliceFrom.slice(endRel + 2);

  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const nextBlock = block
    .replace(/loginDetector\s*:\s*'[^']*'\s*,/m, `loginDetector: '${esc(updates.loginDetector)}',`)
    .replace(/downloadSelector\s*:\s*'[^']*'\s*,/m, `downloadSelector: '${esc(updates.downloadSelector)}',`);

  const next = `${before}${nextBlock}${after}`;

  fs.writeFileSync(filePath, next, "utf-8");
}

async function main() {
  const insurerKey = process.argv[2];
  const portalUrl = process.argv[3];
  if (!insurerKey || !portalUrl) {
    // eslint-disable-next-line no-console
    console.error("Usage: npx ts-node src/services/detect-selectors.ts <insurerKey> <portalUrl>");
    process.exit(1);
  }

  const config = INSURER_CONFIG[insurerKey];
  if (!config) {
    throw new Error(`Insurer ${insurerKey} not configured`);
  }

  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: null,
    acceptDownloads: true,
  });

  const page = await context.newPage();

  try {
    // eslint-disable-next-line no-console
    console.log("[detect] Navigating:", portalUrl);
    await page.goto(portalUrl, { waitUntil: "domcontentloaded" });
    const initialUrl = page.url();

    const loginCandidates = splitSelectors(config.loginDetector);
    // eslint-disable-next-line no-console
    console.log("[detect] Waiting for login. Candidates:", loginCandidates);

    await waitForAnySelector(page, loginCandidates, 360_000, initialUrl);

    // After login, keep only selectors that actually exist.
    const loginDetected: string[] = [];
    for (const sel of loginCandidates) {
      if (await selectorExists(page, sel)) loginDetected.push(sel);
    }

    // Navigate to policy page, then validate download selectors.
    const policyUrl = `${portalUrl.replace(/\/$/, "")}${config.policyPagePath}`;
    // eslint-disable-next-line no-console
    console.log("[detect] Login detected. Navigating policy page:", policyUrl);
    await page.goto(policyUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const downloadCandidates = splitSelectors(config.downloadSelector);
    const downloadDetected: string[] = [];
    for (const sel of downloadCandidates) {
      if (await selectorExists(page, sel)) downloadDetected.push(sel);
    }

    const newLoginDetector = (loginDetected.length ? loginDetected : loginCandidates).join(", ");
    const newDownloadSelector = (downloadDetected.length ? downloadDetected : downloadCandidates).join(", ");

    // eslint-disable-next-line no-console
    console.log("[detect] Updating insurer-config.ts", {
      insurerKey,
      loginDetector: newLoginDetector,
      downloadSelector: newDownloadSelector,
    });

    updateInsurerConfigFile(insurerKey, {
      loginDetector: newLoginDetector,
      downloadSelector: newDownloadSelector,
    });

    // eslint-disable-next-line no-console
    console.log("[detect] Done.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[detect] Error:", err?.message || err);
  process.exit(1);
});

