import type { Request, Response } from "express";

export function handlePdfTest(req: Request, res: Response) {
  console.log("[PDF] Test endpoint hit");
  res.json({ status: "PDF endpoint is registered and working" });
}

export async function handleGeneratePdf(req: Request, res: Response) {
  console.log("[PDF] POST /api/generate-pdf endpoint hit");
  try {
    let { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Ensure URL is absolute
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      const protocol = req.protocol;
      const host = req.get("host");
      url = `${protocol}://${host}${url}`;
    }

    console.log("[PDF] Generating PDF from URL:", url);

    const { chromium } = await import("playwright");

    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      await page.setViewportSize({ width: 1200, height: 1600 });

      console.log("[PDF] Navigating to URL...");
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      console.log("[PDF] Waiting for fonts...");
      await page.evaluate(() => {
        return document.fonts.ready;
      });

      console.log("[PDF] Waiting for DOM content...");
      await page.waitForLoadState("domcontentloaded");

      console.log("[PDF] Waiting for layout to stabilize...");
      await page.waitForTimeout(2000);

      console.log("[PDF] Generating PDF...");
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "1cm",
          right: "1cm",
          bottom: "1cm",
          left: "1cm",
        },
        preferCSSPageSize: false,
        scale: 0.8,
        displayHeaderFooter: false,
      });

      await browser.close();
      browser = null;

      console.log(
        "[PDF] PDF generated successfully, size:",
        pdfBuffer.length,
        "bytes"
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ensured-report.pdf"`
      );
      res.send(pdfBuffer);
    } catch (browserError: any) {
      if (browser) {
        await browser.close().catch(() => {});
      }
      throw browserError;
    }
  } catch (error: any) {
    console.error("[PDF] PDF generation error:", error);
    console.error("[PDF] Error stack:", error.stack);
    res.status(500).json({
      error: error.message || "PDF generation failed",
      details:
        process.env.NODE_ENV === "development"
          ? error.stack
          : undefined,
    });
  }
}
