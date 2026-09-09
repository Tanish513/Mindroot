import path from 'path';
import dotenv from 'dotenv';

// Load both root .env and server .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { sendTestEmail, getEmailServiceStatus, verifyEmailTransporter } from '../lib/email';

async function main() {
  console.log('\n======================================================');
  console.log('   MINDROOT PLATFORM - EMAIL GATEWAY DIAGNOSTIC TOOL  ');
  console.log('======================================================\n');

  const status = getEmailServiceStatus();
  console.log('📊 Active Email Configuration:');
  console.log(`   - Provider:          ${status.provider.toUpperCase()}`);
  console.log(`   - SMTP Host:         ${status.smtpHost}`);
  console.log(`   - SMTP User:         ${status.smtpUser || '(none)'}`);
  console.log(`   - SMTP From:         ${status.smtpFromEmail}`);
  console.log(`   - Resend Configured: ${status.resendConfigured ? 'Yes' : 'No'}`);
  console.log(`   - Resend From:       ${status.resendFromEmail}`);
  console.log(`   - Frontend URL:      ${status.frontendUrl}`);
  console.log('');

  console.log('🔌 Verifying email transporter connection...');
  const verifyResult = await verifyEmailTransporter();
  if (verifyResult.success) {
    console.log(`✅ ${verifyResult.provider.toUpperCase()} connection verified successfully!\n`);
  } else {
    console.error(`❌ ${verifyResult.provider.toUpperCase()} connection verification failed:`, verifyResult.error);
    console.log('');
  }

  // Determine target recipient
  const targetEmail = process.argv[2] || process.env.SMTP_USER || 'tanisn513@gmail.com';
  console.log(`📨 Dispatched test email to: ${targetEmail}...`);

  const startTime = Date.now();
  const result = await sendTestEmail({ to: targetEmail });
  const elapsedMs = Date.now() - startTime;

  if (result.success) {
    console.log(`\n🎉 Test email delivered successfully in ${elapsedMs}ms!`);
    console.log(`   - Transport Used: ${(result.transport || status.provider).toUpperCase()}`);
    if ((result as any).messageId) {
      console.log(`   - Message ID:     ${(result as any).messageId}`);
    }
    if ((result as any).data?.id) {
      console.log(`   - Resend ID:      ${(result as any).data.id}`);
    }
    console.log('\n👉 Check your inbox at: ' + targetEmail);
  } else {
    console.error(`\n❌ Test email dispatch failed in ${elapsedMs}ms!`);
    console.error('   Details:', result.error);
  }

  console.log('\n======================================================\n');
  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal diagnostic error:', err);
  process.exit(1);
});
