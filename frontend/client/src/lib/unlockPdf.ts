/**
 * Opens a locked PDF on the device, before anything is uploaded. The password
 * is never sent: what goes to the server is an unlocked copy.
 *
 * A file that only restricts printing or copying opens without a password, so
 * it is left exactly as it is.
 */

/** Cheap test: does the file mention encryption at all? Most never reach the library. */
async function mentionsEncryption(file: File): Promise<boolean> {
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return false;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const needle = [47, 69, 110, 99, 114, 121, 112, 116]; // "/Encrypt"
  outer: for (let i = bytes.length - needle.length; i >= 0; i--) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

const load = async (file: File, password: string) => {
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  return PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { password });
};

/** True only when the file cannot be opened without a password. */
export async function needsPassword(file: File): Promise<boolean> {
  try {
    if (!(await mentionsEncryption(file))) return false;
    await load(file, "");
    return false;
  } catch (e: any) {
    // Anything else wrong with the file is the server's to report, as before.
    return /password/i.test(String(e?.message));
  }
}

/** The unlocked copy, or null when the password is wrong. */
export async function unlockPdf(file: File, password: string): Promise<File | null> {
  let doc;
  try {
    doc = await load(file, password);
  } catch (e: any) {
    if (/password/i.test(String(e?.message))) return null;
    throw e;
  }
  const bytes = await doc.save();
  return new File([bytes as unknown as BlobPart], file.name, { type: "application/pdf" });
}
