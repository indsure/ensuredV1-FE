# Bug Fixes Summary - Policy Detail & Queue Pages

## Issues Fixed

### 1. **PolicyDetail.tsx - 404 Error on Policy Detail Page**
**Problem**: The page was loading but not displaying data correctly because:
- Query was not fetching all necessary columns from `clients` table
- Missing `expiry_date`, `sum_insured`, `flaws`, `report_data`, `policyholder_name` columns
- Report data was not being properly extracted from `report_data` JSONB field

**Solution**:
- Updated query to fetch all necessary columns: `expiry_date`, `sum_insured`, `flaws`, `report_data`, `policyholder_name`
- Properly map `policyholder_name` to `client_name` for display
- Extract report summary from `report_data.final_verdict.summary` if available
- Use `report_data` JSONB field to populate the report object

**Files Changed**: `frontend/client/src/pages/agent/PolicyDetail.tsx`

### 2. **MyQueue.tsx - 404 Error on Retry Endpoint**
**Problem**: The retry function was calling `/api/analyses/${id}/retry` which doesn't exist in the backend

**Solution**:
- Replaced API call with direct Supabase update
- Update `status` to "processing" and clear `error_message`
- This marks the policy for reprocessing by the backend batch processor

**Files Changed**: `frontend/client/src/pages/agent/MyQueue.tsx`

### 3. **PolicyDetail.tsx - Rerun Analysis Function**
**Problem**: Rerun was setting status to "processing" but should set to "pending" to trigger batch processing

**Solution**:
- Changed status update from "processing" to "pending"
- Clear `error_message` field when rerunning
- This properly queues the policy for reprocessing

**Files Changed**: `frontend/client/src/pages/agent/PolicyDetail.tsx`

### 4. **PolicyDetail.tsx - Save Client Details**
**Problem**: Was updating `name` column but should update `policyholder_name`

**Solution**:
- Changed update to use `policyholder_name` column instead of `name`
- This matches the actual database schema

**Files Changed**: `frontend/client/src/pages/agent/PolicyDetail.tsx`

## Database Schema Clarification

The actual database has these tables (not just `agents` and `analysis_jobs` as shown in db_schema.json):

### `clients` table columns:
- id (uuid)
- agent_id (uuid)
- name (text)
- insurer (text)
- sum_insured (numeric)
- expiry_date (date)
- pdf_url (text)
- score (integer)
- flaws (jsonb)
- report_data (jsonb)
- status (text) - values: 'pending', 'processing', 'done', 'error'
- error_message (text)
- created_at (timestamp)
- batch_id (uuid)
- policy_name (text)
- policyholder_name (text)
- insights (jsonb)

## Testing Recommendations

1. **Test Policy Detail Page**:
   - Navigate to http://localhost:5412/agent/policies/[policy-id]
   - Verify policy details display correctly
   - Check that expiry date shows if available
   - Verify report data displays from `report_data` field
   - Test "Re-run Analysis" button

2. **Test My Queue Page**:
   - Navigate to http://localhost:5412/agent/my-queue
   - Verify failed policies show in "Failed" tab
   - Test "Retry" button on failed policies
   - Verify status updates to "processing"

3. **Test Client Details Edit**:
   - Open a policy detail page
   - Click "Edit Client Details"
   - Update the client name
   - Verify it saves to `policyholder_name` column

## Notes

- The `db_schema.json` file is outdated and only shows `agents` and `analysis_jobs` tables
- The actual database has many more tables including `clients`, `batch_uploads`, `public_reports`, etc.
- Backend routes in `backend/server/routes.ts` show the complete API structure
- Frontend queries should use Supabase client directly instead of custom API endpoints where possible
