-- Agent Signup Approval System
-- This migration adds tables for managing agent signup requests with approval workflow

-- Create agent_signup_requests table
CREATE TABLE IF NOT EXISTS agent_signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone VARCHAR(50) NOT NULL,
  city VARCHAR(100) NOT NULL,
  years_experience INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES agents(id),
  rejection_reason TEXT
);

-- Create email_notifications table for email tracking (separate from existing notifications table)
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON agent_signup_requests(status);
CREATE INDEX IF NOT EXISTS idx_signup_requests_email ON agent_signup_requests(email);
CREATE INDEX IF NOT EXISTS idx_signup_requests_created_at ON agent_signup_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_notifications_recipient ON email_notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_notifications_sent ON email_notifications(sent);

-- Add comment for documentation
COMMENT ON TABLE agent_signup_requests IS 'Stores agent signup requests pending admin approval';
COMMENT ON TABLE email_notifications IS 'Stores email notifications for signup approvals/rejections';

-- Grant permissions (adjust based on your database user)
-- GRANT SELECT, INSERT, UPDATE ON agent_signup_requests TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON notifications TO your_app_user;
