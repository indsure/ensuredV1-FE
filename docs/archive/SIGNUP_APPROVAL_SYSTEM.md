# Agent Signup Approval System

## Overview

The agent dashboard now includes a signup feature with an approval workflow. All signup requests require approval from an admin (nikhil@indsure.in) before users can access the system.

## Features

### 1. User Signup Flow
- Users can request access at `http://127.0.0.1:5412/signup`
- Required information:
  - Full Name
  - Email
  - Phone Number
  - City
  - Years of Experience
  - Password (min 8 characters)
- After submission, users see a confirmation message
- Users cannot log in until their account is approved

### 2. Admin Approval Workflow
- All signup requests are stored in the `agent_signup_requests` table
- Notifications are sent to `nikhil@indsure.in` for each new request
- Admin can view all requests at `/admin/signup-requests`
- Admin can:
  - **Approve**: Creates Supabase auth account + agent database record
  - **Reject**: Marks request as rejected with optional reason
- Users receive email notifications when approved/rejected

### 3. Notification System
- All notifications are logged to the `notifications` table
- Email content is logged to console (for development)
- In production, integrate with email service (SendGrid, AWS SES, etc.)

## Database Schema

### agent_signup_requests
```sql
CREATE TABLE agent_signup_requests (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone VARCHAR(50) NOT NULL,
  city VARCHAR(100) NOT NULL,
  years_experience INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES agents(id),
  rejection_reason TEXT
);
```

### notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  recipient_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP
);
```

## Setup Instructions

### 1. Run Database Migration
```bash
psql -d your_database -f setup_signup_approval.sql
```

### 2. Environment Variables
Ensure these are set in your `.env.local` files:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_postgres_connection_string
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Test the Flow

#### As a User:
1. Navigate to `http://127.0.0.1:5412/signup`
2. Fill out the signup form
3. Submit and wait for approval

#### As an Admin:
1. Log in with admin credentials
2. Navigate to `/admin/signup-requests`
3. Review pending requests
4. Approve or reject requests

## API Endpoints

### POST /api/auth/signup
Creates a new signup request
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "+91 98765 43210",
  "city": "Mumbai",
  "yearsExperience": 5
}
```

### GET /api/admin/signup-requests?status=pending
Lists signup requests (requires admin role)

### POST /api/admin/signup-requests/:id/approve
Approves a signup request (requires admin role)

### POST /api/admin/signup-requests/:id/reject
Rejects a signup request (requires admin role)
```json
{
  "reason": "Insufficient experience"
}
```

## Security Features

1. **Password Requirements**: Minimum 8 characters
2. **Email Validation**: Checks for existing accounts
3. **Duplicate Prevention**: Prevents multiple pending requests from same email
4. **Role-Based Access**: Only admins can approve/reject requests
5. **Auto Email Confirmation**: Approved users have email auto-confirmed in Supabase

## Email Integration (Production)

To enable actual email sending in production:

1. Choose an email service (SendGrid, AWS SES, Mailgun, etc.)
2. Update the email functions in:
   - `next-api/src/app/api/auth/signup/route.ts` (sendApprovalNotification)
   - `next-api/src/app/api/admin/signup-requests/[id]/approve/route.ts` (sendApprovalEmail)
   - `next-api/src/app/api/admin/signup-requests/[id]/reject/route.ts` (sendRejectionEmail)

Example with SendGrid:
```typescript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to: email,
  from: 'noreply@indsure.in',
  subject: subject,
  text: emailContent,
});
```

## Admin Notification Email

When a new signup request is submitted, the admin receives:
- Applicant name, email, phone, city, experience
- Direct link to approve/reject
- Notification stored in database

## User Journey

### Signup Request
1. User fills signup form
2. Request stored as "pending"
3. Admin notified at nikhil@indsure.in
4. User sees confirmation message

### Approval
1. Admin reviews request
2. Admin clicks "Approve"
3. Supabase auth account created
4. Agent record created in database
5. User receives approval email
6. User can now log in

### Rejection
1. Admin reviews request
2. Admin clicks "Reject" and enters reason
3. Request marked as rejected
4. User receives rejection email with reason

## Troubleshooting

### Users can't sign up
- Check database connection
- Verify `agent_signup_requests` table exists
- Check console for errors

### Emails not sending
- In development, emails are logged to console
- Check `notifications` table for stored emails
- Integrate email service for production

### Approval fails
- Verify Supabase service role key is set
- Check `agents` table structure matches expected schema
- Review console logs for detailed errors

## Future Enhancements

1. **Email Templates**: Use HTML email templates
2. **Bulk Actions**: Approve/reject multiple requests at once
3. **Auto-Approval**: Based on criteria (e.g., verified email domain)
4. **Waiting List**: Queue system for high volume
5. **Application Form**: Extended form with more details
6. **Document Upload**: ID verification, certificates, etc.
