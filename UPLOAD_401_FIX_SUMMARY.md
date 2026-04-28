# Agent Upload 401 Error - Fix Applied

## Problem
Agent upload was failing with:
```
Error: Invalid or expired token
Status: 401 Unauthorized
```

## Root Cause
The authentication token was either:
1. Not present (user not logged in)
2. Expired (session timed out)
3. Not being refreshed automatically

## Solution Applied

### 1. Created Auth Helper (`frontend/client/src/lib/auth-helper.ts`)

New utility functions to handle authentication:

```typescript
// Automatically refreshes token if expiring soon
getValidSession()

// Check if user is authenticated
isAuthenticated()

// Get auth header for API requests
getAuthHeader()
```

**Key Feature:** Automatically refreshes tokens that expire within 5 minutes

### 2. Updated AgentUploads Component

**Changes:**
- ✅ Uses `getValidSession()` instead of direct Supabase call
- ✅ Handles auth errors gracefully
- ✅ Redirects to login on 401 errors
- ✅ Shows user-friendly error messages

**Before:**
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  throw new Error("Not authenticated");
}
```

**After:**
```typescript
let session;
try {
  session = await getValidSession(); // Auto-refreshes if needed
} catch (authError: any) {
  if (authError.message.includes('Not authenticated') || 
      authError.message.includes('Session expired')) {
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

## How to Test

### Test 1: Fresh Login
1. Navigate to `/agent/login`
2. Log in with credentials
3. Go to `/agent/uploads`
4. Upload a PDF
5. **Expected:** Upload succeeds

### Test 2: Check Auth State
Open browser console and run:
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('Logged in:', !!session);
console.log('User:', session?.user?.email);
```

### Test 3: Token Expiry
```javascript
const { data: { session } } = await supabase.auth.getSession();
const payload = JSON.parse(atob(session.access_token.split('.')[1]));
const expiresIn = Math.floor((payload.exp * 1000 - Date.now()) / 1000 / 60);
console.log('Token expires in:', expiresIn, 'minutes');
```

## User Instructions

### If You See "Invalid or expired token":

1. **Log in again:**
   - Navigate to `/agent/login`
   - Enter your credentials
   - Click "Sign In"

2. **Clear browser cache if needed:**
   - Press F12 to open DevTools
   - Go to Application tab
   - Click "Clear storage"
   - Reload the page

3. **Try upload again:**
   - Go to `/agent/uploads`
   - Upload your PDF
   - Should work now

## Technical Details

### Token Refresh Logic

The auth helper checks token expiry and refreshes automatically:

```typescript
// Check if token expires within 5 minutes
const expiresAt = session.expires_at || 0;
const now = Math.floor(Date.now() / 1000);
const timeUntilExpiry = expiresAt - now;

if (timeUntilExpiry < 300) {
  // Refresh token
  const { data: { session: newSession } } = 
    await supabase.auth.refreshSession();
  return newSession;
}
```

### Error Handling

The component now handles three types of auth errors:

1. **Not Authenticated:** Redirects to login
2. **Session Expired:** Shows message and redirects to login
3. **401 from API:** Shows message and redirects to login

## Files Modified

1. ✅ `frontend/client/src/lib/auth-helper.ts` - NEW
2. ✅ `frontend/client/src/pages/agent/AgentUploads.tsx` - UPDATED

## Files to Update (Optional)

Apply the same pattern to other agent pages:

- `frontend/client/src/pages/agent/PolicyDetail.tsx`
- `frontend/client/src/pages/agent/PoliciesNew.tsx`
- `frontend/client/src/pages/agent/ReportsNew.tsx`

Replace:
```typescript
const { data: { session } } = await supabase.auth.getSession();
```

With:
```typescript
import { getValidSession } from '@/lib/auth-helper';
const session = await getValidSession();
```

## Success Criteria

✅ User can upload PDFs without 401 errors  
✅ Token refreshes automatically before expiry  
✅ Clear error messages when auth fails  
✅ Automatic redirect to login when needed  
✅ No silent failures  

## Next Steps

1. **Test the fix:**
   - Log in to agent dashboard
   - Try uploading a PDF
   - Verify it works

2. **If still failing:**
   - Check browser console for errors
   - Verify you're logged in (Test 2 above)
   - Check backend logs

3. **Apply to other pages:**
   - Update other agent pages to use auth helper
   - Consistent error handling across the app

---

**Status:** Fix applied and ready to test  
**Impact:** Resolves 401 errors on agent upload  
**Breaking Changes:** None  
**Backward Compatible:** Yes
