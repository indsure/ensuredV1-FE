/**
 * A small zip writer that streams straight into an HTTP response.
 *
 * WHY HAND-WRITTEN AND NOT A LIBRARY: the export only ever needs "put these
 * files in a folder people can open". Policy PDFs and scans are already
 * compressed, so the STORE method (no compression) costs almost nothing in size
 * and removes the only hard part of the format. What is left is a few fixed
 * headers and a CRC, which is less risk than a new dependency that has to be
 * installed on the server by hand at deploy time.
 *
 * Each file is written as soon as it is added and then forgotten, so memory
 * holds one file at a time no matter how large the account is. The caller
 * awaits addFile(), which waits for the socket to drain before returning.
 *
 * LIMITS, enforced rather than hoped for: no zip64, so the archive stops at
 * 65,535 entries and just under 4 GB. canFit() says whether one more file fits;
 * past that the caller must leave the file out and say so, because writing it
 * would produce a zip that Windows reports as damaged.
 */

import type { Writable } from "node:stream";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, the only clock the base zip format has. */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | (Math.floor(d.getSeconds() / 2) & 31),
    date: (((year - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
  };
}

const MAX_ENTRIES = 0xffff;
const MAX_OFFSET = 0xffffffff;
/** Bit 11: names are UTF-8. Without it, a Hindi filename comes out as noise. */
const FLAG_UTF8 = 0x0800;

interface Entry {
  name: Buffer;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

export interface ZipWriter {
  /** True if a file of this many bytes, with this name, can still be added. */
  canFit(name: string, size: number): boolean;
  addFile(name: string, data: Uint8Array, modified?: Date): Promise<void>;
  /** Writes the central directory. The zip is unreadable until this runs. */
  finish(): Promise<void>;
  readonly count: number;
}

export function createZipWriter(out: Writable): ZipWriter {
  const entries: Entry[] = [];
  let offset = 0;

  const write = (chunk: Buffer) =>
    new Promise<void>((resolve, reject) => {
      if (out.destroyed) return reject(new Error("STREAM_CLOSED"));
      offset += chunk.length;
      if (out.write(chunk)) return resolve();
      const onDrain = () => { cleanup(); resolve(); };
      const onClose = () => { cleanup(); reject(new Error("STREAM_CLOSED")); };
      const cleanup = () => { out.off("drain", onDrain); out.off("close", onClose); };
      out.once("drain", onDrain);
      out.once("close", onClose);
    });

  // Room kept back for the central directory and end record, so the last file
  // added can never push those past the 4 GB offset limit.
  const directoryBytes = (extraName = 0) =>
    entries.reduce((n, e) => n + 46 + e.name.length, 0) + (extraName ? 46 + extraName : 0) + 22;

  return {
    get count() { return entries.length; },

    canFit(name, size) {
      const n = Buffer.byteLength(name, "utf8");
      if (entries.length + 1 > MAX_ENTRIES) return false;
      return offset + 30 + n + size + directoryBytes(n) <= MAX_OFFSET;
    },

    async addFile(name, data, modified = new Date()) {
      const nameBuf = Buffer.from(name, "utf8");
      if (!this.canFit(name, data.length)) throw new Error("ZIP_FULL");
      const crc = crc32(data);
      const { time, date } = dosDateTime(modified);
      const start = offset;

      const h = Buffer.alloc(30);
      h.writeUInt32LE(0x04034b50, 0);
      h.writeUInt16LE(20, 4);          // version needed
      h.writeUInt16LE(FLAG_UTF8, 6);
      h.writeUInt16LE(0, 8);           // method: STORE
      h.writeUInt16LE(time, 10);
      h.writeUInt16LE(date, 12);
      h.writeUInt32LE(crc, 14);
      h.writeUInt32LE(data.length, 18); // compressed size
      h.writeUInt32LE(data.length, 22); // uncompressed size
      h.writeUInt16LE(nameBuf.length, 26);
      h.writeUInt16LE(0, 28);          // extra length

      await write(Buffer.concat([h, nameBuf]));
      await write(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
      entries.push({ name: nameBuf, crc, size: data.length, offset: start, time, date });
    },

    async finish() {
      const dirStart = offset;
      const parts: Buffer[] = [];
      for (const e of entries) {
        const c = Buffer.alloc(46);
        c.writeUInt32LE(0x02014b50, 0);
        c.writeUInt16LE(20, 4);        // version made by
        c.writeUInt16LE(20, 6);        // version needed
        c.writeUInt16LE(FLAG_UTF8, 8);
        c.writeUInt16LE(0, 10);
        c.writeUInt16LE(e.time, 12);
        c.writeUInt16LE(e.date, 14);
        c.writeUInt32LE(e.crc, 16);
        c.writeUInt32LE(e.size, 20);
        c.writeUInt32LE(e.size, 24);
        c.writeUInt16LE(e.name.length, 28);
        // extra, comment, disk start, internal attrs: all zero
        c.writeUInt32LE(0, 38);        // external attrs
        c.writeUInt32LE(e.offset, 42);
        parts.push(c, e.name);
      }
      const dir = Buffer.concat(parts);
      const end = Buffer.alloc(22);
      end.writeUInt32LE(0x06054b50, 0);
      end.writeUInt16LE(entries.length, 8);
      end.writeUInt16LE(entries.length, 10);
      end.writeUInt32LE(dir.length, 12);
      end.writeUInt32LE(dirStart, 16);
      await write(Buffer.concat([dir, end]));
    },
  };
}
