import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';

let cachedSmtpTransporter: Transporter | null = null;

const getSmtpTransporter = (): Transporter | null => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  if (!cachedSmtpTransporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const isSecure = process.env.SMTP_SECURE !== undefined 
      ? process.env.SMTP_SECURE === 'true' 
      : port === 465;

    cachedSmtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user,
        pass: pass.replace(/\s+/g, ''), // support Google 16-char App Password with spaces
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000,
    });
  }
  return cachedSmtpTransporter;
};

const getResendClient = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

export const getEmailProvider = (): 'smtp' | 'resend' | 'simulated' => {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp';
  if (process.env.RESEND_API_KEY) return 'resend';
  return 'simulated';
};

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const getSmtpFromEmail = (): string => {
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  if (process.env.SMTP_USER) return `Mindroot Learning <${process.env.SMTP_USER}>`;
  return 'Mindroot Learning <tanisn513@gmail.com>';
};

const getResendFromEmail = (): string => {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  return 'Mindroot Learning <onboarding@resend.dev>';
};

const getFromEmail = (): string => {
  const provider = getEmailProvider();
  if (provider === 'smtp') return getSmtpFromEmail();
  return getResendFromEmail();
};

export async function verifyEmailTransporter(): Promise<{ success: boolean; provider: string; error?: string }> {
  const provider = getEmailProvider();
  if (provider === 'smtp') {
    const transporter = getSmtpTransporter();
    if (!transporter) {
      return { success: false, provider: 'smtp', error: 'SMTP credentials missing (SMTP_USER or SMTP_PASS)' };
    }
    try {
      await transporter.verify();
      return { success: true, provider: 'smtp' };
    } catch (err: any) {
      return { success: false, provider: 'smtp', error: err.message || String(err) };
    }
  }

  if (provider === 'resend') {
    const resend = getResendClient();
    if (!resend) {
      return { success: false, provider: 'resend', error: 'RESEND_API_KEY missing' };
    }
    try {
      await resend.apiKeys.list();
      return { success: true, provider: 'resend' };
    } catch (err: any) {
      return { success: false, provider: 'resend', error: err.message || String(err) };
    }
  }

  return { success: true, provider: 'simulated' };
}

export function getEmailServiceStatus() {
  const provider = getEmailProvider();
  return {
    provider,
    smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpUser: process.env.SMTP_USER || null,
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    fromEmail: getFromEmail(),
    smtpFromEmail: getSmtpFromEmail(),
    resendFromEmail: getResendFromEmail(),
    frontendUrl: getFrontendUrl()
  };
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendMailResult {
  success: boolean;
  transport?: string;
  simulated?: boolean;
  error?: any;
  data?: any;
  messageId?: string;
}

export async function sendMail({ to, subject }: SendMailOptions): Promise<SendMailResult> {
  // Completely simulated mode: zero network overhead, zero port blocking, zero domain restrictions
  console.log(`[Email Service - Simulated] 📢 Notification generated for ${to}: "${subject}"`);
  return { success: true, transport: 'simulated', simulated: true };
}

export async function sendVerificationEmail({ to, name, token }: { to: string; name: string; token: string }) {
  const verifyUrl = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  
  console.log(`\n🔗 [Direct Verification Link]: ${verifyUrl}\n`);

  return sendMail({
    to,
    subject: 'Verify your Mindroot Email Address',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Mindroot</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Skill Exchange & Peer-to-Peer Learning</p>
        </div>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <h2 style="color: #166534; margin: 0 0 8px 0; font-size: 18px;">Welcome to Mindroot, ${name}! 👋</h2>
          <p style="color: #15803d; font-size: 14px; line-height: 1.5; margin: 0;">
            Thank you for creating your account. Please click the button below to verify your email address and activate your interactive whiteboard, LiveKit classrooms, and peer mentoring sessions.
          </p>
        </div>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${verifyUrl}" style="background-color: #0d9488; color: #ffffff; padding: 14px 28px; font-weight: 700; font-size: 15px; border-radius: 10px; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(13, 148, 136, 0.2);">
            Verify Email Address
          </a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.6;">
          Or copy and paste this link into your browser: <br/>
          <a href="${verifyUrl}" style="color: #0d9488; word-break: break-all;">${verifyUrl}</a>
        </p>
        <p style="color: #94a3b8; font-size: 11px; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
          This link will expire in 24 hours. If you did not create a Mindroot account, you can safely ignore this email.
        </p>
      </div>
    `
  });
}

export async function sendPasswordResetEmail({ to, name, token }: { to: string; name: string; token: string }) {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  console.log(`\n🔑 [Password Reset Link]: ${resetUrl}\n`);

  return sendMail({
    to,
    subject: 'Reset your Mindroot Account Password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">Mindroot</h1>
        </div>
        <h2 style="color: #0f172a; margin-bottom: 12px; font-size: 18px;">Password Reset Request</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Hello ${name}, we received a request to reset the password for your Mindroot account. Click the button below to choose a new password:
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${resetUrl}" style="background-color: #f59e0b; color: #ffffff; padding: 13px 26px; font-weight: 700; font-size: 14px; border-radius: 10px; text-decoration: none; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.6;">
          Or copy and paste this link: <br/>
          <a href="${resetUrl}" style="color: #f59e0b; word-break: break-all;">${resetUrl}</a>
        </p>
        <p style="color: #94a3b8; font-size: 11px; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
          This link expires in 60 minutes. If you did not request this, your account is secure and you can ignore this email.
        </p>
      </div>
    `
  });
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
  return sendMail({
    to,
    subject: `Payment Receipt: ₹${amount} - Mindroot Lecture`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">Mindroot</h1>
        </div>
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <h2 style="color: #065f46; margin: 0 0 6px 0; font-size: 18px;">Payment Confirmed! ✅</h2>
          <p style="color: #047857; font-size: 14px; margin: 0;">
            Hi ${name}, your Razorpay payment of <strong>₹${amount}</strong> for <strong>"${title}"</strong> was successfully completed.
          </p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 10px; margin: 18px 0; font-size: 13px; color: #475569; border: 1px solid #e2e8f0;">
          <p style="margin: 6px 0;"><strong>Session ID:</strong> ${sessionId}</p>
          <p style="margin: 6px 0;"><strong>Amount Paid:</strong> ₹${amount} INR</p>
          <p style="margin: 6px 0;"><strong>Gateway:</strong> Razorpay Instant Settlement</p>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${getFrontendUrl()}/schedule" style="background-color: #0d9488; color: #ffffff; padding: 11px 22px; font-weight: 700; font-size: 14px; border-radius: 8px; text-decoration: none; display: inline-block;">
            View Your Schedule
          </a>
        </div>
      </div>
    `
  });
}

export async function sendBookingNotificationEmail({
  to,
  name,
  title,
  scheduledAt,
  status,
  sessionId,
  peerName,
  peerRole = 'Learner'
}: {
  to: string;
  name: string;
  title: string;
  scheduledAt: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'declined';
  sessionId?: string;
  peerName?: string;
  peerRole?: string;
}) {
  const isConfirmed = status === 'confirmed';
  const isPending = status === 'pending';
  const statusLabel = isConfirmed ? 'Confirmed ✅' : isPending ? 'Requested / Pending ⏳' : 'Declined ❌';
  const badgeColor = isConfirmed ? '#10b981' : isPending ? '#f59e0b' : '#ef4444';
  const classroomUrl = sessionId ? `${getFrontendUrl()}/classroom/${sessionId}` : `${getFrontendUrl()}/schedule`;

  const formattedDate = new Date(scheduledAt).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short'
  });

  return sendMail({
    to,
    subject: `Session Update: "${title}" is ${isConfirmed ? 'Confirmed' : isPending ? 'Scheduled' : 'Updated'}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">Mindroot</h1>
        </div>
        <div style="padding: 18px; border-radius: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 20px;">
          <div style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; margin-bottom: 12px;">
            ${statusLabel}
          </div>
          <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 19px;">${title}</h2>
          <p style="color: #334155; font-size: 14px; margin: 0 0 8px 0;">
            Hello <strong>${name}</strong>, your peer mentorship session has been updated.
          </p>
          ${peerName ? `<p style="color: #475569; font-size: 13px; margin: 0 0 6px 0;"><strong>${peerRole}:</strong> ${peerName}</p>` : ''}
          <p style="color: #475569; font-size: 13px; margin: 0;"><strong>Time:</strong> ${formattedDate}</p>
        </div>

        <div style="text-align: center; margin: 26px 0;">
          <a href="${isConfirmed ? classroomUrl : `${getFrontendUrl()}/schedule`}" style="background-color: #0d9488; color: #ffffff; padding: 13px 26px; font-weight: 700; font-size: 14px; border-radius: 10px; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(13, 148, 136, 0.2);">
            ${isConfirmed ? 'Go to Live Classroom' : 'View In Schedule'}
          </a>
        </div>

        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
          Mindroot Peer-to-Peer Learning Platform
        </p>
      </div>
    `
  });
}

export async function sendScheduleChangeEmail({
  to,
  name,
  title,
  oldScheduledAt,
  newScheduledAt,
  status = 'rescheduled',
  sessionId,
  reason
}: {
  to: string;
  name: string;
  title: string;
  oldScheduledAt?: string;
  newScheduledAt: string;
  status?: string;
  sessionId?: string;
  reason?: string;
}) {
  const scheduleUrl = sessionId ? `${getFrontendUrl()}/classroom/${sessionId}` : `${getFrontendUrl()}/schedule`;
  
  const formattedNew = new Date(newScheduledAt).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const formattedOld = oldScheduledAt ? new Date(oldScheduledAt).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short'
  }) : null;

  return sendMail({
    to,
    subject: `📅 Schedule Update: "${title}" time modified`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">Mindroot</h1>
        </div>
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin: 0 0 8px 0; font-size: 18px;">Schedule Change Alert</h2>
          <p style="color: #1e3a8a; font-size: 14px; margin: 0;">
            Hello ${name}, the timing for <strong>"${title}"</strong> has been updated.
          </p>
        </div>

        <div style="background-color: #f8fafc; padding: 16px; border-radius: 10px; margin-bottom: 20px; font-size: 13px; color: #334155; border: 1px solid #e2e8f0;">
          ${formattedOld ? `<p style="margin: 4px 0; color: #64748b; text-decoration: line-through;"><strong>Previous Time:</strong> ${formattedOld}</p>` : ''}
          <p style="margin: 6px 0; color: #0f172a; font-size: 14px;"><strong>👉 New Time:</strong> <span style="color: #0d9488; font-weight: 700;">${formattedNew}</span></p>
          ${reason ? `<p style="margin: 8px 0 0 0; color: #475569; font-style: italic;"><strong>Note:</strong> ${reason}</p>` : ''}
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${scheduleUrl}" style="background-color: #0d9488; color: #ffffff; padding: 12px 24px; font-weight: 700; font-size: 14px; border-radius: 10px; text-decoration: none; display: inline-block;">
            View Updated Schedule
          </a>
        </div>
      </div>
    `
  });
}

export async function sendSessionReminderEmail({
  to,
  name,
  role = 'Learner',
  title,
  scheduledAt,
  sessionId,
  peerName
}: {
  to: string;
  name: string;
  role?: string;
  title: string;
  scheduledAt: string;
  sessionId: string;
  peerName?: string;
}) {
  const classroomUrl = `${getFrontendUrl()}/classroom/${sessionId}`;
  const formattedTime = new Date(scheduledAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return sendMail({
    to,
    subject: `⏰ Reminder: "${title}" starts soon at ${formattedTime}!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">Mindroot</h1>
          <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Live Peer Mentoring</p>
        </div>
        
        <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 18px; margin-bottom: 22px;">
          <span style="background-color: #d97706; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
            Starting Soon
          </span>
          <h2 style="color: #92400e; margin: 10px 0 6px 0; font-size: 20px;">${title}</h2>
          <p style="color: #b45309; font-size: 14px; margin: 0;">
            Hi ${name}! Your peer session is scheduled to start at <strong>${formattedTime}</strong>.
          </p>
          ${peerName ? `<p style="color: #78350f; font-size: 13px; margin: 6px 0 0 0;">You'll be meeting with: <strong>${peerName}</strong> (${role === 'Mentor' ? 'Student' : 'Mentor'})</p>` : ''}
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #475569;">
          <p style="margin: 0 0 6px 0;"><strong>💡 Quick Preparation Tips:</strong></p>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
            <li>Check your microphone and camera ahead of time.</li>
            <li>Use the collaborative whiteboard & code editor in the room.</li>
            <li>Feel free to ask questions or share notes in real-time.</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${classroomUrl}" style="background-color: #0d9488; color: #ffffff; padding: 14px 32px; font-weight: 800; font-size: 16px; border-radius: 10px; text-decoration: none; display: inline-block; box-shadow: 0 4px 10px rgba(13, 148, 136, 0.3);">
            🚀 Enter Live Classroom
          </a>
        </div>

        <p style="color: #64748b; font-size: 12px; text-align: center;">
          Or open this link directly: <br/>
          <a href="${classroomUrl}" style="color: #0d9488; word-break: break-all;">${classroomUrl}</a>
        </p>
      </div>
    `
  });
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
  return sendMail({
    to,
    subject: `Withdrawal Processing: ₹${amount} Sent`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <h2 style="color: #10b981; margin-bottom: 16px;">Payout Initiated!</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Hi ${name}, your payout request of <strong>₹${amount}</strong> (Tx ID: ${transactionId}) has been processed and initiated to your registered bank / UPI account.
        </p>
      </div>
    `
  });
}

export async function sendTestEmail({ to }: { to: string }) {
  const status = getEmailServiceStatus();

  return sendMail({
    to,
    subject: `Mindroot - Mailing System Diagnostic Test (${status.provider.toUpperCase()})`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0d9488; margin: 0;">Mindroot</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Mailing System Diagnostic Verification</p>
        </div>
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <h3 style="color: #065f46; margin: 0 0 6px 0;">🎉 Mailing Gateway Connected Successfully!</h3>
          <p style="color: #047857; font-size: 13px; margin: 0;">
            Your Mindroot server can reliably deliver verification emails, schedule updates, 15-minute lecture reminders, and Razorpay receipts!
          </p>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; font-size: 12px; color: #475569; line-height: 1.8;">
          <strong>Active Gateway:</strong> <span style="text-transform: uppercase; font-weight: 700; color: #0d9488;">${status.provider}</span><br/>
          <strong>Sender:</strong> ${status.fromEmail}<br/>
          <strong>Recipient:</strong> ${to}<br/>
          <strong>Timestamp:</strong> ${new Date().toISOString()}
        </div>
      </div>
    `
  });
}

