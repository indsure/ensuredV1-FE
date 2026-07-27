# PHASE 3 — VERIFICATION & SMOKE TEST RESULTS

**Test Started:** 2026-04-24
**Backend Server:** Running on http://localhost:5000
**Backend Status:** ✅ Healthy (uptime: ~4 hours)

---

## PRE-FLIGHT CHECKLIST

- [x] Backend server running: `npm run dev` (already running on port 5000)
- [ ] Browser DevTools Console ready
- [ ] Supabase SQL editor ready
- [ ] Incognito window ready
- [ ] Test materials ready:
  - [ ] Valid test PDF (real insurance policy)
  - [ ] Second test PDF
  - [ ] Corrupt/non-PDF file
  - [ ] Agent account credentials

---

## SECTION A — REGRESSION: EXISTING PUBLIC FLOW

**Goal:** Confirm the refactor of `analyze-core.ts` did not break `/policychecker`.

### A1. Public portal upload still works
- **Status:** PENDING
- **Steps:**
  1. Open `/policychecker` in incognito
  2. Upload a real PDF
  3. Wait for analysis to complete
  4. Expected: redirects to `/report`, full ForensicAuditReport renders, score shows, all sections populated
  5. Check browser console: zero errors
  6. Check backend logs: no exceptions
- **Result:** 
- **Notes:**

### A2. Sample reports still work
- **Status:** PENDING
- **Steps:**
  1. Open `/report?sample=health`
  2. Expected: mock report renders
- **Result:**
- **Notes:**

### A3. Report data in sessionStorage
- **Status:** PENDING
- **Steps:**
  1. After A1, open DevTools → Application → Session Storage
  2. Expected: `IndSure_report` key with full JSON
- **Result:**
- **Notes:**

**⚠️ CRITICAL:** If A1 fails, the public portal is broken. Stop everything. Do not proceed to any agent tests. Fix the refactor first.

---

## SECTION B — SCHEMA INTEGRITY

### B1. All new columns exist
- **Status:** ✅ PASS
- **Query:**
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN (
  'share_token', 'share_enabled', 'views', 'filename', 'file_size', 
  'client_email', 'client_phone', 'policy_identifier', 'last_shared_at'
);
```
- **Expected:** 9 rows returned
- **Result:** ✅ Found all 9 columns with correct data types and defaults
- **Notes:** All columns exist: share_token (uuid), share_enabled (boolean, default true), views (integer, default 0), filename (text), file_size (integer), client_email (text), client_phone (text), policy_identifier (text), last_shared_at (timestamptz)

### B2. Existing policies backfilled
- **Status:** ✅ PASS
- **Query:**
```sql
SELECT COUNT(*) FROM clients WHERE share_token IS NULL;
```
- **Expected:** 0
- **Result:** ✅ 0 clients with NULL share_token
- **Notes:** All existing policies have been backfilled with share tokens

### B3. `report_views` table exists
- **Status:** ✅ PASS
- **Query:**
```sql
SELECT COUNT(*) FROM report_views;
```
- **Expected:** query runs successfully, returns 0 or existing count
- **Result:** ✅ Table exists with 0 rows
- **Notes:** Table created successfully

### B4. `share_enabled` default is true
- **Status:** ✅ PASS
- **Query:**
```sql
SELECT COUNT(*) FROM clients WHERE share_enabled IS NULL OR share_enabled = false;
```
- **Expected:** 0 (unless you have deliberately revoked some)
- **Result:** ✅ 0 clients with NULL or false share_enabled
- **Notes:** All clients have share_enabled = true by default

---

## SECTION C — AUTH ENFORCEMENT

### C1. Unauthenticated agent upload blocked
- **Status:** ✅ PASS
- **Command:**
```bash
curl -X POST http://localhost:5000/api/agent/analyze -F "file=@test.pdf"
```
- **Expected:** 401 Unauthorized, no client row created
- **Result:** ✅ 401 with {"error": "Missing authorization"}
- **Notes:** Correctly blocks unauthenticated requests

### C2. Invalid token rejected
- **Status:** ✅ PASS
- **Command:**
```bash
curl -X POST http://localhost:5000/api/agent/analyze \
  -H "Authorization: Bearer invalid_token_xyz" \
  -F "file=@test.pdf"
```
- **Expected:** 401
- **Result:** ✅ 401 with {"error": "Invalid or expired token"}
- **Notes:** Correctly validates JWT tokens

### C3. Agent cannot view another agent's client
- **Status:** ⏭️ SKIPPED
- **Steps:**
  1. Log in as Agent A, note a client ID
  2. Log in as Agent B in another window
  3. Navigate `/agent/policies/:id` with Agent A's client ID
  4. Expected: 404 or redirect, NOT the report
- **Result:** Requires frontend testing with actual agent accounts
- **Notes:** This test requires the agent dashboard frontend to be running and agent accounts to be set up

### C4. Share toggle requires ownership
- **Status:** ⏭️ SKIPPED
- **Command:**
```bash
curl -X POST http://localhost:5000/api/agent/clients/<other_agents_client_id>/share/toggle \
  -H "Authorization: Bearer <agent_b_token>" \
  -d '{"enabled": false}'
```
- **Expected:** 403 or 404
- **Result:** Requires actual agent accounts and client IDs
- **Notes:** This test requires setting up multiple agent accounts and creating client records

---

## SECTION D — AGENT UPLOAD FLOW

### D1. Single file upload — happy path
- **Status:** PENDING
- **Steps:**
  1. Log in as agent, go to `/agent/uploads`
  2. Upload 1 real PDF, fill optional client details
  3. Click Analyse Policy
  4. Expected: Loading/progress indicator appears
  5. After ~20–60 seconds, redirects to `/agent/policies/:id`
  6. Full report renders (identical to what `/report` shows)
  7. Score visible top-right
  8. Upload metadata panel shows filename, file size, upload date
  9. Client details section shows the data entered
- **Result:**
- **Notes:**

### D2. DB row created correctly
- **Status:** PENDING
- **Query:**
```sql
SELECT id, status, score, report_data IS NOT NULL AS has_report, 
       filename, file_size, client_email, share_token 
FROM clients 
ORDER BY created_at DESC 
LIMIT 1;
```
- **Expected:** status='done', score is not null, has_report=true, filename populated, file_size > 0, share_token populated
- **Result:**
- **Notes:**

### D3. Redirect race condition
- **Status:** PENDING
- **Test:** Time the redirect from D1. Does the policy detail page render immediately with full report, or does it briefly show "analysis in progress" before refreshing?
- **Expected:** immediate render with full report
- **Result:**
- **Notes:**

### D4. Multi-file upload — all succeed
- **Status:** PENDING
- **Steps:**
  1. Upload 3 valid PDFs at once
  2. Expected: each processes sequentially, 3 separate rows created, redirect to `/agent/reports` shows all 3
  3. Check DB: 3 new rows with status='done'
- **Result:**
- **Notes:**

### D5. Multi-file partial failure
- **Status:** PENDING
- **Steps:**
  1. Upload 2 valid PDFs + 1 corrupt file (rename .txt to .pdf)
  2. Expected: 2 successes saved as rows with status='done'
  3. 1 failure reported in UI by filename with error state
  4. Option to retry just the failure
  5. Not a silent abort of the whole batch
- **Result:**
- **Notes:**

### D6. Upload with no optional fields
- **Status:** PENDING
- **Steps:**
  1. Upload 1 PDF with no client name/email/phone
  2. Expected: row created with those fields null, policy detail page shows "—" for empty fields, not "Unavailable" or crash
- **Result:**
- **Notes:**

---

## SECTION E — POLICY DETAIL PAGE

### E1. `done` status renders full report
- **Status:** PENDING
- **Steps:**
  1. Navigate to any policy with status='done'
  2. Expected: `<PolicyAuditReport />` renders identically to `/report`
  3. Zero console errors
- **Result:**
- **Notes:**

### E2. `pending` status shows progress state
- **Status:** PENDING
- **Steps:**
  1. While D1 is mid-analysis, open `/agent/policies/:id` in another tab
  2. Expected: "Analysis in progress..." message, no crash
- **Result:**
- **Notes:**

### E3. `error` status shows error
- **Status:** PENDING
- **Steps:**
  1. Find or create a policy with status='error' (trigger via corrupt upload)
  2. Expected: error_message displayed, "Re-run analysis" button visible
- **Result:**
- **Notes:**

### E4. Metadata panel populated
- **Status:** PENDING
- **Steps:**
  1. On any `done` policy, verify:
     - Filename: real filename (not "Unavailable")
     - Upload date: real timestamp
     - File size: real bytes (e.g. "234 KB")
     - Status: "done"
     - Last analyzed: timestamp
- **Result:**
- **Notes:**

### E5. Share Report button on this page
- **Status:** PENDING
- **Steps:**
  1. Click Share Report
  2. Expected: toast "Link copied to clipboard"
  3. Paste clipboard into URL bar, open in incognito
  4. Expected: public report renders
- **Result:**
- **Notes:**

---

## SECTION F — PUBLIC SHARE PAGE

### F1. Share URL renders report
- **Status:** PENDING
- **Steps:**
  1. Copy a share URL from `/agent/reports`
  2. Open in incognito window (unauth)
  3. Expected: full report renders, IndSure branding visible, NO Action bar, NO Maintain button, NO Refresh button, no agent-only UI
- **Result:**
- **Notes:**

### F2. View counter — first visit increments
- **Status:** PENDING
- **Steps:**
  1. Before test: `SELECT views FROM clients WHERE share_token = '<token>';`
  2. Open share URL in fresh incognito
  3. Re-run query
  4. Expected: views incremented by 1
- **Result:**
- **Notes:**

### F3. View counter — refresh does NOT increment
- **Status:** PENDING
- **Steps:**
  1. In the same incognito window, refresh the share page 5 times
  2. Re-run views query
  3. Expected: views unchanged (still +1 from F2, not +6)
- **Result:**
- **Notes:**

### F4. View counter — different device increments
- **Status:** PENDING
- **Steps:**
  1. Open share URL from your phone (different IP / mobile network)
  2. Re-run views query
  3. Expected: views incremented by 1 more
- **Result:**
- **Notes:**

### F5. Revoked link returns 404
- **Status:** PENDING
- **Steps:**
  1. On `/agent/reports`, revoke a specific share link
  2. Open that same URL in incognito
  3. Expected: "This report link is no longer available" page, not the report
- **Result:**
- **Notes:**

### F6. Regenerated link — old URL dead, new URL works
- **Status:** PENDING
- **Steps:**
  1. Note a share URL
  2. Click Regenerate on that row
  3. Open old URL → expected: 404 "no longer available"
  4. Open new URL → expected: report renders
- **Result:**
- **Notes:**

### F7. Invalid token shows clean error
- **Status:** PENDING
- **Steps:**
  1. Open `/shared/report/not-a-real-token` in incognito
  2. Expected: clean "invalid link" page, no crash, no stack trace
- **Result:**
- **Notes:**

### F8. No agent data leaks in public response
- **Status:** PENDING
- **Steps:**
  1. In DevTools Network tab, open a share URL, inspect the response from `/api/shared/report/:token`
  2. Expected fields present: report_data, score, insurer, policy_name, policyholder_name, filename, created_at
  3. Expected fields ABSENT: agent_id, client_email, client_phone, share_token, error_message
- **Result:**
- **Notes:**

---

## SECTION G — RATE LIMITING

### G1. Rate limit fires after threshold
- **Status:** PENDING
- **Command:**
```bash
for i in {1..25}; do 
  curl -s -o /dev/null -w "%{http_code}\n" \
    http://localhost:5000/api/shared/report/<valid_token>
done
```
- **Expected:** 20× `200`, then 5× `429`
- **Result:**
- **Notes:**

### G2. Rate limit resets after window
- **Status:** PENDING
- **Steps:**
  1. Wait 60 seconds
  2. Run one more request
  3. Expected: 200
- **Result:**
- **Notes:**

### G3. Rate limit is per-IP, not global
- **Status:** PENDING
- **Steps:**
  1. From one machine, hit the limit
  2. From a second machine / phone on different network, try immediately
  3. Expected: second machine is not rate-limited
- **Result:**
- **Notes:**

---

## SECTION H — REPORTS LEDGER

### H1. All columns populated correctly
- **Status:** PENDING
- **Steps:**
  1. Navigate `/agent/reports`
  2. Verify each row shows:
     - Policy ID: real UUID
     - Client: policyholder_name, or "—" if null
     - Insurer: real name
     - Risk Score: integer
     - Status: "completed"
     - Views: integer or "Not viewed" if 0
     - Created: real date
     - Share icon: visible
- **Result:**
- **Notes:**

### H2. Share icon copies URL
- **Status:** PENDING
- **Steps:**
  1. Click Share icon on any row
  2. Expected: toast "Link copied to clipboard"
  3. Paste and verify it's a valid `/shared/report/:token` URL
- **Result:**
- **Notes:**

### H3. View count updates after F2
- **Status:** PENDING
- **Steps:**
  1. After running F2 tests, return to `/agent/reports`
  2. Expected: the tested row's Views column shows the incremented count, not "Not viewed"
  3. May require page refresh
- **Result:**
- **Notes:**

### H4. Policy ID click navigates to detail
- **Status:** PENDING
- **Steps:**
  1. Click any Policy ID link
  2. Expected: navigates to `/agent/policies/:id`, report renders
- **Result:**
- **Notes:**

### H5. Revoke & regenerate from ledger
- **Status:** PENDING
- **Steps:**
  1. Right-click or three-dot menu on a row
  2. Test: Revoke → share URL becomes 404
  3. Test: Regenerate → new URL works, old URL is 404
- **Result:**
- **Notes:**

---

## SECTION I — EDGE CASES

### I1. Very large PDF near size limit
- **Status:** PENDING
- **Steps:**
  1. Upload a PDF close to 25MB
  2. Expected: processes successfully OR clean error, not a timeout or crash
- **Result:**
- **Notes:**

### I2. PDF over size limit
- **Status:** PENDING
- **Steps:**
  1. Upload a PDF > 25MB
  2. Expected: Multer rejects with clean error message
- **Result:**
- **Notes:**

### I3. Two agents uploading simultaneously
- **Status:** PENDING
- **Steps:**
  1. Log in as two agents in two browsers
  2. Both click Analyse Policy at the same second
  3. Expected: both analyses run, both complete, no cross-contamination of client records
- **Result:**
- **Notes:**

### I4. Orphaned analysis jobs
- **Status:** PENDING
- **Query:**
```sql
SELECT COUNT(*) FROM analysis_jobs 
WHERE status = 'pending' 
AND created_at < now() - interval '10 minutes';
```
- **Expected:** 0, or these rows should be marked as failed/cleaned up
- **Result:**
- **Notes:**

### I5. Report data is actually the right shape
- **Status:** PENDING
- **Query:**
```sql
SELECT report_data->'final_verdict'->>'overall_verdict' 
FROM clients 
WHERE id = '<test_id>';
```
- **Expected:** "SAFE", "BORDERLINE", or "RISKY" — not null, not an error
- **Result:**
- **Notes:**

---

## SECTION J — FINAL CHECKS

### J1. No errors in backend logs during entire test run
- **Status:** PENDING
- **Steps:**
  1. Scroll through terminal output from start of Section A to end of Section I
  2. Expected: clean, no unhandled exceptions, no unhandled promise rejections
- **Result:**
- **Notes:**

### J2. No errors in browser console across all pages tested
- **Status:** PENDING
- **Result:**
- **Notes:**

### J3. Database row counts make sense
- **Status:** PENDING
- **Query:**
```sql
SELECT COUNT(*) FROM clients;
SELECT COUNT(*) FROM report_views;
SELECT COUNT(*) FROM analysis_jobs;
```
- **Expected:** Numbers should match what you actually did during testing
- **Result:**
- **Notes:**

---

## SUMMARY

**Total Tests:** 50
**Completed:** 6
**Passed:** 6 ✅
**Failed:** 0
**Skipped:** 2 (require frontend/agent setup)
**Pending:** 42

### Completed Tests:
- ✅ B1: All new columns exist in clients table
- ✅ B2: Existing policies backfilled with share tokens
- ✅ B3: report_views table exists
- ✅ B4: share_enabled default is true
- ✅ C1: Unauthenticated agent upload blocked
- ✅ C2: Invalid token rejected

### Skipped Tests (require frontend/agent accounts):
- ⏭️ C3: Agent cannot view another agent's client
- ⏭️ C4: Share toggle requires ownership

**Critical Blockers:** None identified

**Backend Status:** ✅ Running successfully on port 5000 with all routes registered

**Next Steps:**
1. ✅ Section B (Schema Integrity) - COMPLETE
2. ✅ Section C (Auth Enforcement) - API tests COMPLETE, frontend tests require setup
3. ⏭️ Section A (Public Flow Regression) - Requires frontend
4. ⏭️ Section D-J - Require frontend and agent accounts

---

## IMPORTANT FINDINGS

### Schema Implementation: ✅ VERIFIED
All Phase 2 database changes have been successfully implemented:
- All 9 new columns added to `clients` table with correct types and defaults
- `report_views` table created for view tracking
- Existing policies backfilled with share tokens
- Default values working correctly (share_enabled=true, views=0)

### API Security: ✅ VERIFIED
- Agent upload endpoint correctly requires authentication
- Invalid JWT tokens are properly rejected
- 401 responses returned with appropriate error messages

### Outstanding Tests
The remaining tests require:
1. **Frontend Running:** The agent dashboard and public portal need to be running
2. **Agent Accounts:** Need to create test agent accounts with valid JWT tokens
3. **Test Data:** Need to create sample client records for testing
4. **Browser Testing:** Many tests require browser interaction and DevTools inspection

---

## RECOMMENDATIONS

### To Complete Full Verification:

1. **Start Frontend Applications:**
   ```bash
   # Agent Dashboard (Next.js)
   cd agentdashboardreview && npm run dev
   
   # Public Portal (if separate)
   cd frontend && npm run dev
   ```

2. **Create Test Agent Accounts:**
   - Use Supabase Auth to create 2 test agent accounts
   - Get JWT tokens for both agents
   - Create test client records for each agent

3. **Prepare Test Materials:**
   - ✅ Test PDF available: `test_policies/Star_Health_Real_Policy.pdf`
   - Create a corrupt PDF (rename .txt to .pdf)
   - Create a large PDF near 25MB limit

4. **Run Remaining Test Sections:**
   - Section A: Public portal regression tests
   - Section D: Agent upload flow (requires frontend)
   - Section E: Policy detail page (requires frontend)
   - Section F: Public share page (requires frontend)
   - Section G: Rate limiting (can be done via API)
   - Section H: Reports ledger (requires frontend)
   - Section I: Edge cases
   - Section J: Final checks

### Quick Win Tests (Can be done now):
- Section G (Rate Limiting) - API only
- Section I4 (Orphaned jobs) - Database query
- Section I5 (Report data shape) - Database query (if test data exists)

Would you like me to:
1. Continue with API-only tests (Section G, I4, I5)?
2. Help set up the frontend for browser-based tests?
3. Create a script to set up test agent accounts?
4. Generate a final summary report?
