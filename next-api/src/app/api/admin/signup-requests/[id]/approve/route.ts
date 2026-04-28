import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin"]);

    const { id } = await params;

    if (!supabase) {
      return NextResponse.json({ error: "Authentication not configured" }, { status: 500 });
    }

    // Get the signup request
    const requestResult = await pool.query(
      "SELECT * FROM agent_signup_requests WHERE id = $1 AND status = 'pending'",
      [id]
    );

    if (requestResult.rows.length === 0) {
      return NextResponse.json({ error: "Signup request not found or already processed" }, { status: 404 });
    }

    const request = requestResult.rows[0];

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: request.email,
      password: request.password_hash,
      email_confirm: true, // Auto-confirm email
    });

    if (authError || !authData.user) {
      console.error("Supabase user creation error:", authError);
      return NextResponse.json(
        { error: authError?.message || "Failed to create user account" },
        { status: 500 }
      );
    }

    // Create agent in database
    await pool.query(
      `INSERT INTO agents (id, email, name, role, status, phone, city, years_experience, created_at) 
       VALUES ($1, $2, $3, 'agent', 'active', $4, $5, $6, NOW())`,
      [authData.user.id, request.email, request.name, request.phone, request.city, request.years_experience]
    );

    // Update signup request status
    await pool.query(
      `UPDATE agent_signup_requests 
       SET status = 'approved', approved_at = NOW(), approved_by = $1 
       WHERE id = $2`,
      [auth.user.id, id]
    );

    // Send approval notification to user
    try {
      await sendApprovalEmail(request.email, request.name);
    } catch (emailError) {
      console.error("Failed to send approval email:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Agent account created successfully",
    });
  } catch (err: any) {
    console.error("Approval error:", err);
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function sendApprovalEmail(email: string, name: string) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;
  
  const emailContent = `
Hello ${name},

Your agent account request has been approved! You can now log in to the IndSure Agent Dashboard.

Login URL: ${loginUrl}
Email: ${email}

Welcome to the IndSure team!

Best regards,
IndSure Team
  `;

  console.log("=== APPROVAL EMAIL ===");
  console.log(`To: ${email}`);
  console.log(`Subject: Your IndSure Agent Account Has Been Approved`);
  console.log(emailContent);
  console.log("=====================");

  // Store notification in database
  await pool.query(
    `INSERT INTO email_notifications (recipient_email, subject, content, type, created_at) 
     VALUES ($1, $2, $3, 'account_approved', NOW())`,
    [email, "Your IndSure Agent Account Has Been Approved", emailContent]
  );
}
