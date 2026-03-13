-- Add is_admin and upload_limit to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS upload_limit INTEGER DEFAULT 10;

-- Optional: Set a specific user as admin for testing (replace with your test user's email if needed)
-- UPDATE agents SET is_admin = true WHERE email = 'admin@indsure.com';
