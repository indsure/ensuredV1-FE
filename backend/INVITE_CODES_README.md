# Invite Codes Management

## Overview

The IndSure platform supports two types of invite codes:

1. **Single-use codes** - Can only be used once (legacy behavior)
2. **Multi-use codes** - Can be used multiple times (new feature)

## Database Schema

The `invite_codes` table has the following columns:

- `code` - The invite code string (unique)
- `is_active` - Whether the code is currently active
- `used_by` - User ID who used the code (for single-use codes)
- `used_at` - Timestamp of last use
- `max_uses` - Maximum number of times the code can be used (NULL = unlimited)
- `current_uses` - Current number of times the code has been used

## Scripts

### 1. Create a New Reusable Invite Code

```bash
# Create code with unlimited uses
node backend/create_reusable_invite.mjs INDSURE2026 unlimited

# Create code with 10 uses
node backend/create_reusable_invite.mjs INDSURE2026 10

# Create code with 50 uses
node backend/create_reusable_invite.mjs WELCOME2026 50
```

### 2. Reactivate an Existing Code

If you have an expired or used code that you want to make reusable:

```bash
# Make existing code reusable with unlimited uses
node backend/reactivate_invite.mjs INDSURE-TESTING unlimited

# Make existing code reusable with 5 uses
node backend/reactivate_invite.mjs INDSURE-TESTING 5
```

### 3. Check Current Invite Codes

You can check invite codes via the admin panel or directly in the database:

```sql
SELECT 
  code, 
  is_active, 
  max_uses, 
  current_uses,
  CASE 
    WHEN max_uses IS NULL THEN 'Unlimited'
    ELSE (max_uses - current_uses)::text || ' remaining'
  END as status,
  used_at
FROM invite_codes
ORDER BY created_at DESC;
```

## How It Works

### Single-Use Codes (Legacy)
- `max_uses` is NULL
- `used_by` is NULL initially
- After first use: `used_by` is set, `is_active` becomes false
- Cannot be used again

### Multi-Use Codes (New)
- `max_uses` is set to a number (e.g., 10) or NULL for unlimited
- `current_uses` tracks how many times it's been used
- After each use: `current_uses` increments
- Code remains active until `current_uses >= max_uses`
- For unlimited codes (`max_uses = NULL`), code never expires

## Signup Flow

When a user signs up:

1. System checks if code exists and is active
2. For single-use codes: checks if `used_by` is NULL
3. For multi-use codes: checks if `current_uses < max_uses`
4. If valid, creates user account
5. Updates code:
   - Single-use: sets `used_by`, marks inactive
   - Multi-use: increments `current_uses`

## Quick Start

To create a code for testing right now:

```bash
# Option 1: Create new unlimited code
node backend/create_reusable_invite.mjs INDSURE2026 unlimited

# Option 2: Reactivate existing code
node backend/reactivate_invite.mjs INDSURE-TESTING unlimited
```

Then share the code with advisors: **INDSURE2026** or **INDSURE-TESTING**

## Admin Panel

Admins can also manage invite codes through the admin panel at:
- `/admin` → Invite Codes section
- View all codes, their usage stats, and create new ones

## Troubleshooting

### "Invalid or inactive invite code" error

Check:
1. Is the code spelled correctly? (case-insensitive)
2. Is `is_active = true`?
3. For multi-use codes: Is `current_uses < max_uses`?

### "This invite code has already been used" error

This means it's a single-use code that's been used. Run:

```bash
node backend/reactivate_invite.mjs YOUR-CODE unlimited
```

### Database columns missing

If you get errors about `max_uses` or `current_uses` columns, the scripts will automatically add them. Or run manually:

```sql
ALTER TABLE invite_codes 
ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_uses INTEGER DEFAULT 0;
```

## Examples

### Create a code for a workshop (50 attendees)
```bash
node backend/create_reusable_invite.mjs WORKSHOP2026 50
```

### Create a code for beta testers (unlimited)
```bash
node backend/create_reusable_invite.mjs BETA2026 unlimited
```

### Reactivate an old code for 10 more uses
```bash
node backend/reactivate_invite.mjs OLDCODE 10
```

## Security Notes

- Invite codes are case-insensitive (stored as uppercase)
- Codes should be shared securely (not posted publicly)
- Monitor usage through admin panel
- Deactivate codes if compromised: `UPDATE invite_codes SET is_active = false WHERE code = 'COMPROMISED'`
