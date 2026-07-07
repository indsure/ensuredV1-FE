# Test Shared Report Fix

## Quick Test Steps

### 1. Start the Backend Server

```bash
cd backend
npm start
```

Wait for the message: `[SERVER] Listening on port 5000`

### 2. Open the Shared Report in Browser

Navigate to:
```
http://127.0.0.1:5412/shared/report/16a07339-ae05-4154-bac5-a104e82667c3
```

### 3. Check Browser Console

1. Press F12 to open Developer Tools
2. Go to the Console tab
3. Look for logs starting with `[SharedReport]`

You should see something like:
```
[SharedReport] Received report data: {
  hasReportData: true,
  hasIdentity: true,
  hasPolicyTimeline: true,
  hasCoverageStructure: true,
  zone: "C",
  verdict: "BORDERLINE",
  score: 95,
  hasClaimSimulations: true,
  claimSimulationsLength: 2,
  hasCriticalActions: true
}
[SharedReport] Validation passed, setting data
```

### 4. Verify the Report Display

The page should now show:

✅ **Header Section:**
- Verdict badge (e.g., "BORDERLINE")
- Summary text
- Insured name: "ANIKET RAJESH BANG"
- Effective Cover: ₹25.0L
- Policy Age: 1.1 Years
- Data Quality: Medium

✅ **Scorecard:**
- Large score number: 95
- NCAR value
- Score breakdown bars

✅ **Coverage Overview:**
- "What Actually Works" section with green items
- "Where It May Cost You" section with amber items

✅ **Claim Simulations:**
- Multiple simulation cards showing scenarios

✅ **Extracted Policy Details:**
- Financial Limits & Caps
- Supplementary Benefits
- Waiting Periods

### 5. Common Issues and Solutions

#### Issue: Still seeing "Pending" or empty sections

**Solution 1: Clear Browser Cache**
```
Ctrl + Shift + Delete → Clear cached images and files
```

**Solution 2: Hard Refresh**
```
Ctrl + Shift + R (or Cmd + Shift + R on Mac)
```

**Solution 3: Check Console Logs**
Look for the `[SharedReport]` logs to see which validation check is failing.

#### Issue: "Report Not Available" error

**Possible causes:**
1. Share token is invalid or revoked
2. Report status is not 'done' in database
3. `share_enabled` is false in database

**Check database:**
```sql
SELECT id, status, share_enabled, share_token 
FROM clients 
WHERE share_token = '16a07339-ae05-4154-bac5-a104e82667c3';
```

#### Issue: "Report In Progress" error

**Cause:** Report status is not 'done' or `report_data` is null

**Fix:** Ensure the report has been fully processed:
```sql
UPDATE clients 
SET status = 'done' 
WHERE share_token = '16a07339-ae05-4154-bac5-a104e82667c3';
```

### 6. Validation Checklist

Use this checklist to verify the fix:

- [ ] Report loads without errors
- [ ] Verdict badge is displayed
- [ ] Audit score (95) is visible
- [ ] Insured name is shown
- [ ] Coverage overview sections are populated
- [ ] Score breakdown bars are visible
- [ ] Claim simulations are displayed (if available)
- [ ] Policy details sections are populated
- [ ] No console errors
- [ ] Console shows "[SharedReport] Validation passed"

### 7. Testing Different Scenarios

#### Test with Empty Claim Simulations

If you have a report with empty `claim_simulations`:
1. It should still pass validation
2. The "Claim Simulations" section should not appear
3. All other sections should display normally

#### Test with Zone D

If you have a report with Zone "D":
1. It should pass validation
2. The zone should display correctly in the report

#### Test with Missing Critical Actions

If `recommendations.critical_actions` is missing or empty:
1. It should still pass validation
2. The report should display normally

## Expected Console Output

### Success Case:
```
[SharedReport] Received report data: {
  hasReportData: true,
  hasIdentity: true,
  hasPolicyTimeline: true,
  hasCoverageStructure: true,
  zone: "C",
  verdict: "BORDERLINE",
  score: 95,
  hasClaimSimulations: true,
  claimSimulationsLength: 2,
  hasCriticalActions: true
}
[SharedReport] Validation passed, setting data
```

### Failure Case (Before Fix):
```
[SharedReport] Received report data: {
  hasReportData: true,
  hasIdentity: true,
  hasPolicyTimeline: true,
  hasCoverageStructure: true,
  zone: "C",
  verdict: "BORDERLINE",
  score: 95,
  hasClaimSimulations: true,
  claimSimulationsLength: 0,  // Empty array
  hasCriticalActions: false
}
[SharedReport] Validation failed
```

## Troubleshooting

### If validation still fails:

1. **Check the console logs** - They will tell you exactly which field is missing
2. **Verify the report data in database**:
   ```sql
   SELECT report_data FROM clients WHERE share_token = '16a07339-ae05-4154-bac5-a104e82667c3';
   ```
3. **Check required fields**:
   - `identity` (with `assumed_zone`)
   - `policy_timeline`
   - `coverage_structure`
   - `final_verdict.label` (must be "SAFE", "BORDERLINE", or "RISKY")
   - `audit_score.score` (must be a number between 0-100)

### If the page is blank:

1. Check for JavaScript errors in console
2. Verify the API endpoint is responding:
   ```bash
   curl http://127.0.0.1:5412/api/shared/report/16a07339-ae05-4154-bac5-a104e82667c3
   ```
3. Check network tab in DevTools for failed requests

## Success Criteria

The fix is successful when:
1. ✅ Report displays with all sections populated
2. ✅ No validation errors in console
3. ✅ Console shows "Validation passed, setting data"
4. ✅ Audit score and verdict are visible
5. ✅ All policy details are rendered correctly

## Next Steps

After verifying the fix:
1. Test with multiple different reports
2. Test with reports that have empty `claim_simulations`
3. Test with reports in different zones (A, B, C, D)
4. Consider removing the debug console logs in production
5. Update any documentation that references the validation logic
