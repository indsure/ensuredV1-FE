# Lead Collection System - Testing Guide

## 🧪 Complete Testing Checklist

### Prerequisites

1. **Database Setup**
   ```bash
   cd backend/server
   npx tsx setup_leads_db.ts
   ```
   ✅ Expected: "🎉 Leads database setup complete!"

2. **Backend Running**
   ```bash
   cd backend
   npm run dev
   ```
   ✅ Expected: "Server running on :5000"

3. **Frontend Running**
   ```bash
   cd frontend
   npm run dev
   ```
   ✅ Expected: "Local: http://127.0.0.1:5412"

---

## Test 1: CTA Visibility

### Steps
1. Navigate to `http://127.0.0.1:5412/report`
2. Upload a policy document
3. Wait for analysis to complete
4. Scroll to the recommendations section

### Expected Results
- ✅ If porting recommendation is "consider" or "yes", CTA appears
- ✅ CTA has amber/orange gradient background
- ✅ Badge shows "→ CONSIDER"
- ✅ Form fields are visible
- ✅ Name and city are pre-filled (if available from policy)

### Screenshots to Verify
- [ ] CTA appears after recommendations
- [ ] Design matches the provided screenshot
- [ ] Form is properly styled

---

## Test 2: Form Validation

### Test 2.1: Empty Form Submission
**Steps**: Try to submit without filling any fields

**Expected**:
- ✅ Browser validation prevents submission
- ✅ Required field indicators appear

### Test 2.2: Invalid Email
**Steps**: Enter "notanemail" in email field

**Expected**:
- ✅ Email validation error appears
- ✅ Form cannot be submitted

### Test 2.3: Invalid Phone
**Steps**: Enter "123" in phone field

**Expected**:
- ✅ Phone validation error appears
- ✅ Message: "Invalid phone format. Must be 10 digits"

### Test 2.4: Valid Data
**Steps**: Fill all fields correctly
- Name: "Test User"
- Email: "test@example.com"
- Phone: "9876543210"
- City: "Mumbai"

**Expected**:
- ✅ All fields accept input
- ✅ No validation errors
- ✅ Submit button is enabled

---

## Test 3: Form Submission

### Steps
1. Fill form with valid data
2. Click "Talk to an IndSure Advisor about this →"
3. Wait for response

### Expected Results
- ✅ Button shows loading state: "⟳ Submitting..."
- ✅ After ~1 second, success message appears
- ✅ Success message shows: "Thank You!"
- ✅ Message: "Our advisor will reach out to you within 24 hours"
- ✅ Green checkmark icon visible

### Verify in Browser Console
```javascript
// Should see successful POST request
POST http://localhost:5000/api/leads
Status: 201 Created
```

---

## Test 4: Database Verification

### Steps
1. After submitting a lead, check the database

### Option A: Using Admin Panel
1. Login as admin at `http://127.0.0.1:5412/agent/login`
2. Navigate to `/admin`
3. Click "Leads" tab

**Expected**:
- ✅ New lead appears in the list
- ✅ All data is correct (name, email, phone, city)
- ✅ Status is "New"
- ✅ Source is "policy_report"
- ✅ Created timestamp is recent

### Option B: Direct Database Query
```bash
cd backend/server
npx tsx -e "
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 5')
  .then(r => console.table(r.rows))
  .then(() => process.exit(0));
"
```

---

## Test 5: Admin Panel Features

### Test 5.1: View Leads
**Steps**: Navigate to `/admin` → Leads tab

**Expected**:
- ✅ Statistics cards show correct counts
- ✅ Leads table displays all leads
- ✅ Phone numbers are clickable (tel: links)
- ✅ Email addresses are clickable (mailto: links)

### Test 5.2: Filter by Status
**Steps**: 
1. Click status dropdown
2. Select "New"

**Expected**:
- ✅ Only leads with status "new" are shown
- ✅ Statistics update accordingly

### Test 5.3: Refresh
**Steps**: Click refresh button (🔄)

**Expected**:
- ✅ Button shows spinning animation
- ✅ Data reloads from server
- ✅ Latest leads appear

---

## Test 6: Duplicate Prevention

### Steps
1. Submit a lead with email "duplicate@test.com"
2. Try to submit another lead with same email

### Expected Results
- ✅ Second submission fails
- ✅ Error message: "A lead with this email already exists"
- ✅ Status code: 409 Conflict

---

## Test 7: API Endpoints

### Test 7.1: POST /api/leads
```bash
curl -X POST http://localhost:5000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test User",
    "email": "apitest@example.com",
    "phone": "9999999999",
    "city": "Bangalore"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Lead submitted successfully",
  "leadId": "uuid-here",
  "createdAt": "2026-04-27T..."
}
```

### Test 7.2: GET /api/leads
```bash
curl http://localhost:5000/api/leads?limit=5
```

**Expected Response**:
```json
{
  "leads": [...],
  "total": 10,
  "limit": 5,
  "offset": 0
}
```

### Test 7.3: GET /api/leads with Filter
```bash
curl http://localhost:5000/api/leads?status=new&limit=10
```

**Expected Response**:
- Only leads with status "new"

---

## Test 8: Edge Cases

### Test 8.1: Very Long Name
**Input**: Name with 200 characters

**Expected**:
- ✅ Accepts input
- ✅ Stores correctly in database

### Test 8.2: Special Characters in Name
**Input**: "O'Brien-Smith"

**Expected**:
- ✅ Accepts input
- ✅ No SQL injection issues

### Test 8.3: International Phone Format
**Input**: "+91 9876543210"

**Expected**:
- ❌ Validation fails (only 10 digits allowed)
- ✅ User must enter "9876543210"

### Test 8.4: Multiple Submissions
**Steps**: Submit 10 leads rapidly

**Expected**:
- ✅ All submissions succeed
- ✅ No race conditions
- ✅ All leads appear in admin panel

---

## Test 9: Responsive Design

### Test 9.1: Mobile View (375px)
**Steps**: Resize browser to mobile width

**Expected**:
- ✅ Form switches to single column
- ✅ All fields are accessible
- ✅ Button is full width
- ✅ Text is readable

### Test 9.2: Tablet View (768px)
**Expected**:
- ✅ Form uses 2-column layout
- ✅ Proper spacing maintained

### Test 9.3: Desktop View (1920px)
**Expected**:
- ✅ CTA is centered and max-width
- ✅ Form is well-proportioned

---

## Test 10: Performance

### Test 10.1: Form Submission Speed
**Expected**:
- ✅ Submission completes in < 2 seconds
- ✅ No UI freezing

### Test 10.2: Admin Panel Load Time
**Expected**:
- ✅ Leads load in < 1 second
- ✅ Smooth filtering

---

## 🐛 Common Issues & Solutions

### Issue 1: CTA Not Appearing
**Cause**: Policy doesn't trigger porting recommendation

**Solution**: 
- Check `portingRec.recommendation` value
- Ensure it's "consider" or "yes"
- Try with a different policy

### Issue 2: Form Submission Fails
**Cause**: Backend not running or database connection issue

**Solution**:
```bash
# Check backend logs
cd backend
npm run dev

# Verify database connection
cd backend/server
npx tsx -e "
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(() => console.log('✅ DB Connected')).catch(e => console.error('❌', e));
"
```

### Issue 3: Admin Panel Shows No Leads
**Cause**: RLS policy or authentication issue

**Solution**:
- Ensure you're logged in as admin
- Check browser console for errors
- Verify API endpoint is accessible

### Issue 4: Duplicate Email Error
**Cause**: Email already exists in database

**Solution**:
- Use a different email
- Or delete the existing lead from database

---

## ✅ Final Checklist

Before marking as complete, verify:

- [ ] Database table created successfully
- [ ] CTA appears on report page
- [ ] Form validation works correctly
- [ ] Lead submission succeeds
- [ ] Success message displays
- [ ] Lead appears in admin panel
- [ ] Admin can filter by status
- [ ] Phone/email links work
- [ ] Responsive design works on mobile
- [ ] No console errors
- [ ] API endpoints respond correctly
- [ ] Duplicate prevention works

---

## 📊 Test Results Template

```
Date: _______________
Tester: _______________

Test 1: CTA Visibility          [ ] Pass  [ ] Fail
Test 2: Form Validation         [ ] Pass  [ ] Fail
Test 3: Form Submission         [ ] Pass  [ ] Fail
Test 4: Database Verification   [ ] Pass  [ ] Fail
Test 5: Admin Panel Features    [ ] Pass  [ ] Fail
Test 6: Duplicate Prevention    [ ] Pass  [ ] Fail
Test 7: API Endpoints           [ ] Pass  [ ] Fail
Test 8: Edge Cases              [ ] Pass  [ ] Fail
Test 9: Responsive Design       [ ] Pass  [ ] Fail
Test 10: Performance            [ ] Pass  [ ] Fail

Overall Status: [ ] All Tests Passed  [ ] Issues Found

Notes:
_________________________________________________
_________________________________________________
```

---

**Happy Testing! 🚀**
