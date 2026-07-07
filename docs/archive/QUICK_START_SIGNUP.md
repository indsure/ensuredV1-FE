# Quick Start: Agent Signup with Approval

## What's New?

Users can now sign up for agent accounts at the login page. All signups require approval from nikhil@indsure.in.

## Setup (One-Time)

### 1. Run the Database Migration

```bash
# Connect to your PostgreSQL database and run:
psql -d your_database_name -f setup_signup_approval.sql
```

Or manually execute the SQL file content in your database client.

### 2. Verify Environment Variables

Make sure these are set in `next-api/.env.local`:

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Usage

### For Users (Agents Requesting Access)

1. Go to `http://127.0.0.1:5412/login`
2. Click "Request Access" link
3. Fill out the signup form:
   - Name
   - Email
   - Phone
   - City
   - Years of Experience
   - Password
4. Submit and wait for approval email

### For Admin (nikhil@indsure.in)

#### Option 1: Via Admin Dashboard
1. Log in as admin
2. Navigate to `/admin/signup-requests`
3. Review pending requests
4. Click "Approve" or "Reject"

#### Option 2: Via Database (Quick)
```sql
-- View pending requests
SELECT id, name, email, phone, city, years_experience, created_at 
FROM agent_signup_requests 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- To manually approve (requires running the full approval logic via API)
-- Use the admin dashboard instead for proper account creation
```

## Testing

### Test Signup Flow

1. **Submit a test signup request:**
   ```
   URL: http://127.0.0.1:5412/signup
   Name: Test Agent
   Email: test@example.com
   Phone: +91 98765 43210
   City: Mumbai
   Experience: 3
   Password: testpass123
   ```

2. **Check the database:**
   ```sql
   SELECT * FROM agent_signup_requests WHERE email = 'test@example.com';
   ```

3. **Check notifications:**
   ```sql
   SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;
   ```

4. **Approve via admin dashboard:**
   - Login as admin
   - Go to `/admin/signup-requests`
   - Approve the test request

5. **Verify agent created:**
   ```sql
   SELECT * FROM agents WHERE email = 'test@example.com';
   ```

6. **Test login:**
   - Go to `/login`
   - Use test@example.com / testpass123

## Notifications

Currently, email notifications are **logged to the console** and stored in the `notifications` table.

To see notifications during development:
- Check the terminal where `next-api` is running
- Look for "=== APPROVAL NOTIFICATION ===" or "=== APPROVAL EMAIL ==="

### Production Email Setup

For production, integrate an email service:

1. Install email package (e.g., `npm install @sendgrid/mail`)
2. Update email functions in:
   - `next-api/src/app/api/auth/signup/route.ts`
   - `next-api/src/app/api/admin/signup-requests/[id]/approve/route.ts`
   - `next-api/src/app/api/admin/signup-requests/[id]/reject/route.ts`

## Troubleshooting

### "Table does not exist" error
Run the migration: `psql -d your_db -f setup_signup_approval.sql`

### "Unauthorized" when accessing admin page
Make sure you're logged in as an admin user (role = 'admin')

### Signup request not appearing
Check:
1. Database connection is working
2. `agent_signup_requests` table exists
3. Console for error messages

### Approval fails
Check:
1. Supabase service role key is correct
2. `agents` table has required columns
3. Console logs for detailed error

## API Endpoints Reference

```
POST   /api/auth/signup                              - Submit signup request
GET    /api/admin/signup-requests?status=pending     - List requests (admin)
POST   /api/admin/signup-requests/:id/approve        - Approve request (admin)
POST   /api/admin/signup-requests/:id/reject         - Reject request (admin)
```

## Security Notes

- Passwords are stored temporarily in `agent_signup_requests` until approval
- After approval, Supabase handles password hashing
- Only admins can approve/reject requests
- Email validation prevents duplicate signups
- Minimum password length: 8 characters

## Next Steps

1. ✅ Run database migration
2. ✅ Test signup flow
3. ✅ Test approval flow
4. ⏳ Integrate email service (production)
5. ⏳ Customize email templates
6. ⏳ Add more validation rules (optional)

## Support

For issues or questions, contact: nikhil@indsure.in
