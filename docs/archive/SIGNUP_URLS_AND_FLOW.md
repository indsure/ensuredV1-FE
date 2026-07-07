# Agent Signup - URLs and Flow

## 🌐 URLs

### For Users (Agents)
- **Login Page**: `http://127.0.0.1:5412/login`
- **Signup Page**: `http://127.0.0.1:5412/signup`

### For Admin (nikhil@indsure.in)
- **Approval Dashboard**: `http://127.0.0.1:5412/admin/signup-requests`

## 📱 Complete User Journey

### Step 1: User Visits Login Page
```
URL: http://127.0.0.1:5412/login

┌─────────────────────────────────────┐
│   Sign In to IndSure                │
│                                     │
│   Email: [________________]         │
│   Password: [________________]      │
│                                     │
│   [      Sign In      ]             │
│                                     │
│   Don't have an account?            │
│   → Request Access ←  👈 CLICK HERE │
└─────────────────────────────────────┘
```

### Step 2: User Fills Signup Form
```
URL: http://127.0.0.1:5412/signup

┌─────────────────────────────────────┐
│   Create Agent Account              │
│   Request access to IndSure         │
│                                     │
│   Full Name: [________________]     │
│   Email: [________________]         │
│   Phone: [________________]         │
│   City: [________________]          │
│   Years of Experience: [____]       │
│   Password: [________________]      │
│   Confirm Password: [__________]    │
│                                     │
│   [    Request Access    ]          │
│                                     │
│   Already have an account? Sign In  │
└─────────────────────────────────────┘
```

### Step 3: Success Confirmation
```
┌─────────────────────────────────────┐
│          ✓                          │
│   Registration Submitted!           │
│                                     │
│   Your account request has been     │
│   submitted for approval. You will  │
│   receive an email at               │
│   user@example.com once approved.   │
│                                     │
│   This typically takes 1-2 days.    │
│                                     │
│   [    Back to Login    ]           │
└─────────────────────────────────────┘
```

### Step 4: Admin Receives Notification
```
📧 Email to: nikhil@indsure.in
Subject: New Agent Signup Request - John Doe

New Agent Signup Request

Name: John Doe
Email: john@example.com
Phone: +91 98765 43210
City: Mumbai
Years of Experience: 5

To approve or reject, visit:
http://127.0.0.1:5412/admin/signup-requests
```

### Step 5: Admin Reviews Request
```
URL: http://127.0.0.1:5412/admin/signup-requests

┌─────────────────────────────────────────────────────────────┐
│   Agent Signup Requests                                     │
│   Manage agent account requests and approvals               │
│                                                             │
│   [Pending (2)] [Approved] [Rejected]                       │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │ Name    Email           Phone        City    Exp  │    │
│   ├───────────────────────────────────────────────────┤    │
│   │ John    john@ex.com    +91 987...   Mumbai  5    │    │
│   │ [Approve] [Reject]                                │    │
│   │                                                   │    │
│   │ Jane    jane@ex.com    +91 876...   Delhi   3    │    │
│   │ [Approve] [Reject]                                │    │
│   └───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Step 6A: Admin Approves
```
Admin clicks [Approve]
    ↓
Confirmation: "Are you sure?"
    ↓
✅ Account Created!
    ↓
📧 Email to user:
    "Your account has been approved!
     You can now login at:
     http://127.0.0.1:5412/login"
```

### Step 6B: Admin Rejects
```
Admin clicks [Reject]
    ↓
Prompt: "Enter rejection reason (optional)"
    ↓
❌ Request Rejected
    ↓
📧 Email to user:
    "Unfortunately, we cannot approve
     your account at this time.
     Reason: [admin's reason]"
```

### Step 7: User Logs In (After Approval)
```
URL: http://127.0.0.1:5412/login

User enters:
- Email: john@example.com
- Password: [their password]

Clicks [Sign In]
    ↓
✅ Redirected to Dashboard
    ↓
URL: http://127.0.0.1:5412/dashboard
```

## 🔄 State Diagram

```
┌─────────────┐
│   VISITOR   │
└──────┬──────┘
       │
       │ Clicks "Request Access"
       ↓
┌─────────────┐
│   SIGNUP    │
│    FORM     │
└──────┬──────┘
       │
       │ Submits form
       ↓
┌─────────────┐
│  PENDING    │ ──→ Notification to nikhil@indsure.in
│  APPROVAL   │
└──────┬──────┘
       │
       ├──→ APPROVED ──→ ┌──────────────┐
       │                 │ ACTIVE AGENT │
       │                 │  Can Login   │
       │                 └──────────────┘
       │
       └──→ REJECTED ──→ ┌──────────────┐
                         │   REJECTED   │
                         │ Cannot Login │
                         └──────────────┘
```

## 🗄️ Database Flow

```
User submits signup
    ↓
INSERT INTO agent_signup_requests
    status = 'pending'
    ↓
INSERT INTO notifications
    recipient = 'nikhil@indsure.in'
    type = 'signup_request'

─────────────────────────────

Admin approves
    ↓
1. CREATE Supabase auth user
    ↓
2. INSERT INTO agents
    (id, email, name, role='agent', status='active')
    ↓
3. UPDATE agent_signup_requests
    SET status='approved', approved_at=NOW()
    ↓
4. INSERT INTO notifications
    recipient = user's email
    type = 'account_approved'

─────────────────────────────

Admin rejects
    ↓
1. UPDATE agent_signup_requests
    SET status='rejected', rejection_reason='...'
    ↓
2. INSERT INTO notifications
    recipient = user's email
    type = 'account_rejected'
```

## 🎯 Quick Reference

| Action | URL | Who |
|--------|-----|-----|
| View login page | `/login` | Anyone |
| Request signup | `/signup` | Anyone |
| View pending requests | `/admin/signup-requests` | Admin only |
| Approve request | API: `/api/admin/signup-requests/:id/approve` | Admin only |
| Reject request | API: `/api/admin/signup-requests/:id/reject` | Admin only |

## 📧 Email Recipients

All notifications go to: **nikhil@indsure.in**

Types of notifications:
1. **New Signup Request** - When user submits signup
2. **Account Approved** - Sent to user when approved
3. **Account Rejected** - Sent to user when rejected

## ⚙️ Configuration

Admin email is hardcoded in:
```typescript
// next-api/src/app/api/auth/signup/route.ts
const ADMIN_EMAIL = "nikhil@indsure.in";
```

To change admin email, update this constant.

## 🧪 Test Credentials

After approval, users login with:
- **Email**: The email they signed up with
- **Password**: The password they chose during signup

Example:
```
Email: test@example.com
Password: testpass123
```

## 🚨 Important Notes

1. **Port**: The app runs on `http://127.0.0.1:5412` (not 3000)
2. **Admin Role**: Only users with `role='admin'` can access approval dashboard
3. **Email**: Currently logs to console (integrate email service for production)
4. **Database**: Must run migration before using signup feature

## ✅ Verification Steps

After setup, verify:

1. ✅ Can access `/signup` from `/login`
2. ✅ Can submit signup form
3. ✅ Request appears in database
4. ✅ Admin can see request at `/admin/signup-requests`
5. ✅ Approve creates agent account
6. ✅ User can login after approval

---

**Ready to use!** Just run the database migration and start testing. 🚀
