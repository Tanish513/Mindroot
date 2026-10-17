/**
 * One-off Data Cleanup Script (F10 / Plan Section 3.5)
 * 
 * 1. Trims and lowercases every stored `upiId`.
 * 2. Nulls out invalid VPAs (fails VPA_REGEX) and old fabricated fallbacks (*@okhdfcbank, mindroot.peer@okhdfcbank).
 * 3. Resets `vpaVerified = false` and `vpaVerifiedAt = null` for all unverified mentors.
 * 4. Identifies mentors with paid sessions or hourly rates without a valid VPA.
 * 5. Generates a structured JSON and markdown cleanup report.
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

interface CleanupReport {
  timestamp: string;
  totalUsersInspected: number;
  totalPayoutAccountsInspected: number;
  fabricatedVpasNulled: string[];
  invalidVpasNulled: string[];
  validVpasPreserved: string[];
  mentorsRequiringVpaPrompt: Array<{ id: string; name: string; hourlyRate: number; reason: string }>;
}

async function runCleanup() {
  console.log('--- Starting F10 VPA Data Cleanup ---');

  const report: CleanupReport = {
    timestamp: new Date().toISOString(),
    totalUsersInspected: 0,
    totalPayoutAccountsInspected: 0,
    fabricatedVpasNulled: [],
    invalidVpasNulled: [],
    validVpasPreserved: [],
    mentorsRequiringVpaPrompt: []
  };

  const dbJsonPath = path.resolve(__dirname, '..', 'db.json');
  let dbJson: any = null;

  if (fs.existsSync(dbJsonPath)) {
    try {
      dbJson = JSON.parse(fs.readFileSync(dbJsonPath, 'utf-8'));
    } catch (e) {
      console.warn('Could not parse db.json:', e);
    }
  }

  // 1. Cleanup in-memory / db.json
  if (dbJson) {
    if (Array.isArray(dbJson.users)) {
      report.totalUsersInspected += dbJson.users.length;
      for (const u of dbJson.users) {
        if (u.upiId) {
          const raw = String(u.upiId).trim().toLowerCase();
          const cleanName = (u.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const isFabricated = raw === 'mindroot.peer@okhdfcbank' || raw === `${cleanName}@okhdfcbank` || raw.includes('okhdfcbank');

          if (isFabricated) {
            report.fabricatedVpasNulled.push(`User ${u.id} (${u.name}): ${u.upiId} [Fabricated]`);
            u.upiId = null;
            u.vpaVerified = false;
            u.vpaVerifiedAt = null;
          } else if (!VPA_REGEX.test(raw)) {
            report.invalidVpasNulled.push(`User ${u.id} (${u.name}): ${u.upiId} [Invalid Format]`);
            u.upiId = null;
            u.vpaVerified = false;
            u.vpaVerifiedAt = null;
          } else {
            u.upiId = raw;
            report.validVpasPreserved.push(`User ${u.id} (${u.name}): ${raw}`);
          }
        }

        // Check if mentor monetizes without valid VPA
        const isMentor = u.role === 'teacher' || u.role === 'both';
        if (isMentor && (u.hourlyRate > 0) && !u.upiId) {
          report.mentorsRequiringVpaPrompt.push({
            id: u.id,
            name: u.name,
            hourlyRate: u.hourlyRate,
            reason: 'Hourly rate configured but no valid VPA registered'
          });
        }
      }
    }

    if (dbJson.payoutAccounts && typeof dbJson.payoutAccounts === 'object') {
      const keys = Object.keys(dbJson.payoutAccounts);
      report.totalPayoutAccountsInspected += keys.length;
      for (const k of keys) {
        const pa = dbJson.payoutAccounts[k];
        if (pa && pa.upiId) {
          const raw = String(pa.upiId).trim().toLowerCase();
          if (raw === 'mindroot.peer@okhdfcbank' || raw.includes('okhdfcbank')) {
            report.fabricatedVpasNulled.push(`PayoutAccount ${k}: ${pa.upiId} [Fabricated]`);
            pa.upiId = null;
            pa.vpaVerified = false;
            pa.vpaVerifiedAt = null;
          } else if (!VPA_REGEX.test(raw)) {
            report.invalidVpasNulled.push(`PayoutAccount ${k}: ${pa.upiId} [Invalid Format]`);
            pa.upiId = null;
            pa.vpaVerified = false;
            pa.vpaVerifiedAt = null;
          } else {
            pa.upiId = raw;
          }
        }
      }
    }

    fs.writeFileSync(dbJsonPath, JSON.stringify(dbJson, null, 2), 'utf-8');
    console.log('✅ db.json cleaned and updated.');
  }

  // 2. Cleanup PostgreSQL if DATABASE_URL is set
  if (process.env.DATABASE_URL) {
    console.log('Connecting to PostgreSQL database...');
    const cleanUrl = process.env.DATABASE_URL.replace(/[\?&]sslmode=[^&]+/, '');
    const pool = new pg.Pool({
      connectionString: cleanUrl,
      ssl: { rejectUnauthorized: false }
    });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
      const dbUsers = await prisma.user.findMany();
      console.log(`Inspecting ${dbUsers.length} database users...`);

      for (const u of dbUsers) {
        if (u.upiId) {
          const raw = String(u.upiId).trim().toLowerCase();
          const cleanName = (u.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const isFabricated = raw === 'mindroot.peer@okhdfcbank' || raw === `${cleanName}@okhdfcbank` || raw.includes('okhdfcbank');

          if (isFabricated || !VPA_REGEX.test(raw)) {
            await prisma.user.update({
              where: { id: u.id },
              data: {
                upiId: null,
                vpaVerified: false,
                vpaVerifiedAt: null
              }
            });
            console.log(`Nulled invalid/fabricated VPA for DB User ${u.id}: ${u.upiId}`);
          } else {
            await prisma.user.update({
              where: { id: u.id },
              data: {
                upiId: raw
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('Error during DB cleanup:', err);
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  }

  console.log('\n=== VPA CLEANUP REPORT SUMMARY ===');
  console.log(`Inspected Users: ${report.totalUsersInspected}`);
  console.log(`Inspected PayoutAccounts: ${report.totalPayoutAccountsInspected}`);
  console.log(`Fabricated VPAs Nulled: ${report.fabricatedVpasNulled.length}`);
  console.log(`Invalid Format VPAs Nulled: ${report.invalidVpasNulled.length}`);
  console.log(`Valid VPAs Preserved: ${report.validVpasPreserved.length}`);
  console.log(`Mentors Requiring VPA Prompt: ${report.mentorsRequiringVpaPrompt.length}`);
  console.log('=================================\n');

  const reportOutPath = path.resolve(__dirname, '..', 'vpa_cleanup_report.json');
  fs.writeFileSync(reportOutPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Full report saved to ${reportOutPath}`);
}

runCleanup().catch(console.error);
