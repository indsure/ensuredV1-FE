import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { INSURER_CONFIG } from './insurer-config';
import * as fs from 'fs';
import * as path from 'path';

const DOWNLOAD_DIR = path.resolve('./downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

export async function runPolicyDownloadSession(
  insurerKey: string,
  sessionId: string,
  onStatus: (status: string, data?: any) => void
): Promise<string | null> {
  const config = INSURER_CONFIG[insurerKey];
  if (!config) throw new Error(`Insurer ${insurerKey} not configured`);

  const browser: Browser = await chromium.launch({
    headless: false,           // User needs to see and interact
    args: ['--start-maximized'],
  });

  const context: BrowserContext = await browser.newContext({
    acceptDownloads: true,
    viewport: null,
  });

  const page: Page = await context.newPage();

  try {
    onStatus('NAVIGATING', { url: config.portalUrl });
    await page.goto(config.portalUrl, { waitUntil: 'domcontentloaded' });

    onStatus('AWAITING_LOGIN');

    // Poll every 2s to detect login success (up to 3 minutes)
    const loginDetected = await waitForLogin(page, config.loginDetector, 180000);
    if (!loginDetected) {
      onStatus('LOGIN_TIMEOUT');
      await browser.close();
      return null;
    }

    onStatus('LOGIN_SUCCESS');

    // Navigate to policy page
    const policyUrl = `${config.portalUrl.replace(/\/$/, '')}${config.policyPagePath}`;
    await page.goto(policyUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    onStatus('TRIGGERING_DOWNLOAD');

    // Wait for and click download
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click(config.downloadSelector),
    ]);

    const filename = download.suggestedFilename() || `policy-${sessionId}.pdf`;
    const savePath = path.join(DOWNLOAD_DIR, `${sessionId}-${filename}`);
    await download.saveAs(savePath);

    onStatus('DOWNLOAD_COMPLETE', { filename, savePath });

    await browser.close();
    return savePath;

  } catch (err: any) {
    onStatus('ERROR', { message: err.message });
    await browser.close();
    return null;
  }
}

async function waitForLogin(
  page: Page,
  selector: string,
  timeout: number
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const el = await page.$(selector);
      if (el) return true;
    } catch (_) {}
    await page.waitForTimeout(2000);
  }
  return false;
}

