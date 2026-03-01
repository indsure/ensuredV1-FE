import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { createServer } from "http";
import fs from "fs";
import path from "path";
import app from "./app";
import { APP_CONFIG } from "./src/config";

/* ---------------- UPLOAD DIRECTORY CLEANUP ---------------- */

function cleanupUploadsDirectory() {
  const uploadsDir = path.resolve(import.meta.dirname, "uploads");

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    return;
  }

  try {
    const files = fs.readdirSync(uploadsDir);
    const now = Date.now();

    let cleaned = 0;
    files.forEach((file) => {
      const filePath = path.join(uploadsDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > APP_CONFIG.uploadsMaxAge) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch {}
    });

    if (cleaned > 0) {
      console.log(
        `Cleaned up ${cleaned} old file(s) from uploads directory`
      );
    }
  } catch (err) {
    console.error("Failed to cleanup uploads directory:", err);
  }
}

cleanupUploadsDirectory();
setInterval(cleanupUploadsDirectory, 60 * 60 * 1000);

/* ---------------- SERVER BOOTSTRAP ---------------- */

const server = createServer(app);

const port = APP_CONFIG.port;

server.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
