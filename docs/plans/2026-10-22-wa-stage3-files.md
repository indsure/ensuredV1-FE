# WhatsApp stage 3: files (2026-10-22)

Founder decision already given: claim documents over WhatsApp are approved. WhatsApp never deletes.
Advisors are 40+ and send photos of bills more often than PDFs.

## 1. Scope (from the 113-action spec)

| Spec | Action | In this stage |
|---|---|---|
| 7.8 | Put claim documents into the claim (photo or PDF): Aadhaar, PAN, e-card, cheque, bills, discharge summary, forms, reports, or a custom name. Starts the 30-day document clock, as the portal does. | yes |
| 7.6 | A reply document for an insurer query round (the file is linked to the open round) | yes; marking the round answered stays the stage 2c command |
| 7.10 | Get a claim document back in the chat (download) | yes; rename and delete stay in the portal |
| 2.9 | Get the original policy PDF back in the chat | yes |
| 2.15 | The whole book as Excel | **later**: needs an xlsx library in the bot or backend (only the frontend has one). A CSV would avoid it; founder call, not in this stage |
| 5.8, 9.2, 12.3, 14.4 | Lead-policy files, compare two wordings, profile photo, data export | not in this stage (bigger, or stage 4) |

Out on purpose: outcome documents (settlement or rejection letter) belong to closing a claim, which
stays in the portal. Removing a document stays in the portal.

## 2. How the advisor does it

**Putting documents in (a "document session").** A file sent on its own is still a policy check,
as today; a photo on its own still gets "send the PDF". So a claim document needs one of:
- a caption that names the claim: a photo with "final bill for Sunita's claim" or "Sunita claim aadhaar";
- or a session: "add documents to Sunita's claim" (also "Sunita ke claim ke documents"). The bot
  confirms once: "Files you send in the next 15 minutes go into Sunita Rao's claim. Name each one
  in its caption, like 'final bill'. YES to start." After YES each file is saved as it arrives,
  with a one-line reply. DONE, CANCEL or 15 minutes of silence ends the session.

A file with a caption that names the claim is confirmed on its own ("Add 'Final bill' (photo,
240 KB) to Sunita Rao's claim? YES"); its bytes are held in memory until YES (15 minutes, then dropped).

**Naming.** The caption is matched to the portal's checklist (lib/claims.ts PERSONAL_DOCS and
CASE_DOCS for that claim type; "aadhaar", "pan", "cheque", "bill", "final bill", "discharge
summary", "claim form", "prescription", "report"...). A match uses the portal's exact label and
category (personal or case). No match: the caption itself becomes a custom label in category case.
No caption inside a session: the bot asks "What is this? For example: final bill" before saving.
A caption with "query" or "reply" is linked to the claim's open query round (the latest one if
several); the bot then says how to mark the round answered (stage 2c command).

**Getting files back.** "send Ramesh's policy PDF", "Ramesh ki policy bhejo", "send the PDF" (the
policy we are on); "send Sunita's claim documents" (numbered list, pick one or ALL, at most 10),
"send Sunita's final bill". Sent only to the advisor's own linked number, as a WhatsApp document.

## 3. Server (whatsapp/edits.ts only; routes.ts untouched)

- `POST /api/internal/wa/claims/:id/documents`, multipart (multer, 25 MB like the portal):
  file + docType + category (personal|case only) + queryId (optional, must be an open round of this
  claim). Same steps as the portal route: refuse a purged claim and a closed claim; store at
  `{agentId}/claims/{claimId}/{category}/{docId}.{ext}` in the policy-pdfs bucket; insert the row;
  start the clock once (retention_started_at, purge_at = now() + 30 days) in the same guarded
  UPDATE; claim event; audit row `whatsapp-bot`. Only pdf, jpeg, png, webp, heic accepted.
- `GET /api/internal/wa/claims/:id/documents` (list: id, label, category, uploaded on).
- `GET /api/internal/wa/claims/:id/documents/:docId/file` and `GET /api/internal/wa/clients/:id/pdf`:
  stream the bytes (as the portal's download-pdf does), with the access audit row
  (claim_doc_download / download_pdf, user_agent whatsapp-bot).
- Storage client: edits.ts creates its own supabase client from the same env as routes.ts
  (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY); multer from backend/node_modules (already there).

## 4. Bot

- Transport: `sendDocument(to, buffer, fileName, mimeType, caption)` (Baileys sendMessage document).
- Inbound images and documents check, in order: an open document session for this advisor; a
  caption that names a claim; otherwise today's flow (policy check / "send the PDF").
- Intents: claimdocs (start a session), claimdocsend, policypdf. Parser in claimParse.ts / a new
  fileParse.ts. All lines in Hindi and Hinglish.

## 5. Undo and safety

No undo for a saved document (the founder rule allows removal only of a lead, customer or claim
this chat created). Every confirm says: "To remove a file, use the portal." A document is never
saved without a YES (per file, or once for the session). Nothing is ever deleted from WhatsApp.

## 6. Deploy

Same as stage 2b-2d: swap edits.ts (+ editRules.ts), unit tests and import check on the server
before the one restart; smoke test that writes nothing (the upload route with a made-up claim id
returns 404 before storing anything); then the bot.

## 7. Critique and decisions (2026-10-22)

Founder: UNDO may remove a file this chat saved in the last 15 minutes (own files only, like a
lead, customer or claim this chat created). Whole-book export over WhatsApp: not now.

Changed after the plan critique:
- Upload is atomic: the file is stored, then the row and the clock go in ONE transaction; any
  failure removes the stored object. The document id comes from the WhatsApp message id, so a
  resend or retry never makes a second copy (insert ON CONFLICT DO NOTHING).
- Multer memoryStorage (25 MB) on the internal route: nothing on the server disk.
- No claim event on upload and no "closed claim" refusal: the portal has neither (a purged claim
  is refused for working documents, as in the portal).
- A caption must say "claim" (or क्लेम) to name a claim; a name alone stays a policy caption.
- The claim is pinned when chosen and named in full in every confirm (person, insurer, type,
  admission date), with the date its documents will be deleted.
- Several photos (an album, or photos in a row): queued per advisor (at most 10 files, 40 MB),
  one YES for all. Inside a session a PDF that looks like a policy is asked about, not saved; any
  other text ends the session.
- Labels are the portal's checklist labels exactly (lib/claims.ts, with a test that compares).
  Photos get a file name from their label and type ("final-bill.jpg"). HEIC is refused ("send it
  as a photo"). Audit names are the portal's; only user_agent differs.
- Files sent back carry a caption: whose and what, and "Deleted from IndSure on <date>. Delete
  from this chat after use." Sending several identity documents asks first.
