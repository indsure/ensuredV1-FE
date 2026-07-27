# Sach AI Policy Context Feature

## Problem
Users were uploading their policy documents and asking Sach AI specific questions about their policies (e.g., "Does this policy cover robotic surgery?"), but Sach AI was responding as if it didn't have access to the policy, saying "I don't have access to your individual policy documents."

## Root Cause
The `jobId` parameter was being sent from the frontend but was being ignored in the backend (`_jobId`). The policy analysis data was never being fetched or included in the AI's context.

## Solution
Updated the Sach AI endpoint to:
1. Accept and use the `jobId` parameter
2. Fetch the policy analysis data from the `analysis_jobs` table
3. Extract relevant policy information (coverage, exclusions, waiting periods, copay, room rent capping, etc.)
4. Include this context in the system prompt sent to the AI model

## Implementation Details

### Backend Changes (`backend/server/index.ts`)

**1. Changed parameter from ignored to active:**
```typescript
// Before: const { messages = [], jobId: _jobId, ... }
// After:  const { messages = [], jobId, ... }
```

**2. Added policy context fetching:**
```typescript
let policyContext = "";
if (jobId && typeof jobId === "string") {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const jobRes = await pool.query(
    "SELECT result FROM analysis_jobs WHERE id = $1",
    [jobId]
  );
  
  if (jobRes.rows.length > 0 && jobRes.rows[0].result) {
    const analysisData = jobRes.rows[0].result;
    // Extract policy details...
  }
}
```

**3. Extracted key policy information:**
- Policy name and insurer
- Sum insured
- Coverage details
- Exclusions
- Waiting periods
- Copay details
- Room rent capping

**4. Updated system prompt to include policy context:**
```typescript
const chat = model.startChat({
  history: [
    {
      role: "user",
      parts: [{ text: SACH_AI_SYSTEM_PROMPT + policyContext }]
    },
    ...history
  ],
  // ...
});
```

## How It Works

1. **User uploads policy** → Analysis job is created with a `jobId`
2. **User opens Sach AI chat** → Frontend passes `currentJobId` to the API
3. **Backend receives request** → Fetches analysis data from database using `jobId`
4. **Policy context is built** → Extracts relevant fields from the analysis result
5. **AI receives context** → System prompt includes the user's specific policy details
6. **AI responds** → Can now answer specific questions about the user's policy

## Example Context Format

```
=== USER'S POLICY CONTEXT ===
Policy Name: Star Health Comprehensive Insurance
Insurer: Star Health Insurance
Sum Insured: ₹5,00,000

Coverage Details:
- Hospitalization: Covered for all medical expenses
- Pre-hospitalization: 60 days coverage
- Post-hospitalization: 90 days coverage
- Robotic Surgery: Covered under modern treatments

Exclusions:
- Pre-existing diseases (2 year waiting period)
- Cosmetic procedures
- Dental treatment (unless due to accident)

Waiting Periods:
- Pre-existing diseases: 2 years
- Specific diseases: 1 year
- Initial waiting period: 30 days

Copay Details:
- Senior citizens (60+): 20% copay

Room Rent Capping:
Limit: 1% of sum insured per day

=== END POLICY CONTEXT ===

IMPORTANT: The user has uploaded their policy document. Use the above policy context to answer their specific questions about THEIR policy.
```

## Benefits

✅ **Personalized responses**: AI can now answer specific questions about the user's policy
✅ **Accurate information**: Responses are based on actual policy data, not generic information
✅ **Better user experience**: Users get relevant answers to their policy-specific questions
✅ **Graceful degradation**: If no policy is uploaded, AI still provides general insurance education

## Testing

To verify the feature works:

1. Upload a policy document and wait for analysis to complete
2. Open the Sach AI chat widget
3. Ask a specific question like "Does this policy cover robotic surgery?"
4. Verify the AI responds with information specific to your policy

## Error Handling

- If `jobId` is not provided, AI works in general education mode
- If database query fails, error is logged but request continues without policy context
- If policy data is malformed, AI gracefully handles missing fields
- Database connection is properly closed after fetching data

## Future Improvements

- Cache policy context per session to avoid repeated database queries
- Add more detailed policy information (sub-limits, network hospitals, etc.)
- Support multiple policies per user
- Add policy comparison context when user has multiple policies
