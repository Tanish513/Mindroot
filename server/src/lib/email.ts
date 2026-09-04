import { Resend } from 'resend';

const getResendClient = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';
const getFromEmail = () => process.env.EMAIL_FROM || 'Mindroot Learning <onboarding@resend.dev>';

export async function sendVerificationEmail({ to, name, token }: { to: string; name: string; token: string }) {
  const verifyUrl = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const resend = getResendClient();
  
  if (!resend) {
    console.log(`[Email Service - Dev Mode] Verification email to ${to}: ${verifyUrl}`);
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: [to],
      subject: 'Verify your Mindroot Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 16px;">
          <h2 style="color: #2563eb; margin-bottom: 16px;">Welcome to Mindroot, ${name}!</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Thank you for creating your account. Please click the button below to verify your email address and activate your peer learning features:
          </p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-weight: bold; border-radius: 8px; text-decoration: none; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px;">
            Or copy and paste this link into your browser: <br/>
            <a href="${verifyUrl}" style="color: #2563eb;">${verifyUrl}</a>
          </p>
          <p style="color: #94a3b8; font-size: 11px; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            This link will expire in 24 hours. If you did not create a Mindroot account, please ignore this email.
          </p>
        </div>
      `
    });

    if (error) {
      console.error('[Resend Error] Failed to send verification email:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[Email Error] Verification email exception:', err);
    return { success: false, error: err };
  }
}

export async function sendPasswordResetEmail({ to, name, token }: { to: string; name: string; token: string }) {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const resend = getResendClient();
  
  if (!resend) {
    console.log(`[Email Service - Dev Mode] Password reset email to ${to}: ${resetUrl}`);
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: [to],
      subject: 'Reset your Mindroot Account Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 16px;">
          <h2 style="color: #2563eb; margin-bottom: 16px;">Password Reset Request</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Hello ${name}, we received a request to reset your Mindroot account password. Click the button below to choose a new password:
          </p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${resetUrl}" style="background-color: #f59e0b; color: #ffffff; padding: 12px 24px; font-weight: bold; border-radius: 8px; text-decoration: none; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px;">
            Or copy and paste this link into your browser: <br/>
            <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
          </p>
          <p style="color: #94a3b8; font-size: 11px; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            This link is valid for 60 minutes. If you did not request a password reset, your account is safe and you can safely ignore this email.
          </p>
        </div>
      `
    });

    if (error) {
      console.error('[Resend Error] Failed to send reset email:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[Email Error] Reset email exception:', err);
    return { success: false, error: err };
  }
}

export async function sendPaymentReceiptEmail({
  to,
  name,
  amount,
  sessionId,
  title
}: {
  to: string;
  name: string;
  amount: number;
  sessionId: string;
  title: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[Email Service - Dev Mode] Payment receipt email to ${to}: ₹${amount} for session ${sessionId}`);
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: [to],
      subject: `Payment Receipt: ₹${amount} - Mindroot Lecture`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 16px;">
          <h2 style="color: #10b981; margin-bottom: 16px;">Payment Confirmed!</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Hi ${name}, your Razorpay payment of <strong>₹${amount}</strong> for <strong>"${title}"</strong> was successfully completed.
          </p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; font-size: 13px; color: #475569;">
            <p style="margin: 4px 0;"><strong>Session ID:</strong> ${sessionId}</p>
            <p style="margin: 4px 0;"><strong>Amount Paid:</strong> ₹${amount} INR</p>
            <p style="margin: 4px 0;"><strong>Payment Method:</strong> Razorpay Secure Gateway</p>
          </div>
          <p style="color: #64748b; font-size: 12px;">
            Thank you for choosing Mindroot for peer mentoring!
          </p>
        </div>
      `
    });

    if (error) {
      console.error('[Resend Error] Failed to send receipt email:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[Email Error] Receipt email exception:', err);
    return { success: false, error: err };
  }
}

export async function sendBookingNotificationEmail({
  to,
  name,
  title,
  scheduledAt,
  status
}: {
  to: string;
  name: string;
  title: string;
  scheduledAt: string;
  status: 'pending' | 'confirmed' | 'rejected';
}) {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[Email Service - Dev Mode] Booking notification to ${to}: "${title}" - status ${status}`);
    return { success: true, simulated: true };
  }

  const statusText = status === 'confirmed' ? 'Confirmed' : status === 'rejected' ? 'Declined' : 'Scheduled';

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: [to],
      subject: `Session Update: "${title}" is ${statusText}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 16px;">
          <h2 style="color: #2563eb; margin-bottom: 16px;">Session Update</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Hello ${name}, your session <strong>"${title}"</strong> scheduled for <strong>${scheduledAt}</strong> has been updated to: <strong>${statusText}</strong>.
          </p>
          <div style="margin: 20px 0;">
            <a href="${getFrontendUrl()}/schedule" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; font-weight: bold; border-radius: 8px; text-decoration: none; display: inline-block;">
              View Schedule
            </a>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('[Resend Error] Failed to send booking email:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[Email Error] Booking email exception:', err);
    return { success: false, error: err };
  }
}

export async function sendPayoutConfirmationEmail({
  to,
  name,
  amount,
  transactionId
}: {
  to: string;
  name: string;
  amount: number;
  transactionId: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[Email Service - Dev Mode] Payout confirmation to ${to}: ₹${amount}`);
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: [to],
      subject: `Withdrawal Processing: ₹${amount} Sent`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 16px;">
          <h2 style="color: #10b981; margin-bottom: 16px;">Payout Initiated!</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Hi ${name}, your payout request of <strong>₹${amount}</strong> (Tx ID: ${transactionId}) has been processed and initiated to your registered bank / UPI account.
          </p>
        </div>
      `
    });

    if (error) {
      console.error('[Resend Error] Failed to send payout email:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[Email Error] Payout email exception:', err);
    return { success: false, error: err };
  }
}

export async function sendTestEmail({ to }: { to: string }) {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: 'RESEND_API_KEY is not configured in server environment variables.' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: [to],
      subject: 'Mindroot - Resend Email Integration Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin: 0;">Mindroot</h1>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Peer-to-Peer Learning & Mentorship</p>
          </div>
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <h3 style="color: #065f46; margin: 0 0 6px 0;">🎉 Resend Email Connected Successfully!</h3>
            <p style="color: #047857; font-size: 13px; margin: 0;">
              Your Mindroot server can now reliably deliver verification emails, session booking notices, Razorpay receipts, and password reset links.
            </p>
          </div>
          <p style="color: #475569; font-size: 12px; line-height: 1.6;">
            <strong>Sender:</strong> ${getFromEmail()}<br/>
            <strong>Recipient:</strong> ${to}<br/>
            <strong>Timestamp:</strong> ${new Date().toISOString()}
          </p>
        </div>
      `
    });

    if (error) {
      console.error('[Resend Error] Test email failed:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err: any) {
    console.error('[Email Error] Test email exception:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

