import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin"]);

    const { id } = await params;
    const { reason } = await req.json();

    // Get the signup request
    const requestResult = await pool.query(
      "SELECT * FROM agent_signup_requests WHERE id = $1 AND status = 'pending'",
      [id]
    );

    if (requestResult.rows.length === 0) {
      return NextResponse.json({ error: "Signup request not found or already processed" }, { status: 404 });
    }

    const request = requestResult.rows[0];

    // Update signup request status
    await pool.query(
      `UPDATE agent_signup_requests 
       SET status = 'rejected', approved_at = NOW(), approved_by = $1, rejection_reason = $2 
       WHERE id = $3`,
      [auth.user.id, reason || "Not specified", id]
    );

    // Send rejection notification to user
    try {
      await sendRejectionEmail(request.email, request.name, reason);
    } catch (emailError) {
      console.error("Failed to send rejection email:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Signup request rejected",
    });
  } catch (err: any) {
    console.error("Rejection error:", err);
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function sendRejectionEmail(email: string, name: string, reason?: string) {
  const emailContent = `
Hello ${name},

Thank you for your interest in joining IndSure as an agent.

Unfortunately, we are unable to approve your account request at this time.

${reason ? `Reason: ${reason}` : ""}

If you have any questions, please contact us at nikhil@indsure.in.

Best regards,
IndSure Team
  `;

  console.log("=== REJECTION EMAIL ===");
  console.log(`To: ${email}`);
  console.log(`Subject: IndSure Agent Account Request Update`);
  console.log(emailContent);
  console.log("=======================");

  // Store notification in database
  await pool.query(
    `INSERT INTO email_notifications (recipient_email, subject, content, type, created_at) 
     VALUES ($1, $2, $3, 'account_rejected', NOW())`,
    [email, "IndSure Agent Account Request Update", emailContent]
  );
}
