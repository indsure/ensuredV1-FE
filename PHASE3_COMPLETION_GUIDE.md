# Phase 3 Completion Guide

This guide will help you complete the remaining 38 frontend-dependent tests.

---

## Prerequisites

### 1. Start Backend Server (Already Running)
```bash
# Backend is already running on port 5000
# If you need to restart:
npm run dev
```

### 2. Start Agent Dashboard
```bash
cd agentdashboardreview
npm install  # if not already done
npm run dev
```

**Expected Output:**
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### 3. Start Public Portal (if separate)
```bash
cd frontend
npm install  # if not already done
npm run dev
```

Check `frontend/package.json` for the actual dev command and port.

### 4. Create Test Agent Accounts

**Option A: Via Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Navigate to Authentication → Users
3. Create 2 test users:
   - agent1@test.com / password123
   - agent2@test.com / password123

**Option B: Via SQL**
```sql
-- This requires Supabase Auth setup
-- Use Supabase Dashboard instead for easier setup
```

### 5. Get JWT Tokens

After logging in as an agent in the browser:
1. Open DevTools → Application → Local Storage
2. Look for Supabase auth token
3. Copy the JWT token for API testing

---

## Test Execution Order

### Phase 1: Public Portal Tests (Section A)

**Start Here:** These tests verify the public-facing functionality hasn't broken.

#### A1. Public Portal Upload
1. Open http://localhost:5173/policychecker (or your public portal URL) in **incognito**
2. Upload `test_policies/Star_Health_Real_Policy.pdf`
3. Wait for analysis (20-60 seconds)
4. **Verify:**
   - ✅ Redirects to `/report`
   - ✅ Full report renders with score
   - ✅ All sections populated
   - ✅ Browser console: zero errors
   - ✅ Backend logs: no exceptions

#### A2. Sample Reports
1. Open http://localhost:5173/report?sample=health
2. **Verify:**
   - ✅ Mock report renders

#### A3. SessionStorage
1. After A1, open DevTools → Application → Session Storage
2. **Verify:**
   - ✅ `IndSure_report` key exists with full JSON

**⚠️ CRITICAL:** If A1 fails, stop and fix before proceeding.

---

### Phase 2: Agent Upload Flow (Section D)

**Prerequisites:** Agent account logged in

#### D1. Single File Upload — Happy Path
1. Log in as agent1@test.com
2. Navigate to `/agent/uploads` (or upload page)
3. Upload `test_policies/Star_Health_Real_Policy.pdf`
4. Fill in optional fields:
   - Client Name: "Test Client"
   - Email: "client@test.com"
   - Phone: "9876543210"
   - Policy ID: "TEST-001"
5. Click "Analyse Policy"
6. **Verify:**
   - ✅ Loading indicator appears
   - ✅ After 20-60s, redirects to `/agent/policies/:id`
   - ✅ Full report renders
   - ✅ Score visible
   - ✅ Metadata panel shows filename, size, date
   - ✅ Client details show entered data

#### D2. DB Row Created
After D1, run:
```bash
cd backend
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT id, status, score, report_data IS NOT NULL AS has_report, filename, file_size, client_email, share_token FROM clients ORDER BY created_at DESC LIMIT 1')
  .then(r => { console.log(r.rows[0]); pool.end(); });
"
```

**Verify:**
- ✅ status='done'
- ✅ score is not null
- ✅ has_report=true
- ✅ filename populated
- ✅ file_size > 0
- ✅ share_token populated

#### D3. Redirect Race Condition
- **Observe:** Does the policy detail page render immediately with full report?
- **Or:** Does it briefly show "analysis in progress" before refreshing?
- **Expected:** Immediate render with full report

#### D4. Multi-File Upload
1. Upload 3 valid PDFs at once
2. **Verify:**
   - ✅ Each processes sequentially
   - ✅ 3 separate rows created
   - ✅ Redirect to `/agent/reports` shows all 3

#### D5. Multi-File Partial Failure
1. Create a corrupt PDF: `echo "not a pdf" > corrupt.pdf`
2. Upload 2 valid PDFs + corrupt.pdf
3. **Verify:**
   - ✅ 2 successes with status='done'
   - ✅ 1 failure reported in UI with filename
   - ✅ Option to retry the failure
   - ✅ Not a silent abort

#### D6. Upload with No Optional Fields
1. Upload 1 PDF with no client details
2. **Verify:**
   - ✅ Row created with null fields
   - ✅ Policy detail page shows "—" for empty fields
   - ✅ No crash or "Unavailable" text

---

### Phase 3: Policy Detail Page (Section E)

#### E1. Done Status Renders Full Report
1. Navigate to any policy with status='done'
2. **Verify:**
   - ✅ Full report renders (identical to `/report`)
   - ✅ Zero console errors

#### E2. Pending Status Shows Progress
1. While D1 is mid-analysis, open `/agent/policies/:id` in another tab
2. **Verify:**
   - ✅ "Analysis in progress..." message
   - ✅ No crash

#### E3. Error Status Shows Error
1. Find or create a policy with status='error'
2. **Verify:**
   - ✅ error_message displayed
   - ✅ "Re-run analysis" button visible

#### E4. Metadata Panel Populated
1. On any `done` policy, verify:
   - ✅ Filename: real filename
   - ✅ Upload date: real timestamp
   - ✅ File size: real bytes (e.g. "234 KB")
   - ✅ Status: "done"
   - ✅ Last analyzed: timestamp

#### E5. Share Report Button
1. Click "Share Report"
2. **Verify:**
   - ✅ Toast: "Link copied to clipboard"
3. Paste clipboard into URL bar, open in incognito
4. **Verify:**
   - ✅ Public report renders

---

### Phase 4: Public Share Page (Section F)

#### F1. Share URL Renders Report
1. Copy a share URL from `/agent/reports`
2. Open in incognito window
3. **Verify:**
   - ✅ Full report renders
   - ✅ IndSure branding visible
   - ✅ NO Action bar
   - ✅ NO Maintain button
   - ✅ NO Refresh button
   - ✅ No agent-only UI

#### F2. View Counter — First Visit Increments
1. Before test:
   ```sql
   SELECT views FROM clients WHERE share_token = '<token>';
   ```
2. Open share URL in fresh incognito
3. Re-run query
4. **Verify:**
   - ✅ views incremented by 1

#### F3. View Counter — Refresh Does NOT Increment
1. In same incognito window, refresh 5 times
2. Re-run views query
3. **Verify:**
   - ✅ views unchanged (still +1 from F2, not +6)

#### F4. View Counter — Different Device Increments
1. Open share URL from phone (different IP)
2. Re-run views query
3. **Verify:**
   - ✅ views incremented by 1 more

#### F5. Revoked Link Returns 404
1. On `/agent/reports`, revoke a share link
2. Open that URL in incognito
3. **Verify:**
   - ✅ "This report link is no longer available" page

#### F6. Regenerated Link
1. Note a share URL
2. Click "Regenerate" on that row
3. Open old URL
4. **Verify:**
   - ✅ 404 "no longer available"
5. Open new URL
6. **Verify:**
   - ✅ Report renders

#### F7. Invalid Token Shows Clean Error
1. Open `/shared/report/not-a-real-token` in incognito
2. **Verify:**
   - ✅ Clean "invalid link" page
   - ✅ No crash
   - ✅ No stack trace

#### F8. No Agent Data Leaks
1. In DevTools Network tab, open a share URL
2. Inspect response from `/api/shared/report/:token`
3. **Verify Present:**
   - ✅ report_data
   - ✅ score
   - ✅ insurer
   - ✅ policy_name
   - ✅ policyholder_name
   - ✅ filename
   - ✅ created_at
4. **Verify ABSENT:**
   - ✅ agent_id
   - ✅ client_email
   - ✅ client_phone
   - ✅ share_token
   - ✅ error_message

---

### Phase 5: Reports Ledger (Section H)

#### H1. All Columns Populated
1. Navigate `/agent/reports`
2. Verify each row shows:
   - ✅ Policy ID: real UUID
   - ✅ Client: policyholder_name or "—"
   - ✅ Insurer: real name
   - ✅ Risk Score: integer
   - ✅ Status: "completed"
   - ✅ Views: integer or "Not viewed"
   - ✅ Created: real date
   - ✅ Share icon: visible

#### H2. Share Icon Copies URL
1. Click Share icon on any row
2. **Verify:**
   - ✅ Toast: "Link copied to clipboard"
3. Paste and verify it's a valid `/shared/report/:token` URL

#### H3. View Count Updates
1. After running F2 tests, return to `/agent/reports`
2. **Verify:**
   - ✅ Views column shows incremented count
   - ✅ Not "Not viewed"
3. May require page refresh

#### H4. Policy ID Click Navigates
1. Click any Policy ID link
2. **Verify:**
   - ✅ Navigates to `/agent/policies/:id`
   - ✅ Report renders

#### H5. Revoke & Regenerate from Ledger
1. Right-click or three-dot menu on a row
2. Test Revoke:
   - ✅ Share URL becomes 404
3. Test Regenerate:
   - ✅ New URL works
   - ✅ Old URL is 404

---

### Phase 6: Edge Cases (Section I)

#### I1. Very Large PDF Near Size Limit
1. Find or create a PDF close to 25MB
2. Upload it
3. **Verify:**
   - ✅ Processes successfully OR clean error
   - ✅ Not a timeout or crash

#### I2. PDF Over Size Limit
1. Create a PDF > 25MB
2. Upload it
3. **Verify:**
   - ✅ Multer rejects with clean error message

#### I3. Two Agents Uploading Simultaneously
1. Log in as agent1 in Chrome
2. Log in as agent2 in Firefox
3. Both click "Analyse Policy" at same second
4. **Verify:**
   - ✅ Both analyses run
   - ✅ Both complete
   - ✅ No cross-contamination of client records

---

### Phase 7: Final Checks (Section J)

#### J1. No Errors in Backend Logs
1. Scroll through terminal output from start to end
2. **Verify:**
   - ✅ Clean, no unhandled exceptions
   - ✅ No unhandled promise rejections

#### J2. No Errors in Browser Console
1. Check console across all pages tested
2. **Verify:**
   - ✅ No errors

---

## Quick Test Script

Save this as `quick_test.sh`:

```bash
#!/bin/bash

echo "=== Quick Phase 3 Test ==="
echo ""

# Test 1: Backend Health
echo "1. Backend Health Check..."
curl -s http://localhost:5000/api/health | jq .
echo ""

# Test 2: Auth Enforcement
echo "2. Auth Enforcement..."
curl -s -X POST http://localhost:5000/api/agent/analyze \
  -F "file=@test_policies/Star_Health_Real_Policy.pdf" \
  | jq .
echo ""

# Test 3: Database Counts
echo "3. Database Counts..."
cd backend && node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
Promise.all([
  pool.query('SELECT COUNT(*) FROM clients'),
  pool.query('SELECT COUNT(*) FROM report_views'),
  pool.query('SELECT COUNT(*) FROM analysis_jobs')
]).then(([c, r, a]) => {
  console.log('Clients:', c.rows[0].count);
  console.log('Report Views:', r.rows[0].count);
  console.log('Analysis Jobs:', a.rows[0].count);
  pool.end();
});
"

echo ""
echo "=== Tests Complete ==="
```

---

## Troubleshooting

### Frontend Won't Start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Backend Port Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /F /PID <PID>

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

### Database Connection Issues
```bash
# Check .env.local has correct DATABASE_URL
cat .env.local | grep DATABASE_URL

# Test connection
cd backend
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(() => {
  console.log('✅ Connected');
  pool.end();
}).catch(e => {
  console.error('❌ Failed:', e.message);
  pool.end();
});
"
```

### Can't Get JWT Token
1. Log in to agent dashboard
2. Open DevTools → Application → Local Storage
3. Look for key containing "supabase" or "auth"
4. Copy the access_token value

---

## Completion Checklist

- [ ] Backend running on port 5000
- [ ] Agent dashboard running (port 3000 or configured)
- [ ] Public portal running (if separate)
- [ ] 2 test agent accounts created
- [ ] Test PDFs ready
- [ ] Section A complete (3 tests)
- [ ] Section D complete (6 tests)
- [ ] Section E complete (5 tests)
- [ ] Section F complete (8 tests)
- [ ] Section H complete (5 tests)
- [ ] Section I complete (3 tests)
- [ ] Section J complete (2 tests)

**Total:** 32 frontend tests + 10 backend tests (already done) = 42/50 tests

---

## Time Estimates

- **Setup (first time):** 30 minutes
- **Section A:** 15 minutes
- **Section D:** 30 minutes
- **Section E:** 20 minutes
- **Section F:** 30 minutes
- **Section H:** 15 minutes
- **Section I:** 20 minutes
- **Section J:** 10 minutes

**Total:** ~2.5 hours (assuming no issues)

---

## Success Criteria

✅ **Feature is ready when:**
1. All 50 tests pass (or documented exceptions)
2. No errors in backend logs
3. No errors in browser console
4. Database row counts match test activity
5. All user flows work end-to-end

---

**Good luck with testing!** 🚀
