/**
 * Account export: which files go in, what they are called, and that the zip
 * opens.
 *
 * Run:
 *   npx tsx --test backend/server/tests/accountExport.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { exportReadme, planExportFiles, safeSegment } from "../services/accountExport";
import { crc32, createZipWriter } from "../services/zipStream";

const A = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-2222-4333-8444-555555555555";
const B = "policy-pdfs";
const url = (path: string, bucket = B) =>
  `https://x.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=abc`;

describe("planExportFiles (advisor)", () => {
  const data = {
    Customers: [{ id: "c1", name: "Ramesh Kumar" }],
    Leads: [{ id: "l1", name: "Sunita / Shah" }],
    Claims: [{ id: "k1", customer_id: "c1", created_at: "2026-11-02T10:00:00Z" }],
    Policies: [
      {
        id: "p1", policyholder_name: "Ramesh Kumar", insurer: "Star Health", pdf_url: url(`${A}/p1.pdf`),
        report_data: { __companions: [{ kind: "super_topup", pdf_url: url(`${A}/p1-super_topup.pdf`) }] },
      },
      // Same person and insurer: must not overwrite the first in the zip.
      { id: "p2", policyholder_name: "Ramesh Kumar", insurer: "Star Health", pdf_url: url(`${A}/p2.pdf`) },
      // Points at another account's file: never fetched.
      { id: "p3", policyholder_name: "X", pdf_url: url(`${OTHER}/p3.pdf`) },
      // Wrong bucket.
      { id: "p4", policyholder_name: "Y", pdf_url: url(`${A}/p4.pdf`, "public-stuff") },
      { id: "p5", policyholder_name: "No file", pdf_url: null },
    ],
    "Lead policies": [{ lead_id: "l1", file_url: url(`${A}/lead-policies/x.jpg`), file_name: "old policy.JPG" }],
    "Claim documents": [{ claim_id: "k1", storage_path: `${A}/claims/k1/case/d1.pdf`, filename: "discharge.pdf" }],
  };
  const listed = [
    `${A}/p1.pdf`, `${A}/p1-super_topup.pdf`, `${A}/p2.pdf`,
    `${A}/lead-policies/x.jpg`, `${A}/claims/k1/case/d1.pdf`,
    `${A}/advisor-page/lead9/orphan.pdf`,
  ];
  const plan = planExportFiles({ kind: "agent", accountId: A, bucket: B, data, listedKeys: listed });
  const byKey = new Map(plan.files.map((f) => [f.key, f.zipName]));

  it("names policies after the person and insurer", () => {
    assert.equal(byKey.get(`${A}/p1.pdf`), "policies/Ramesh Kumar - Star Health.pdf");
    assert.equal(byKey.get(`${A}/p2.pdf`), "policies/Ramesh Kumar - Star Health (2).pdf");
  });

  it("includes extra covers kept only inside report_data", () => {
    assert.equal(byKey.get(`${A}/p1-super_topup.pdf`), "policies/Ramesh Kumar - Star Health - super topup.pdf");
  });

  it("puts lead files under the lead, and claim files under the claim", () => {
    assert.equal(byKey.get(`${A}/lead-policies/x.jpg`), "leads/Sunita Shah/old policy.jpg");
    assert.equal(byKey.get(`${A}/claims/k1/case/d1.pdf`), "claims/Ramesh Kumar 2026-11-02/discharge.pdf");
  });

  it("still includes a stored file no row names", () => {
    assert.equal(byKey.get(`${A}/advisor-page/lead9/orphan.pdf`), "other-files/advisor-page/lead9/orphan.pdf");
  });

  it("never includes another account's file or another bucket", () => {
    assert.ok(![...byKey.keys()].some((k) => k.startsWith(OTHER)));
    assert.ok(!byKey.has(`${A}/p4.pdf`));
    assert.equal(plan.refused, 2);
    assert.equal(plan.files.length, 6);
  });

  it("ignores listed keys outside the account even if the listing returns them", () => {
    const p = planExportFiles({ kind: "agent", accountId: A, bucket: B, data: {}, listedKeys: [`${OTHER}/a.pdf`, `${A}/../x.pdf`] });
    assert.equal(p.files.length, 0);
  });
});

describe("planExportFiles (consumer)", () => {
  it("names a consumer policy by its nickname", () => {
    const p = planExportFiles({
      kind: "individual", accountId: A, bucket: B,
      data: { Policies: [{ nickname: "Papa health", filename: "scan.pdf", pdf_url: url(`${A}/q.pdf`) }] },
      listedKeys: [`${A}/q.pdf`],
    });
    assert.deepEqual(p.files, [{ key: `${A}/q.pdf`, zipName: "policies/Papa health.pdf" }]);
  });
});

describe("safeSegment", () => {
  it("strips characters Windows rejects and keeps Hindi", () => {
    assert.equal(safeSegment('a<b>c:"d"|e?*', "x"), "a b c d e");
    assert.equal(safeSegment("रमेश कुमार", "x"), "रमेश कुमार");
    assert.equal(safeSegment("  ...  ", "x"), "x");
    assert.equal(safeSegment("CON", "x"), "x");
  });
});

describe("zip writer", () => {
  /** Read every entry back out by walking the central directory, as unzip does. */
  function readZip(buf: Buffer) {
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    assert.ok(eocd >= 0, "end record present");
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const out: { name: string; data: Buffer }[] = [];
    for (let i = 0; i < count; i++) {
      assert.equal(buf.readUInt32LE(p), 0x02014b50);
      assert.equal(buf.readUInt16LE(p + 8) & 0x0800, 0x0800, "UTF-8 flag set");
      const crc = buf.readUInt32LE(p + 16);
      const size = buf.readUInt32LE(p + 24);
      const nlen = buf.readUInt16LE(p + 28);
      const off = buf.readUInt32LE(p + 42);
      const name = buf.subarray(p + 46, p + 46 + nlen).toString("utf8");
      assert.equal(buf.readUInt32LE(off), 0x04034b50);
      const lnlen = buf.readUInt16LE(off + 26);
      const data = buf.subarray(off + 30 + lnlen, off + 30 + lnlen + size);
      assert.equal(crc32(data), crc);
      out.push({ name, data });
      p += 46 + nlen;
    }
    return out;
  }

  it("writes files that read back byte for byte", async () => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(c));
    const zip = createZipWriter(stream);
    const pdf = Buffer.from("%PDF-1.4 hello");
    await zip.addFile("data.json", Buffer.from("{}"));
    await zip.addFile("policies/रमेश.pdf", pdf);
    await zip.finish();
    stream.end();
    const entries = readZip(Buffer.concat(chunks));
    assert.deepEqual(entries.map((e) => e.name), ["data.json", "policies/रमेश.pdf"]);
    assert.deepEqual(entries[1].data, pdf);
    assert.equal(zip.count, 2);
  });

  it("matches the standard CRC-32", () => {
    // The check value every CRC-32 implementation is tested with.
    assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  });

  it("refuses a file that would push the zip past 4 GB", () => {
    const zip = createZipWriter(new PassThrough());
    assert.equal(zip.canFit("a.pdf", 0xffffffff), false);
    assert.equal(zip.canFit("a.pdf", 1024), true);
  });
});

describe("exportReadme", () => {
  it("names files that could not be fetched", () => {
    const txt = exportReadme({ exportedAt: new Date("2026-11-28T00:00:00Z"), included: 3, missing: ["policies/a.pdf"], tooLarge: [] });
    assert.match(txt, /3 files/);
    assert.match(txt, /policies\/a\.pdf/);
    assert.ok(!txt.includes("—"), "no em dashes");
  });
});
