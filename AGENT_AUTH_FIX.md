# Agent Upload 401 Error - Fix Guide

## Problem

Agent upload is failing with:
```
Error: Invalid or expired token
Status: 401 Unauthorized
```

## Root Cause

The Supabase authentication session is either:
1. **Not authenticated** - User not logged in
2. **Token expired** - Session has timed out
3. **Token invalid** - Session corrupted or cleared

## Diagnosis Steps

### Step 1: Check Authentication State

Open browser DevTools Console and run:

```javascript
// Check if user is logged in
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('User:', session?.user);
console.log('Access Token:', session?.access_token);
```

**Expected Output:**
```javascript
{
  access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  user: { id: "...", email: "agent@example.com", ... }
}
```

**If null:** User is not logged in

### Step 2: Check Local Storage

In DevTools → Application → Local Storage → `http://localhost:5412`

Look for keys starting with `sb-` (Supabase auth keys)

**Expected:**
- `sb-<project-ref>-auth-token`
- Should contain a valid JWT token

**If missing:** Session was cleared or never created

### Step 3: Check Agent Profile

```javascript
const { data: profile } = await supabase
  .from('agents')
  .select('*')
  .eq('id', session.user.id)
  .single();
console.log('Agent Profile:', profile);
```

**Expected:** Agent record exists with matching user ID

## Solutions

### Solution 1: Re-login

1. Navigate to `/agent/login`
2. Enter credentials
3. Click "Sign In"
4. Verify redirect to `/agent/dashboard`
5. Try upload again

### Solution 2: Check Supabase Configuration

Verify `.env.local` has correct Supabase credentials:

```bash
SUPABASE_URL=https://khxbabotbvnyjwvqtumt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Solution 3: Create Test Agent Account

If no agent account exists, create one:

```sql
-- In Supabase SQL Editor

-- 1. Create auth user (if not exists)
-- Go to Authentication → Users → Add User
-- Email: test@agent.com
-- Password: TestAgent123!

-- 2. Create agent profile
INSERT INTO agents (id, email, full_name, phone_number, city, firm_name)
VALUES (
  '<user-id-from-auth>',
  'test@agent.com',
  'Test Agent',
  '+91 9876543210',
  'Mumbai',
  'Test Insurance Agency'
);
```

### Solution 4: Fix Token Refresh

Add token refresh logic to handle expired sessions:

```typescript
// In AgentUploads.tsx, before making API call:

const { data: { session }, error } = await supabase.auth.getSession();

if (error || !session) {
  // Try to refresh
  const { data: { session: newSession } } = await supabase.auth.refreshSession();
  
  if (!newSession) {
    toast({
      variant: "destructive",
      title: "Session expired",
      description: "Please log in again"
    });
    setLocation("/agent/login");
    return;
  }
}
```

## Quick Fix Script

Create `frontend/client/src/lib/auth-helper.ts`:

```typescript
import { supabase } from './supabase';

export async function getValidSession() {
  // Try to get current session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    throw new Error('Authentication error');
  }
  
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  // Check if token is about to expire (within 5 minutes)
  const expiresAt = session.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = expiresAt - now;
  
  if (timeUntilExpiry < 300) {
    // Token expires soon, refresh it
    const { data: { session: newSession }, error: refreshError } = 
      await supabase.auth.refreshSession();
    
    if (refreshError || !newSession) {
      throw new Error('Session expired');
    }
    
    return newSession;
  }
  
  return session;
}
```

Then update `AgentUploads.tsx`:

```typescript
import { getValidSession } from '@/lib/auth-helper';

// In onDrop function:
try {
  const session = await getValidSession();
  
  const uploadRes = await fetch("/api/agent/analyze", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`
    },
    body: formData
  });
  // ... rest of code
} catch (authError: any) {
  if (authError.message === 'Not authenticated' || authError.message === 'Session expired') {
    toast({
      variant: "destructive",
      title: "Session expired",
      description: "Please log in again"
    });
    setLocation("/agent/login");
    return;
  }
  throw authError;
}
```

## Testing Steps

### Test 1: Fresh Login

1. Clear browser storage (DevTools → Application → Clear Storage)
2. Navigate to `/agent/login`
3. Log in with valid credentials
4. Navigate to `/agent/uploads`
5. Upload a PDF
6. **Expected:** Upload succeeds

### Test 2: Token Validation

```javascript
// In browser console
const { data: { session } } = await supabase.auth.getSession();

// Decode JWT to check expiry
const payload = JSON.parse(atob(session.access_token.split('.')[1]));
console.log('Token expires at:', new Date(payload.exp * 1000));
console.log('Time until expiry:', Math.floor((payload.exp * 1000 - Date.now()) / 1000 / 60), 'minutes');
```

### Test 3: Backend Verification

Test the backend directly:

```bash
# Get a valid token from browser (see Step 1)
TOKEN="<paste-token-here>"

# Test upload endpoint
curl -X POST http://localhost:5412/api/agent/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.pdf"
```

**Expected:** Should NOT return 401

## Common Issues

### Issue 1: CORS Error
**Symptom:** Network error, not 401  
**Fix:** Check backend CORS configuration

### Issue 2: Wrong API URL
**Symptom:** 404 Not Found  
**Fix:** Verify API base URL in frontend

### Issue 3: Supabase Project Mismatch
**Symptom:** Invalid token even after login  
**Fix:** Verify `SUPABASE_URL` matches the project

### Issue 4: RLS Policies Blocking
**Symptom:** 401 even with valid token  
**Fix:** Check Supabase RLS policies on `agents` table

## Verify Backend is Working

The backend auth check is in `backend/server/routes.ts`:

```typescript
const verifyJwt = async (req: any, res: any): Promise<string | null> => {
  const authHeader = req.headers["authorization"] as string | undefined;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return null;
    }
    return user.id;
  }
  res.status(401).json({ error: "Missing authorization" });
  return null;
};
```

This means the backend is calling Supabase to verify the token. If it returns 401, either:
1. Token is malformed
2. Token is expired
3. Token is for wrong Supabase project
4. Supabase service is down

## Success Criteria

✅ User can log in successfully  
✅ Session persists in local storage  
✅ Upload shows "Uploading..." not "Error: Invalid or expired token"  
✅ Backend returns 200 with `{ clientId, jobId }`  
✅ Analysis completes and shows results  

## Next Steps

1. **Check if user is logged in** (Step 1 above)
2. **If not logged in:** Navigate to `/agent/login` and log in
3. **If logged in but still failing:** Check token expiry (Test 2)
4. **If token expired:** Implement token refresh (Solution 4)
5. **If still failing:** Check backend logs for detailed error

---

**Most Likely Cause:** User is not logged in or session expired  
**Quick Fix:** Log in again at `/agent/login`  
**Permanent Fix:** Implement automatic token refresh
