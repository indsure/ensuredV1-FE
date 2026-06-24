import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ADMIN_EMAIL = "nikhil@indsure.in";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone, city, yearsExperience } = await req.json();

    // Validation
    if (!name || !email || !password || !phone || !city) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: "Authentication not configured" }, { status: 500 });
    }

    // Check if email already exists in pending requests
    const existingRequest = await pool.query(
      "SELECT id FROM agent_signup_requests WHERE email = $1 AND status = 'pending'",
      [email]
    );

    if (existingRequest.rows.length > 0) {
      return NextResponse.json(
        { error: "A signup request with this email is already pending approval" },
        { status: 400 }
      );
    }

    // Check if agent already exists
    const existingAgent = await pool.query(
      "SELECT id FROM agents WHERE email = $1",
      [email]
    );

    if (existingAgent.rows.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Create signup request in database
    const result = await pool.query(
      `INSERT INTO agent_signup_requests
       (name, email, password_hash, phone, city, years_experience, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
       RETURNING id`,
      [name, email, passwordHash, phone, city, yearsExperience || 0]
    );

    const requestId = result.rows[0].id;

    // Send notification email to admin
    try {
      await sendApprovalNotification({
        requestId,
        name,
        email,
        phone,
        city,
        yearsExperience: yearsExperience || 0,
      });
    } catch (emailError) {
      console.error("Failed to send approval notification:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Signup request submitted successfully. You will be notified once approved.",
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: err.message || "Signup failed" }, { status: 500 });
  }
}

async function sendApprovalNotification(data: {
  requestId: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  yearsExperience: number;
}) {
  // In a production environment, you would integrate with an email service like SendGrid, AWS SES, etc.
  // For now, we'll log the notification and store it in the database
  
  const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/signup-requests/${data.requestId}`;
  
  const emailContent = `
New Agent Signup Request

Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone}
City: ${data.city}
Years of Experience: ${data.yearsExperience}

To approve or reject this request, visit:
${approvalUrl}

Or use the admin dashboard to manage signup requests.
  `;

  console.log("=== APPROVAL NOTIFICATION ===");
  console.log(`To: ${ADMIN_EMAIL}`);
  console.log(`Subject: New Agent Signup Request - ${data.name}`);
  console.log(emailContent);
  console.log("============================");

  // Store notification in database for admin to see
  await pool.query(
    `INSERT INTO email_notifications (recipient_email, subject, content, type, created_at) 
     VALUES ($1, $2, $3, 'signup_request', NOW())`,
    [
      ADMIN_EMAIL,
      `New Agent Signup Request - ${data.name}`,
      emailContent,
    ]
  );
}
