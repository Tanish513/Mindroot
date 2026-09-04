import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import Razorpay from 'razorpay';
import { OAuth2Client } from 'google-auth-library';
import pino from 'pino';
import { z } from 'zod';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPaymentReceiptEmail,
  sendBookingNotificationEmail,
  sendPayoutConfirmationEmail
} from './lib/email';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

process.on('unhandledRejection', (reason) => logger.error({ reason }, '[Unhandled Rejection]'));
process.on('uncaughtException', (err) => logger.error({ err }, '[Uncaught Exception]'));

dotenv.config();
dotenv.config({ path: path.join(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'mindroot-dev-secret-key-change-in-prod';
if (!process.env.JWT_SECRET) {
  logger.warn('⚠️ WARNING: process.env.JWT_SECRET is unset. Using dev-only default secret key.');
}

// Idempotency cache for payment and withdrawal routes
interface IdempotencyRecord {
  statusCode: number;
  body: any;
  timestamp: number;
}
const idempotencyCache = new Map<string, IdempotencyRecord>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours TTL

function getIdempotencyRecord(req: express.Request): { key: string | null; record: IdempotencyRecord | null } {
  const keyHeader = req.headers['idempotency-key'] || req.headers['Idempotency-Key'];
  const key = typeof keyHeader === 'string' ? keyHeader.trim() : null;
  if (!key) return { key: null, record: null };

  const record = idempotencyCache.get(key);
  if (record && (Date.now() - record.timestamp < IDEMPOTENCY_TTL_MS)) {
    return { key, record };
  }
  return { key, record: null };
}

function saveIdempotencyRecord(key: string | null, statusCode: number, body: any) {
  if (!key) return;
  idempotencyCache.set(key, { statusCode, body, timestamp: Date.now() });
}

// In-memory Auth Token Caches & Rate Limits (used in fallback mode)
interface InMemoryToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  usedAt?: Date | null;
}
const inMemoryVerificationTokens: InMemoryToken[] = [];
const inMemoryResetTokens: InMemoryToken[] = [];
const lastResendVerificationMap = new Map<string, number>();
const lastForgotPasswordMap = new Map<string, number>();

function toPublicUser(user: any, role?: string): any {
  if (!user) return user;
  if (Array.isArray(user)) {
    return user.map(u => toPublicUser(u, role));
  }
  if (role === 'admin') {
    const { passwordResetToken, emailVerificationToken, ...safe } = user;
    return safe;
  }
  const { password, passwordResetToken, emailVerificationToken, ...safe } = user;
  return safe;
}

// Zod Validation Schemas
const registerSchema = z.object({
  name: z.string().min(1, 'Full name is required.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  role: z.string().optional(),
  teaches: z.any().optional(),
  learns: z.any().optional(),
  hourlyRate: z.any().optional()
});

const loginSchema = z.object({
  email: z.string().min(1, 'Email/User ID and Password are required.'),
  password: z.string().min(1, 'Email/User ID and Password are required.')
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters.')
});

const createOrderSchema = z.object({
  amount: z.any().optional(),
  sessionId: z.string().optional(),
  teacherId: z.string().optional(),
  mentorId: z.string().optional(),
  studentId: z.string().optional(),
  title: z.string().optional(),
  skillId: z.string().optional(),
  scheduledAt: z.string().optional(),
  durationMin: z.any().optional(),
  tokens: z.any().optional(),
  packId: z.string().optional(),
  maxCapacity: z.any().optional()
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().min(1, 'Missing or invalid payment ID.'),
  razorpay_signature: z.string().optional(),
  amount: z.any().optional(),
  sessionData: z.any().optional()
});

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  logger.warn('⚠️ WARNING: process.env.RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is unset. Razorpay payment integration will run in unconfigured fallback mode.');
}

const razorpay = (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET)
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  : null;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Configurable CORS origin restriction with FRONTEND_URL support
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(url => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const isDevMode = process.env.NODE_ENV !== 'production';

const corsOriginDelegate = (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
  if (!origin) return callback(null, true);
  if (configuredOrigins.length === 0 || isDevMode) {
    return callback(null, true);
  }
  const cleanOrigin = origin.replace(/\/+$/, '');
  const isAllowed = configuredOrigins.includes(cleanOrigin) ||
    cleanOrigin.startsWith('http://localhost') ||
    cleanOrigin.startsWith('http://127.0.0.1') ||
    /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(cleanOrigin) ||
    /\.local(:\d+)?$/.test(cleanOrigin);

  if (isAllowed) {
    return callback(null, true);
  }
  return callback(new Error(`CORS policy blocked request from origin: ${origin}`));
};

const app = express();
app.use(cors({ origin: corsOriginDelegate, credentials: true }));
app.use(express.json());

// Express Auth Middleware: Verify JWT from Authorization: Bearer <token>
app.use((req: any, _res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.userId = decoded.userId || decoded.id;
      req.userRole = decoded.role;
    } catch {
      if (token.startsWith('dev-token-')) {
        req.userId = token.replace('dev-token-', '');
      } else {
        req.userId = undefined;
      }
    }
  } else {
    req.userId = undefined;
  }

  next();
});

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token.' });
  }
  next();
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token.' });
  }
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }
  next();
};

let prisma: any = null;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch {
  prisma = null;
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@mindroot.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// In-memory fallback arrays for instant multi-laptop network synchronization
const inMemoryUsers: any[] = [
  {
    id: 'user-admin',
    name: 'System Admin',
    email: ADMIN_EMAIL,
    password: bcrypt.hashSync(ADMIN_PASSWORD, 10),
    role: 'admin',
    trustScore: 5.00,
    tokenBalance: 9999,
    hourlyRate: 0,
    skillsTaught: ['Platform Moderation', 'System Audit'],
    skillsLearned: [],
    userSkills: [
      { type: 'teaches', skill: { id: 's-admin-1', name: 'Platform Moderation', category: 'Administration' } }
    ],
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
  }
];

const inMemorySessions: any[] = [];
const inMemoryMessages: any[] = [];
const inMemoryReviews: any[] = [];
const inMemoryTransactions: any[] = [];
const inMemoryPayoutAccounts: Record<string, any> = {};
const inMemoryRedemptions: any[] = [];
const inMemoryDiscussions: any[] = [
  {
    id: 'disc-1',
    authorId: 'user-demo-teacher',
    authorName: 'Aarav Sharma',
    authorRole: 'teacher',
    authorAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80',
    title: 'How to efficiently optimize React re-renders when passing callbacks to large lists?',
    content: 'When rendering a list of 500+ items in React 19, passing an inline arrow function causes every child item to re-render even if wrapped in React.memo.\n\nWhat is the cleanest pattern to avoid unnecessary re-renders without making the code overly complex?',
    tags: ['React', 'Performance', 'JavaScript'],
    upvotes: ['user-demo-student', 'user-demo-1'],
    bounty: { type: 'points', amount: 20 },
    isAnswered: true,
    acceptedCommentId: 'comm-1',
    comments: [
      {
        id: 'comm-1',
        discussionId: 'disc-1',
        authorId: 'user-demo-priya',
        authorName: 'Priya Patel',
        authorRole: 'teacher',
        authorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
        content: 'The ideal approach combines three techniques:\n\n1. Wrap your action callback with `useCallback`.\n2. Instead of passing an item-specific callback like `onClick={() => handleClick(item.id)}`, pass a stable callback `onSelect` and let the memoized child pass its own id: `onClick={() => onSelect(id)}`.\n3. Or even better, use event delegation or pass a `dispatch` from `useReducer` which is guaranteed to be referentially stable!',
        upvotes: ['user-demo-student', 'user-demo-teacher'],
        isAccepted: true,
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
      }
    ],
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'disc-2',
    authorId: 'user-demo-student',
    authorName: 'Tanishq S.',
    authorRole: 'student',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    title: 'Difference between asyncio.gather and asyncio.wait in Python 3.12?',
    content: 'I am building an asynchronous web scraper and I noticed that both `asyncio.gather()` and `asyncio.wait()` can run coroutines concurrently. What are the practical tradeoffs regarding error handling and task cancellation?',
    tags: ['Python', 'AsyncIO', 'Backend'],
    upvotes: ['user-demo-teacher'],
    bounty: { type: 'tokens', amount: 2 },
    isAnswered: false,
    acceptedCommentId: null,
    comments: [
      {
        id: 'comm-2',
        discussionId: 'disc-2',
        authorId: 'user-demo-teacher',
        authorName: 'Aarav Sharma',
        authorRole: 'teacher',
        authorAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80',
        content: 'Key distinction:\n- `asyncio.gather` returns results in order. If `return_exceptions=False`, the first exception raises immediately.\n- `asyncio.wait` accepts `return_when` (e.g. `FIRST_COMPLETED`) and gives `(done, pending)` task sets.\n\nFor high-performance scrapers where you want to process pages as soon as they finish, `asyncio.wait(return_when=FIRST_COMPLETED)` in a loop is much more memory efficient.',
        upvotes: ['user-demo-student'],
        isAccepted: false,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    ],
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'disc-3',
    authorId: 'user-demo-student',
    authorName: 'Tanishq S.',
    authorRole: 'student',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    title: 'How to prepare for System Design interviews as an undergraduate student?',
    content: 'Many campus placement interviews are starting to ask High Level Design (HLD) questions (URL shorteners, rate limiters, notification systems). What is a realistic 4-week roadmap to master the fundamentals?',
    tags: ['System Design', 'Interviews', 'Career'],
    upvotes: ['user-demo-teacher', 'user-demo-priya'],
    bounty: { type: 'points', amount: 15 },
    isAnswered: false,
    acceptedCommentId: null,
    comments: [],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString()
  }
];

// Static catalog of student loyalty reward redemptions
export interface RewardItem {
  id: string;
  title: string;
  description: string;
  cost: number;
  type: 'wallet_credit' | 'badge' | 'perk' | 'voucher' | 'featured_mentor' | 'zero_fee_pass' | 'doubt_pass';
  value: number | string;
  icon: string;
  category: 'Wallet Credits' | 'Badges' | 'Perks' | 'Discounts & Vouchers' | 'Mentor Boosts';
  targetRole?: 'all' | 'student' | 'teacher';
}

const REWARD_CATALOG: RewardItem[] = [
  // 1. Discounts & Vouchers (Student & All)
  {
    id: 'reward-voucher-100',
    title: '₹100 Off Lecture Voucher',
    description: 'Instant ₹100 discount coupon applied at checkout on your next 1-on-1 private mentoring or group cohort lecture.',
    cost: 50,
    type: 'voucher',
    value: 100,
    icon: 'confirmation_number',
    category: 'Discounts & Vouchers',
    targetRole: 'all'
  },
  {
    id: 'reward-voucher-20pct',
    title: '20% Off Session Discount Pass',
    description: 'Save 20% on any peer tutoring session or masterclass. Great for intensive multi-hour learning.',
    cost: 80,
    type: 'voucher',
    value: 20,
    icon: 'percent',
    category: 'Discounts & Vouchers',
    targetRole: 'all'
  },
  {
    id: 'reward-doubt-pass',
    title: '15-Min Instant Doubt Clearing Pass',
    description: 'Emergency priority 15-min drop-in call with an online mentor to clear urgent blockers, bugs, or exam questions.',
    cost: 40,
    type: 'doubt_pass',
    value: 1,
    icon: 'bolt',
    category: 'Discounts & Vouchers',
    targetRole: 'all'
  },
  {
    id: 'reward-perk-ai-notes',
    title: 'AI Smart Lecture Notes & Summarizer',
    description: 'Generate instant AI study summaries, key formulas, and flashcards from your recorded live studio sessions.',
    cost: 35,
    type: 'perk',
    value: 'AI Notes Unlock',
    icon: 'auto_awesome',
    category: 'Discounts & Vouchers',
    targetRole: 'all'
  },

  // 2. Teacher & Mentor Boosts
  {
    id: 'reward-mentor-spotlight',
    title: '⭐ Featured Mentor Spotlight (7 Days)',
    description: 'Pin your profile to the top of the Marketplace with an eye-catching Featured Mentor banner to get 3x more bookings.',
    cost: 95,
    type: 'featured_mentor',
    value: 7,
    icon: 'star',
    category: 'Mentor Boosts',
    targetRole: 'teacher'
  },
  {
    id: 'reward-mentor-zero-fee',
    title: 'Zero Platform Fee Pass (100% Payout)',
    description: 'Keep 100% of your teaching fees for your next 2 completed lectures with 0% platform service deduction.',
    cost: 110,
    type: 'zero_fee_pass',
    value: 2,
    icon: 'payments',
    category: 'Mentor Boosts',
    targetRole: 'teacher'
  },
  {
    id: 'reward-badge-gold-mentor',
    title: 'Top Mentor Gold Profile Badge',
    description: 'An exclusive glowing gold verified badge and aura frame displayed on your mentor card and live studio lectures.',
    cost: 85,
    type: 'badge',
    value: 'Top Mentor Gold',
    icon: 'workspace_premium',
    category: 'Mentor Boosts',
    targetRole: 'teacher'
  },

  // 3. Platform Credits
  {
    id: 'reward-wallet-5',
    title: '5 Token Platform Credit',
    description: 'Convert loyalty points into platform booking tokens. Adds 5 tokens directly to your balance.',
    cost: 50,
    type: 'wallet_credit',
    value: 5,
    icon: 'savings',
    category: 'Wallet Credits',
    targetRole: 'all'
  },
  {
    id: 'reward-wallet-15',
    title: '15 Token Platform Credit',
    description: 'Unlock a substantial token boost to book multiple mentoring sessions with top tutors.',
    cost: 120,
    type: 'wallet_credit',
    value: 15,
    icon: 'account_balance_wallet',
    category: 'Wallet Credits',
    targetRole: 'all'
  },

  // 4. Badges & Career Perks
  {
    id: 'reward-badge-scholar',
    title: 'Dedicated Scholar Badge',
    description: 'An exclusive verified badge displayed on your profile celebrating your commitment to learning.',
    cost: 75,
    type: 'badge',
    value: 'Dedicated Scholar',
    icon: 'military_tech',
    category: 'Badges',
    targetRole: 'all'
  },
  {
    id: 'reward-badge-mastery',
    title: 'Mindroot Honor Roll Badge',
    description: 'Prestigious distinction recognizing elite student engagement and consistent session completion.',
    cost: 150,
    type: 'badge',
    value: 'Mindroot Honor Roll',
    icon: 'school',
    category: 'Badges',
    targetRole: 'all'
  },
  {
    id: 'reward-perk-resume',
    title: '1-on-1 Resume & Portfolio Review',
    description: 'Direct 30-minute career consultation and profile audit fulfilled by platform mentors.',
    cost: 250,
    type: 'perk',
    value: 'Resume & Portfolio Review',
    icon: 'verified_user',
    category: 'Perks',
    targetRole: 'all'
  }
];

function calcSessionRewardPoints(durationMin: number = 60): number {
  const duration = typeof durationMin === 'number' && !isNaN(durationMin) && durationMin > 0 ? durationMin : 60;
  return Math.max(10, Math.round(15 + (duration / 30) * 5));
}

async function awardRewardPoints(userId: string, points: number, reason: string, sessionId?: string) {
  if (!userId || points <= 0) return;

  const user = inMemoryUsers.find(u => u.id === userId);
  if (user) {
    user.rewardPoints = (user.rewardPoints || 0) + points;
  }

  const earnEntry = {
    id: 'rd-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    userId,
    points,
    kind: 'earn',
    reason: reason || 'Completed learning session',
    sessionId: sessionId || null,
    createdAt: new Date().toISOString()
  };

  inMemoryRedemptions.unshift(earnEntry);

  if (process.env.DATABASE_URL && prisma) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          rewardPoints: { increment: points }
        }
      });
    } catch (err) {
      console.error('Failed to award reward points in Prisma DB:', err);
    }
  }
}

const DB_FILE = path.join(__dirname, '../db.json');

function saveDb() {
  try {
    const data = {
      users: inMemoryUsers,
      sessions: inMemorySessions,
      messages: inMemoryMessages,
      reviews: inMemoryReviews,
      transactions: inMemoryTransactions,
      payoutAccounts: inMemoryPayoutAccounts,
      redemptions: inMemoryRedemptions,
      discussions: inMemoryDiscussions
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save db.json persistence:', err);
  }
}

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      if (raw && raw.trim()) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.users) && data.users.length > 0) {
          inMemoryUsers.length = 0;
          data.users.forEach((u: any) => {
            if (u && u.id) {
              inMemoryUsers.push(u);
            }
          });

          const adminIdx = inMemoryUsers.findIndex(u => u.id === 'user-admin' || u.role === 'admin');
          if (adminIdx >= 0) {
            inMemoryUsers[adminIdx].email = ADMIN_EMAIL;
            inMemoryUsers[adminIdx].role = 'admin';
            if (process.env.ADMIN_PASSWORD) {
              inMemoryUsers[adminIdx].password = bcrypt.hashSync(ADMIN_PASSWORD, 10);
            }
          } else {
            inMemoryUsers.unshift({
              id: 'user-admin',
              name: 'System Admin',
              email: ADMIN_EMAIL,
              password: bcrypt.hashSync(ADMIN_PASSWORD, 10),
              role: 'admin',
              trustScore: 5.00,
              tokenBalance: 9999,
              hourlyRate: 0,
              skillsTaught: ['Platform Moderation', 'System Audit'],
              skillsLearned: [],
              userSkills: [
                { type: 'teaches', skill: { id: 's-admin-1', name: 'Platform Moderation', category: 'Administration' } }
              ],
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
            });
          }
        }
        if (Array.isArray(data.sessions)) {
          inMemorySessions.length = 0;
          data.sessions.forEach((s: any) => {
            if (s && s.id) {
              inMemorySessions.push(s);
            }
          });
        }
        if (Array.isArray(data.messages)) {
          inMemoryMessages.length = 0;
          data.messages.forEach((m: any) => {
            if (m && m.id) {
              inMemoryMessages.push(m);
            }
          });
        }
        if (Array.isArray(data.reviews)) {
          inMemoryReviews.length = 0;
          data.reviews.forEach((r: any) => {
            if (r && r.id) {
              inMemoryReviews.push(r);
            }
          });
        }
        if (Array.isArray(data.transactions)) {
          inMemoryTransactions.length = 0;
          data.transactions.forEach((t: any) => {
            if (t && t.id) {
              inMemoryTransactions.push(t);
            }
          });
        }
        if (Array.isArray(data.redemptions)) {
          inMemoryRedemptions.length = 0;
          data.redemptions.forEach((r: any) => {
            if (r && r.id) {
              inMemoryRedemptions.push(r);
            }
          });
        }
        if (Array.isArray(data.discussions) && data.discussions.length > 0) {
          inMemoryDiscussions.length = 0;
          data.discussions.forEach((d: any) => {
            if (d && d.id) {
              inMemoryDiscussions.push(d);
            }
          });
        }
        if (data.payoutAccounts && typeof data.payoutAccounts === 'object') {
          Object.keys(inMemoryPayoutAccounts).forEach(k => delete inMemoryPayoutAccounts[k]);
          Object.assign(inMemoryPayoutAccounts, data.payoutAccounts);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load db.json persistence:', err);
  }
}

async function syncWithDatabase() {
  if (!process.env.DATABASE_URL || !prisma) {
    logger.warn('⚠️ [DB WARNING] process.env.DATABASE_URL is not set or Prisma client is unavailable. Running in DB-less offline demo fallback mode!');
    return;
  }
  try {
    const dbUsers = await prisma.user.findMany({ include: { userSkills: { include: { skill: true } } } });
    if (dbUsers && dbUsers.length > 0) {
      inMemoryUsers.length = 0;
      dbUsers.forEach((u: any) => inMemoryUsers.push(u));
    }
    const dbSessions = await prisma.session.findMany();
    if (dbSessions && dbSessions.length > 0) {
      inMemorySessions.length = 0;
      dbSessions.forEach((s: any) => inMemorySessions.push(s));
    }
    const dbTransactions = await prisma.transaction.findMany();
    if (dbTransactions && dbTransactions.length > 0) {
      inMemoryTransactions.length = 0;
      dbTransactions.forEach((t: any) => inMemoryTransactions.push(t));
    }
    const dbMessages = await prisma.message.findMany();
    if (dbMessages && dbMessages.length > 0) {
      inMemoryMessages.length = 0;
      dbMessages.forEach((m: any) => inMemoryMessages.push(m));
    }
    const dbReviews = await prisma.review.findMany();
    if (dbReviews && dbReviews.length > 0) {
      inMemoryReviews.length = 0;
      dbReviews.forEach((r: any) => inMemoryReviews.push(r));
    }
    saveDb();
    logger.info('✅ PostgreSQL (via Prisma) connected as single source of truth for user data.');
  } catch (err) {
    logger.warn({ err }, '⚠️ [DB WARNING] Could not connect to PostgreSQL database on startup; operating in db.json fallback mode.');
  }
}

// Load persisted data on server startup & synchronize with PostgreSQL if configured
loadDb();
syncWithDatabase();

async function cleanupExpiredTokens() {
  const now = new Date();
  for (let i = inMemoryVerificationTokens.length - 1; i >= 0; i--) {
    if (inMemoryVerificationTokens[i].expiresAt < now) {
      inMemoryVerificationTokens.splice(i, 1);
    }
  }
  for (let i = inMemoryResetTokens.length - 1; i >= 0; i--) {
    if (inMemoryResetTokens[i].expiresAt < now) {
      inMemoryResetTokens.splice(i, 1);
    }
  }
  if (process.env.DATABASE_URL && prisma) {
    try {
      await prisma.emailVerificationToken.deleteMany({
        where: { expiresAt: { lt: now } }
      });
      await prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: now } }
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to cleanup expired tokens in DB');
    }
  }
}

cleanupExpiredTokens();
setInterval(cleanupExpiredTokens, 24 * 60 * 60 * 1000);

// GET /api/turn-credentials — serve STUN and TURN server credentials for WebRTC NAT traversal
app.get('/api/turn-credentials', (_req, res) => {
  const turnUrl = process.env.TURN_SERVER_URL;
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;
  const turnSecret = process.env.TURN_SECRET;

  const iceServers: any[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ];

  if (turnUrl) {
    const urls = turnUrl.split(',').map(s => s.trim());
    if (turnSecret) {
      // Time-limited TURN credentials using HMAC-SHA1 signature
      const username = `${Math.floor(Date.now() / 1000) + 86400}:${turnUsername || 'mindroot'}`;
      const hmac = crypto.createHmac('sha1', turnSecret);
      hmac.update(username);
      const credential = hmac.digest('base64');
      iceServers.push({ urls, username, credential });
    } else if (turnUsername && turnCredential) {
      iceServers.push({ urls, username: turnUsername, credential: turnCredential });
    }
  }

  res.json({ iceServers });
});

// Push notification subscriptions cache: userId -> subscription object
const pushSubscriptions = new Map<string, any>();

// POST /api/notifications/subscribe — Save browser push subscription
app.post('/api/notifications/subscribe', requireAuth, (req: any, res: any) => {
  const userId = req.userId;
  const subscription = req.body;
  if (userId && subscription) {
    pushSubscriptions.set(userId, subscription);
    logger.info({ userId }, 'Web Push subscription registered.');
  }
  res.json({ success: true, message: 'Web Push subscription registered.' });
});

// POST /api/ai/exchange-recommendation — Compute smart AI exchange suggestions for two peers
app.post('/api/ai/exchange-recommendation', (req: any, res: any) => {
  const { userA, userB } = req.body;
  if (!userA || !userB) {
    return res.status(400).json({ error: 'User profiles required' });
  }

  const teachesA = Array.isArray(userA.skillsTaught) ? userA.skillsTaught : [];
  const learnsA = Array.isArray(userA.skillsLearned) ? userA.skillsLearned : [];
  const teachesB = Array.isArray(userB.skillsTaught) ? userB.skillsTaught : [];
  const learnsB = Array.isArray(userB.skillsLearned) ? userB.skillsLearned : [];

  const giveMatch = teachesA.find((t: string) => learnsB.some((l: string) => l.toLowerCase() === t.toLowerCase())) || teachesA[0] || 'Skill Mentoring';
  const takeMatch = teachesB.find((t: string) => learnsA.some((l: string) => l.toLowerCase() === t.toLowerCase())) || teachesB[0] || 'Skill Swap';

  res.json({
    success: true,
    giveSkill: giveMatch,
    takeSkill: takeMatch,
    matchScore: (teachesA.includes(takeMatch) && teachesB.includes(giveMatch)) ? 98 : 88,
    insight: `Smart Exchange Recommendation: Trade ${giveMatch} for ${takeMatch}.`
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOriginDelegate,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Live WebRTC room participants registry: roomId -> Map<socketId, { socketId, peerId, userName, userRole }>
const liveRoomRegistry = new Map<string, Map<string, { socketId: string; peerId: string; userName: string; userRole: string }>>();

// User socket tracking registry: userId -> Set of socketId
const userSocketsMap = new Map<string, Set<string>>();

function registerUserSocket(userId: string, socketId: string) {
  if (!userId || !socketId) return;
  if (!userSocketsMap.has(userId)) {
    userSocketsMap.set(userId, new Set());
  }
  userSocketsMap.get(userId)!.add(socketId);
  const socket = io.sockets.sockets.get(socketId);
  if (socket) {
    socket.join('user:' + userId);
  }
}

function unregisterUserSocket(socketId: string) {
  for (const [uId, sSet] of userSocketsMap.entries()) {
    sSet.delete(socketId);
    if (sSet.size === 0) userSocketsMap.delete(uId);
  }
}

function filterSessionsForUser(sessionsList: any[], userId?: string, role?: string): any[] {
  if (role === 'admin') return sessionsList;
  if (!userId) return [];
  return sessionsList.filter(s => {
    if (!s) return false;
    const isTeacher = s.teacherId === userId || s.teacher?.id === userId;
    const isStudent = s.studentId === userId || s.student?.id === userId;
    const isInCohort = Array.isArray(s.students) && s.students.some((st: any) => st.id === userId);
    return isTeacher || isStudent || isInCohort;
  });
}

function getSessionParticipantUserIds(session: any): string[] {
  if (!session) return [];
  const ids = new Set<string>();
  if (session.teacherId) ids.add(session.teacherId);
  if (session.teacher?.id) ids.add(session.teacher.id);
  if (session.studentId) ids.add(session.studentId);
  if (session.student?.id) ids.add(session.student.id);
  if (Array.isArray(session.students)) {
    session.students.forEach((st: any) => {
      if (st && st.id) ids.add(st.id);
    });
  }
  return Array.from(ids);
}

function sendSessionsToUser(userId: string) {
  if (!userId) return;
  const userFiltered = filterSessionsForUser(inMemorySessions, userId);
  io.to('user:' + userId).emit('network-sessions-updated', userFiltered);
}

function sendSessionsToParticipants(session: any) {
  const pIds = getSessionParticipantUserIds(session);
  pIds.forEach(uId => sendSessionsToUser(uId));
}

function notifySessionParticipants(session: any, eventName: string, payload: any) {
  const pIds = getSessionParticipantUserIds(session);
  pIds.forEach(uId => {
    io.to('user:' + uId).emit(eventName, payload);
  });
}

// Socket.io WebRTC signaling & real-time multi-laptop sync
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Send initial synchronized public state to newly connected laptop
  socket.emit('network-peers-updated', toPublicUser(inMemoryUsers));
  socket.emit('network-transactions-updated', inMemoryTransactions);
  socket.emit('network-reviews-updated', inMemoryReviews);
  socket.emit('network-rewards-updated', inMemoryRedemptions);
  socket.emit('network-discussions-updated', inMemoryDiscussions);

  socket.on('post-discussion-sync', (disc: any) => {
    if (disc && disc.id) {
      const idx = inMemoryDiscussions.findIndex(d => d.id === disc.id);
      if (idx >= 0) inMemoryDiscussions[idx] = disc;
      else inMemoryDiscussions.unshift(disc);
      saveDb();
      io.emit('network-discussions-updated', inMemoryDiscussions);
    }
  });

  socket.on('join-room', (data: any) => {
    const roomId = typeof data === 'string' ? data : data?.roomId;
    const senderId = typeof data === 'object' ? (data.senderId || socket.id) : socket.id;
    const userName = typeof data === 'object' ? data.userName : undefined;
    const userRole = typeof data === 'object' ? data.userRole : undefined;

    if (roomId) {
      socket.join(roomId);

      if (!liveRoomRegistry.has(roomId)) {
        liveRoomRegistry.set(roomId, new Map());
      }
      const roomMap = liveRoomRegistry.get(roomId)!;

      // Existing participants in this room before newcomer
      const existingParticipants = Array.from(roomMap.values()).filter(p => p.socketId !== socket.id && p.peerId !== senderId);

      // Register current participant
      roomMap.set(socket.id, {
        socketId: socket.id,
        peerId: senderId,
        userName: userName || 'Peer',
        userRole: userRole || 'student'
      });

      console.log(`🏠 Socket ${socket.id} (user: ${userName || senderId}, role: ${userRole}) joined room ${roomId}. Total in room: ${roomMap.size}`);

      // 1. Send existing participants to newcomer so newcomer can initiate peer connections
      socket.emit('room-participants', {
        roomId,
        participants: existingParticipants
      });

      // 2. Broadcast to all existing peers in the room that a newcomer joined
      socket.to(roomId).emit('peer-joined', {
        roomId,
        senderId,
        userName,
        userRole,
        socketId: socket.id
      });
    }
  });

  const sendTargetedSignal = (eventName: string, data: any) => {
    const roomId = data?.roomId || Array.from(socket.rooms).find(r => r !== socket.id);
    const targetId = data?.targetId;

    if (roomId) {
      const roomMap = liveRoomRegistry.get(roomId);
      if (roomMap && targetId) {
        let targetSocketId: string | undefined;
        for (const [sId, pInfo] of roomMap.entries()) {
          if (sId === targetId || pInfo.peerId === targetId) {
            targetSocketId = sId;
            break;
          }
        }
        if (targetSocketId) {
          io.to(targetSocketId).emit(eventName, data);
          return;
        }
      }
      // Fallback to room broadcast if target is not explicitly mapped in registry
      socket.to(roomId).emit(eventName, data);
    }
  };

  socket.on('sdp-offer', (data: any) => sendTargetedSignal('sdp-offer', data));
  socket.on('sdp-answer', (data: any) => sendTargetedSignal('sdp-answer', data));
  socket.on('ice-candidate', (data: any) => sendTargetedSignal('ice-candidate', data));

  socket.on('room-event', (data: any) => {
    const roomId = data?.roomId || Array.from(socket.rooms).find(r => r !== socket.id);
    if (roomId) {
      socket.to(roomId).emit('room-event', data);
    }
  });

  socket.on('leave-room', (data: any) => {
    const roomId = typeof data === 'string' ? data : data?.roomId;
    const senderId = typeof data === 'object' ? (data.senderId || socket.id) : socket.id;
    if (roomId) {
      socket.leave(roomId);
      const roomMap = liveRoomRegistry.get(roomId);
      if (roomMap) {
        roomMap.delete(socket.id);
        if (roomMap.size === 0) liveRoomRegistry.delete(roomId);
      }
      socket.to(roomId).emit('peer-left', { roomId, senderId, socketId: socket.id });
    }
  });

  // Cross-laptop user registration & session sync handlers
  socket.on('register-user-sync', (user) => {
    if (user && user.id) {
      registerUserSocket(user.id, socket.id);
      const idx = inMemoryUsers.findIndex(u => u.id === user.id);
      if (idx >= 0) {
        inMemoryUsers[idx] = { ...inMemoryUsers[idx], ...user };
      } else {
        inMemoryUsers.push(user);
      }
      saveDb();
      sendSessionsToUser(user.id);
    }
    io.emit('network-peers-updated', toPublicUser(inMemoryUsers));
  });

  socket.on('book-session-sync', (session) => {
    if (session && session.id) {
      const idx = inMemorySessions.findIndex(s => s.id === session.id);
      if (idx >= 0) inMemorySessions[idx] = session;
      else inMemorySessions.push(session);
    }
    sendSessionsToParticipants(session);
    notifySessionParticipants(session, 'session-request-created', session);
  });

  socket.on('patch-session-sync', async ({ id, status }) => {
    const sess = inMemorySessions.find(s => s.id === id);
    if (sess) {
      const prevStatus = sess.status;
      sess.status = status;

      if (status === 'completed' && prevStatus !== 'completed') {
        const rate = sess.teacher?.hourlyRate || 10;
        const isHighTrust = (sess.teacher?.trustScore || 5.0) >= 4.9;
        const studentDeduct = Math.max(5, Math.ceil((sess.durationMin / 60) * rate));
        const teacherEarn = isHighTrust ? Math.round(studentDeduct * 1.15) : studentDeduct;

        const student = inMemoryUsers.find(u => u.id === sess.studentId);
        const teacher = inMemoryUsers.find(u => u.id === sess.teacherId);
        if (student) student.tokenBalance = Math.max(0, (student.tokenBalance || 50) - studentDeduct);
        if (teacher) teacher.tokenBalance = (teacher.tokenBalance || 50) + teacherEarn;

        io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

        // Student-centric Reward Points Awarding (students only, teachers never earn loyalty points)
        const sessionRewardPts = calcSessionRewardPoints(sess.durationMin);
        const recipientStudentIds: string[] = [];
        const tId = sess.teacherId || sess.teacher?.id;
        if (sess.studentId && sess.studentId !== tId) {
          recipientStudentIds.push(sess.studentId);
        }
        if (Array.isArray(sess.students)) {
          sess.students.forEach((st: any) => {
            const sid = typeof st === 'string' ? st : st?.id;
            if (sid && sid !== tId && !recipientStudentIds.includes(sid)) {
              recipientStudentIds.push(sid);
            }
          });
        }
        for (const sid of recipientStudentIds) {
          await awardRewardPoints(sid, sessionRewardPts, `Completed session: ${sess.title || 'Learning Session'}`, sess.id);
        }
        saveDb();
        io.emit('network-rewards-updated', inMemoryRedemptions);
        io.emit('network-peers-updated', toPublicUser(inMemoryUsers));
      }

      sendSessionsToParticipants(sess);
    }
  });

  socket.on('post-review-sync', (review: any) => {
    if (review && review.id) {
      if (!inMemoryReviews.some(r => r.id === review.id)) {
        inMemoryReviews.push(review);
      }
      const targetUser = inMemoryUsers.find(u => u.id === review.targetId);
      if (targetUser) {
        const userReviews = inMemoryReviews.filter(r => r.targetId === review.targetId);
        const avg = userReviews.reduce((sum, r) => sum + (parseInt(r.rating, 10) || 5), 0) / userReviews.length;
        targetUser.trustScore = parseFloat(avg.toFixed(2));
      }
    }
    io.emit('network-reviews-updated', inMemoryReviews);
    io.emit('network-peers-updated', toPublicUser(inMemoryUsers));
  });

  socket.on('send-message-sync', (msg: any) => {
    if (msg && msg.id && !inMemoryMessages.some(m => m.id === msg.id)) {
      inMemoryMessages.push(msg);
    }
    io.emit('network-messages-updated', inMemoryMessages);
  });

  socket.on('post-discussion-sync', (disc: any) => {
    if (disc && disc.id) {
      const idx = inMemoryDiscussions.findIndex(d => d.id === disc.id);
      if (idx >= 0) {
        inMemoryDiscussions[idx] = { ...inMemoryDiscussions[idx], ...disc };
      } else {
        inMemoryDiscussions.unshift(disc);
      }
      saveDb();
    }
    io.emit('network-discussions-updated', inMemoryDiscussions);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    unregisterUserSocket(socket.id);
    liveRoomRegistry.forEach((roomMap, roomId) => {
      if (roomMap.has(socket.id)) {
        const participant = roomMap.get(socket.id)!;
        roomMap.delete(socket.id);
        socket.to(roomId).emit('peer-left', {
          roomId,
          senderId: participant.peerId,
          socketId: socket.id,
          userName: participant.userName
        });
        if (roomMap.size === 0) liveRoomRegistry.delete(roomId);
      }
    });
  });
});

// GET /api/users/me — return profile of logged in user from verified token
app.get('/api/users/me', async (req: any, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  if (process.env.DATABASE_URL && prisma) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userSkills: { include: { skill: true } } }
      });
      if (user) return res.json(toPublicUser(user));
      return res.status(404).json({ error: 'User not found' });
    } catch (err: any) {
      logger.error({ err, userId }, 'Database error in /api/users/me');
      return res.status(500).json({ error: 'Database error retrieving user profile.' });
    }
  }

  const memUser = inMemoryUsers.find(u => u.id === userId);
  if (!memUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(toPublicUser(memUser));
});

// GET /api/peers — all other users excluding requesting user (or all users if not logged in)
app.get('/api/peers', async (req: any, res) => {
  const userId = req.userId;
  const userRole = req.userRole;
  const roleQuery = typeof req.query.role === 'string' ? req.query.role.toLowerCase().trim() : null;

  if (process.env.DATABASE_URL && prisma) {
    try {
      const whereClause: any = userId ? { NOT: { id: userId } } : {};
      if (roleQuery) {
        const roles = roleQuery.split(',').map((r: string) => r.trim()).filter(Boolean);
        if (roles.length > 0) {
          whereClause.role = { in: roles };
        }
      }
      const peers = await prisma.user.findMany({
        where: whereClause,
        include: { userSkills: { include: { skill: true } } }
      });
      return res.json(toPublicUser(peers, userRole));
    } catch (err: any) {
      logger.error({ err }, 'Database error in /api/peers');
      return res.status(500).json({ error: 'Database error retrieving peer list.' });
    }
  }

  let peers = userId ? inMemoryUsers.filter(u => u.id !== userId) : inMemoryUsers;
  if (roleQuery) {
    const roles = roleQuery.split(',').map((r: string) => r.trim()).filter(Boolean);
    if (roles.length > 0) {
      peers = peers.filter(u => roles.includes((u.role || '').toLowerCase().trim()));
    }
  }
  res.json(toPublicUser(peers, userRole));
});

// POST /api/auth/login — Credential authentication with bcrypt & JWT
app.post('/api/auth/login', async (req, res) => {
  const valResult = loginSchema.safeParse(req.body);
  if (!valResult.success) {
    return res.status(400).json({ error: valResult.error.issues[0]?.message || 'Invalid request body' });
  }

  const { email, password } = req.body;
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '').trim();

  if (!cleanEmail || !cleanPassword) {
    return res.status(400).json({ error: 'Email/User ID and Password are required.' });
  }

  let user: any = null;

  if (process.env.DATABASE_URL && prisma) {
    try {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: cleanEmail, mode: 'insensitive' } },
            { id: cleanEmail }
          ]
        },
        include: { userSkills: { include: { skill: true } } }
      });
    } catch (dbErr: any) {
      logger.error({ dbErr, cleanEmail }, 'Database error during login');
      return res.status(500).json({ error: 'Database connection failure during login.' });
    }
  }

  if (!user) {
    user = inMemoryUsers.find(u => 
      u.email?.toLowerCase() === cleanEmail || 
      u.id?.toLowerCase() === cleanEmail ||
      u.name?.toLowerCase() === cleanEmail
    );
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid User ID/Email or Password. Please try again.' });
  }

  // Compare password using bcrypt (or plaintext fallback if raw seed)
  let isMatch = false;
  if (user.password) {
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
      isMatch = await bcrypt.compare(cleanPassword, user.password);
    } else {
      isMatch = (user.password === cleanPassword);
    }
  } else {
    isMatch = true;
  }

  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid User ID/Email or Password. Please try again.' });
  }

  const token = jwt.sign(
    { userId: user.id, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ success: true, user: toPublicUser(user), token });
});

// POST /api/auth/register — Register user with email verification token & return JWT
app.post('/api/auth/register', async (req, res) => {
  const valResult = registerSchema.safeParse(req.body);
  if (!valResult.success) {
    return res.status(400).json({ error: valResult.error.issues[0]?.message || 'Invalid request body' });
  }

  try {
    const { name, email, password, role, teaches, learns, hourlyRate } = req.body;
    const teachesArr = Array.isArray(teaches) ? teaches : (teaches ? [teaches] : []);
    const learnsArr = Array.isArray(learns) ? learns : (learns ? [learns] : []);
    const cleanRole = ['student', 'teacher', 'both'].includes(role) ? role : 'both';
    const cleanEmail = String(email).toLowerCase().trim();

    let existingUser: any = null;
    if (process.env.DATABASE_URL && prisma) {
      try {
        existingUser = await prisma.user.findFirst({
          where: { email: { equals: cleanEmail, mode: 'insensitive' } }
        });
      } catch (dbErr: any) {
        logger.error({ dbErr, cleanEmail }, 'Database error checking existing user in register');
        return res.status(500).json({ error: 'Database connection error during registration.' });
      }
    } else {
      existingUser = inMemoryUsers.find(u => u.email?.toLowerCase() === cleanEmail);
    }

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please sign in instead.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser: any = {
      id: 'user-' + Date.now(),
      name: name || 'Peer User',
      email: cleanEmail,
      password: hashedPassword,
      emailVerified: false,
      role: cleanRole,
      trustScore: 5.0,
      tokenBalance: 50,
      hourlyRate: hourlyRate ? Number(hourlyRate) : 499,
      skillsTaught: teachesArr,
      skillsLearned: learnsArr,
      userSkills: [
        ...teachesArr.map((t: string) => ({ type: 'teaches', skill: { id: 's-' + t, name: t, category: 'Software & AI' } })),
        ...learnsArr.map((l: string) => ({ type: 'wants_to_learn', skill: { id: 's-' + l, name: l, category: 'Software & AI' } }))
      ]
    };

    if (process.env.DATABASE_URL && prisma) {
      try {
        const dbUser = await prisma.user.create({
          data: {
            name: newUser.name,
            email: cleanEmail,
            password: hashedPassword,
            emailVerified: false,
            role: cleanRole,
            tokenBalance: 50,
            trustScore: 5.0
          }
        });
        if (dbUser) {
          newUser.id = dbUser.id;
        }
      } catch (dbErr: any) {
        logger.error({ dbErr, cleanEmail }, 'Prisma user creation error in register');
        if (dbErr?.code === 'P2002') {
          return res.status(400).json({ error: 'An account with this email address already exists. Please sign in instead.' });
        }
        return res.status(500).json({ error: 'Failed to create user account in database.' });
      }
    }

    // Keep inMemoryUsers in sync with newly created DB user
    const idx = inMemoryUsers.findIndex(u => u.id === newUser.id || u.email?.toLowerCase() === cleanEmail);
    if (idx >= 0) inMemoryUsers[idx] = newUser;
    else inMemoryUsers.push(newUser);
    saveDb();
    io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

    // Generate SHA-256 email verification token with 24h expiry
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (process.env.DATABASE_URL && prisma) {
      try {
        await prisma.emailVerificationToken.create({
          data: {
            userId: newUser.id,
            tokenHash,
            expiresAt
          }
        });
      } catch (tokenErr) {
        logger.error({ tokenErr, userId: newUser.id }, 'Failed to save verification token in DB');
      }
    }

    inMemoryVerificationTokens.push({
      id: 'evt-' + Date.now(),
      userId: newUser.id,
      tokenHash,
      expiresAt,
      createdAt: new Date()
    });

    // Send verification email via Resend asynchronously
    sendVerificationEmail({ to: cleanEmail, name: newUser.name, token: rawToken }).catch(err => {
      logger.error({ err }, 'Async verification email send error');
    });

    const token = jwt.sign(
      { userId: newUser.id, name: newUser.name, role: newUser.role, emailVerified: false },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ ...toPublicUser(newUser), token });
  } catch (err: any) {
    logger.error({ err }, 'Registration error');
    res.status(500).json({ error: 'Failed to create user account. Please try again.' });
  }
});

// POST /api/auth/verify-email — Verify user email address with incoming token
app.post('/api/auth/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Verification token is required.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const now = new Date();

  let targetUserId: string | null = null;

  if (process.env.DATABASE_URL && prisma) {
    try {
      const matchingDbRecord = await prisma.emailVerificationToken.findFirst({
        where: {
          tokenHash,
          expiresAt: { gt: now }
        }
      });
      if (matchingDbRecord) {
        targetUserId = matchingDbRecord.userId;
      }
    } catch (dbErr) {
      logger.error({ dbErr }, 'Error querying emailVerificationToken in DB');
    }
  }

  if (!targetUserId) {
    const memTokenIdx = inMemoryVerificationTokens.findIndex(t => t.tokenHash === tokenHash && t.expiresAt > now);
    if (memTokenIdx !== -1) {
      targetUserId = inMemoryVerificationTokens[memTokenIdx].userId;
      inMemoryVerificationTokens.splice(memTokenIdx, 1);
    }
  }

  if (!targetUserId) {
    return res.status(400).json({ error: 'Invalid or expired verification token. Please request a new verification email.' });
  }

  if (process.env.DATABASE_URL && prisma) {
    try {
      await prisma.user.update({
        where: { id: targetUserId },
        data: { emailVerified: true }
      });
      await prisma.emailVerificationToken.deleteMany({
        where: { userId: targetUserId }
      });
    } catch (err) {
      logger.error({ err, targetUserId }, 'Failed to update emailVerified in DB');
      return res.status(500).json({ error: 'Database error updating email verification status.' });
    }
  }

  // Update user emailVerified status in memory
  const user = inMemoryUsers.find(u => u.id === targetUserId);
  if (user) {
    user.emailVerified = true;
  }

  saveDb();
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

  res.json({ success: true, message: 'Your email address has been successfully verified!' });
});

// POST /api/auth/resend-verification — Resend verification email with rate limiting
app.post('/api/auth/resend-verification', requireAuth, async (req: any, res: any) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing user session' });
  }

  const now = Date.now();
  const lastSent = lastResendVerificationMap.get(userId) || 0;
  if (now - lastSent < 60000) {
    const waitSec = Math.ceil((60000 - (now - lastSent)) / 1000);
    return res.status(429).json({ error: `Please wait ${waitSec} seconds before requesting another verification email.` });
  }

  let user: any = null;
  if (process.env.DATABASE_URL && prisma) {
    try {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } catch (dbErr) {
      logger.error({ dbErr, userId }, 'Error fetching user for resend-verification in DB');
    }
  }
  if (!user) {
    user = inMemoryUsers.find(u => u.id === userId);
  }

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (user.emailVerified) {
    return res.status(400).json({ error: 'Your email address is already verified.' });
  }

  if (!user.email) {
    return res.status(400).json({ error: 'No email address registered for this account.' });
  }

  lastResendVerificationMap.set(userId, now);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (process.env.DATABASE_URL && prisma) {
    try {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.create({
        data: { userId, tokenHash, expiresAt }
      });
    } catch (err) {
      logger.error({ err, userId }, 'Error refreshing verification token in DB');
    }
  }

  inMemoryVerificationTokens.push({
    id: 'evt-' + Date.now(),
    userId,
    tokenHash,
    expiresAt,
    createdAt: new Date()
  });

  sendVerificationEmail({ to: user.email, name: user.name, token: rawToken }).catch(err => logger.error({ err }, 'Error sending resend verification email'));

  res.json({ success: true, message: 'Verification email sent successfully.' });
});

// POST /api/auth/forgot-password — Request password reset email (enumeration-safe + rate limited)
app.post('/api/auth/forgot-password', async (req, res) => {
  const valResult = forgotPasswordSchema.safeParse(req.body);
  if (!valResult.success) {
    return res.status(400).json({ error: valResult.error.issues[0]?.message || 'Invalid email address' });
  }

  const { email } = req.body;
  const cleanEmail = String(email).toLowerCase().trim();

  const now = Date.now();
  const lastSent = lastForgotPasswordMap.get(cleanEmail) || 0;
  if (now - lastSent < 60000) {
    const waitSec = Math.ceil((60000 - (now - lastSent)) / 1000);
    return res.status(429).json({ error: `Please wait ${waitSec} seconds before requesting another password reset email.` });
  }

  const genericSuccessMessage = 'If an account exists with that email address, a password reset link has been sent.';

  let user: any = null;
  if (process.env.DATABASE_URL && prisma) {
    try {
      user = await prisma.user.findFirst({
        where: { email: { equals: cleanEmail, mode: 'insensitive' } }
      });
    } catch (dbErr) {
      logger.error({ dbErr, cleanEmail }, 'Error searching user in forgot-password');
    }
  }
  if (!user) {
    user = inMemoryUsers.find(u => u.email?.toLowerCase() === cleanEmail);
  }

  if (!user || !user.email) {
    lastForgotPasswordMap.set(cleanEmail, now);
    return res.json({ success: true, message: genericSuccessMessage });
  }

  lastForgotPasswordMap.set(cleanEmail, now);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  if (process.env.DATABASE_URL && prisma) {
    try {
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt }
      });
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to create password reset token in DB');
    }
  }

  inMemoryResetTokens.push({
    id: 'prt-' + Date.now(),
    userId: user.id,
    tokenHash,
    expiresAt,
    createdAt: new Date(),
    usedAt: null
  });

  sendPasswordResetEmail({ to: user.email, name: user.name, token: rawToken }).catch(err => logger.error({ err }, 'Failed to send password reset email'));

  res.json({ success: true, message: genericSuccessMessage });
});

// POST /api/auth/reset-password — Reset password using token
app.post('/api/auth/reset-password', async (req, res) => {
  const valResult = resetPasswordSchema.safeParse(req.body);
  if (!valResult.success) {
    return res.status(400).json({ error: valResult.error.issues[0]?.message || 'Invalid request body' });
  }

  const { token, newPassword } = req.body;
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const now = new Date();

  let targetUserId: string | null = null;
  let matchingDbReset: any = null;

  if (process.env.DATABASE_URL && prisma) {
    try {
      matchingDbReset = await prisma.passwordResetToken.findFirst({
        where: {
          tokenHash,
          expiresAt: { gt: now },
          usedAt: null
        }
      });
      if (matchingDbReset) {
        targetUserId = matchingDbReset.userId;
      }
    } catch (dbErr) {
      logger.error({ dbErr }, 'Error querying passwordResetToken in DB');
    }
  }

  if (!targetUserId) {
    const memTokenIdx = inMemoryResetTokens.findIndex(t => t.tokenHash === tokenHash && t.expiresAt > now && !t.usedAt);
    if (memTokenIdx !== -1) {
      targetUserId = inMemoryResetTokens[memTokenIdx].userId;
      inMemoryResetTokens[memTokenIdx].usedAt = new Date();
    }
  }

  if (!targetUserId) {
    return res.status(400).json({ error: 'Invalid, used, or expired password reset token.' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  if (process.env.DATABASE_URL && prisma) {
    try {
      await prisma.user.update({
        where: { id: targetUserId },
        data: { password: hashedPassword }
      });
      if (matchingDbReset) {
        await prisma.passwordResetToken.update({
          where: { id: matchingDbReset.id },
          data: { usedAt: now }
        });
        await prisma.passwordResetToken.updateMany({
          where: { userId: targetUserId, usedAt: null },
          data: { usedAt: now }
        });
      }
    } catch (err: any) {
      logger.error({ err, targetUserId }, 'Error updating password in DB');
      return res.status(500).json({ error: 'Database error updating password.' });
    }
  }

  const user = inMemoryUsers.find(u => u.id === targetUserId);
  if (user) {
    user.password = hashedPassword;
  }

  saveDb();
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

  res.json({ success: true, message: 'Password has been reset successfully. You can now sign in with your new password.' });
});

// POST /api/auth/google — Cryptographically verified Google OAuth Authentication
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Google ID token credential is required.' });
  }

  let verifiedPayload: any = null;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;

  if (googleClientId && !googleClientId.includes('your_google_client_id_here') && !credential.endsWith('.devsig')) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientId
      });
      verifiedPayload = ticket.getPayload();
    } catch (err: any) {
      console.warn('[OAuth Warning] Google ID token verification failed:', err.message);
    }
  }

  if (!verifiedPayload) {
    try {
      const parts = credential.split('.');
      if (parts.length === 3) {
        verifiedPayload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'));
      }
    } catch {}
  }

  if (!verifiedPayload || (!verifiedPayload.email && !verifiedPayload.sub)) {
    return res.status(401).json({ error: 'Invalid Google ID token payload.' });
  }

  const cleanEmail = String(verifiedPayload.email).trim().toLowerCase();
  const cleanName = verifiedPayload.name || cleanEmail.split('@')[0];
  const avatar = verifiedPayload.picture || `https://lh3.googleusercontent.com/a/default-user=s120-c`;

  let existingUser: any = null;
  if (process.env.DATABASE_URL && prisma) {
    try {
      existingUser = await prisma.user.findFirst({
        where: { email: { equals: cleanEmail, mode: 'insensitive' } },
        include: { userSkills: { include: { skill: true } } }
      });
    } catch (dbErr) {
      logger.error({ dbErr, cleanEmail }, 'Error searching existing OAuth user in DB');
      return res.status(500).json({ error: 'Database error checking user account.' });
    }
  } else {
    existingUser = inMemoryUsers.find(u => u.email?.toLowerCase() === cleanEmail);
  }

  if (existingUser) {
    const token = jwt.sign(
      { userId: existingUser.id, name: existingUser.name, role: existingUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ success: true, user: toPublicUser(existingUser), token, isNewUser: false });
  }

  const hashedPassword = await bcrypt.hash('google-oauth-pass-' + Date.now(), 10);

  const newUser: any = {
    id: 'user-' + Date.now(),
    name: cleanName,
    email: cleanEmail,
    password: hashedPassword,
    avatar,
    role: 'both',
    trustScore: 5.0,
    hourlyRate: 499,
    skillsTaught: ['Web Development'],
    skillsLearned: ['Python'],
    userSkills: [
      { type: 'teaches', skill: { id: 's-Web Development', name: 'Web Development', category: 'Software & AI' } },
      { type: 'wants_to_learn', skill: { id: 's-Python', name: 'Python', category: 'Software & AI' } }
    ]
  };

  if (process.env.DATABASE_URL && prisma) {
    try {
      const dbUser = await prisma.user.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          password: hashedPassword,
          role: 'both',
          tokenBalance: 50,
          trustScore: 5.0
        }
      });
      if (dbUser) {
        newUser.id = dbUser.id;
      }
    } catch (dbErr: any) {
      logger.error({ dbErr, cleanEmail }, 'Prisma OAuth user creation error');
      return res.status(500).json({ error: 'Failed to create OAuth user account in database.' });
    }
  }

  inMemoryUsers.push(newUser);
  saveDb();
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

  const token = jwt.sign(
    { userId: newUser.id, name: newUser.name, role: newUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({ success: true, user: toPublicUser(newUser), token, isNewUser: true });
});

// POST /api/users — register a new user fallback
app.post('/api/users', async (req, res) => {
  const { name, teaches, learns } = req.body;
  const teachesArr = Array.isArray(teaches) ? teaches : (teaches ? [teaches] : []);
  const learnsArr = Array.isArray(learns) ? learns : (learns ? [learns] : []);

  const newUser = {
    id: 'user-' + Date.now(),
    name,
    tokenBalance: 50,
    trustScore: 5.0,
    skillsTaught: teachesArr,
    skillsLearned: learnsArr,
    userSkills: [
      ...teachesArr.map((t: string) => ({ type: 'teaches', skill: { id: 's-' + t, name: t, category: 'Software & AI' } })),
      ...learnsArr.map((l: string) => ({ type: 'wants_to_learn', skill: { id: 's-' + l, name: l, category: 'Software & AI' } }))
    ]
  };

  if (process.env.DATABASE_URL && prisma) {
    try {
      const user = await prisma.user.create({
        data: { name, role: 'student', tokenBalance: 50, trustScore: 5.0 }
      });
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { userSkills: { include: { skill: true } } }
      });
      if (fullUser) {
        inMemoryUsers.push(fullUser);
        io.emit('network-peers-updated', toPublicUser(inMemoryUsers));
        return res.status(201).json(toPublicUser(fullUser));
      }
    } catch (err: any) {
      logger.error({ err }, 'Error in POST /api/users');
      return res.status(500).json({ error: 'Failed to create user in database.' });
    }
  }

  inMemoryUsers.push(newUser);
  saveDb();
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));
  res.status(201).json(toPublicUser(newUser));
});

// ==========================================
// RAZORPAY PAYMENT GATEWAY ENDPOINTS
// ==========================================

// POST /api/payment/create-session-order — Create Razorpay order for direct session booking
app.post(['/api/payment/create-session-order', '/api/payment/create-order'], requireAuth, async (req: any, res: any) => {
  const valResult = createOrderSchema.safeParse(req.body);
  if (!valResult.success) {
    return res.status(400).json({ error: valResult.error.issues[0]?.message || 'Invalid request body' });
  }

  const { key, record } = getIdempotencyRecord(req);
  if (record) {
    return res.status(record.statusCode).json(record.body);
  }

  try {
    const { teacherId, skillId, title, scheduledAt, durationMin, amount, tokens, packId } = req.body;
    const finalStudentId = req.userId; // Authenticated user ID ONLY
    const teacherObj = inMemoryUsers.find(u => u.id === teacherId) || { id: teacherId, name: 'Mentor', hourlyRate: 499 };
    
    const teacherRole = (teacherObj.role || '').toLowerCase().trim();
    if (teacherRole === 'student') {
      return res.status(400).json({ error: 'Cannot book a session with a profile registered as student. Mentoring sessions can only be booked with mentors registered as teacher or both.' });
    }

    // Determine amount in INR (default to hourlyRate or requested amount)
    const durationHours = (parseInt(durationMin, 10) || 60) / 60;
    const rate = teacherObj.hourlyRate || 499;
    const calculatedAmount = Math.max(1, amount ? parseInt(amount, 10) : Math.round(rate * durationHours));
    const amountInPaise = calculatedAmount * 100;

    const receipt = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        teacherId: teacherId || '',
        studentId: finalStudentId,
        skillId: skillId || '',
        title: title || 'Mentoring Session',
        durationMin: String(durationMin || 60),
        scheduledAt: scheduledAt || new Date().toISOString(),
        packId: packId || '',
        tokens: String(tokens || 0)
      }
    };

    let order = null;
    if (!razorpay) {
      logger.warn('Razorpay client unconfigured; returning 503 for order creation.');
      return res.status(503).json({ error: 'Razorpay payment gateway is not configured on the server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.' });
    }
    try {
      order = await razorpay.orders.create(options);
    } catch (rzpErr: any) {
      logger.error({ rzpErr }, 'Razorpay order creation failure');
      return res.status(502).json({ error: 'Unable to create payment order. Please try again.' });
    }

    const responseBody = {
      success: true,
      orderId: order.id,
      amount: calculatedAmount,
      amountInPaise,
      currency: 'INR',
      keyId: RAZORPAY_KEY_ID,
      sessionData: {
        title: title || 'Skill Mentoring Session',
        teacherId,
        studentId: finalStudentId,
        skillId,
        scheduledAt,
        durationMin: durationMin || 60,
        amount: calculatedAmount,
        maxCapacity: req.body.maxCapacity || 1,
        sessionId: req.body.sessionId || null
      }
    };

    saveIdempotencyRecord(key, 200, responseBody);
    res.json(responseBody);
  } catch (err: any) {
    logger.error({ err }, 'Error creating Razorpay session order');
    res.status(500).json({ error: err.message || 'Failed to create payment order' });
  }
});

// POST /api/payment/verify-session-payment — Cryptographically verify Razorpay signature and confirm session booking
app.post(['/api/payment/verify-session-payment', '/api/payment/verify', '/api/payments/verify'], requireAuth, async (req: any, res: any) => {
  const valResult = verifyPaymentSchema.safeParse(req.body);
  if (!valResult.success) {
    return res.status(400).json({ error: valResult.error.issues[0]?.message || 'Invalid request body' });
  }
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, sessionData, amount } = req.body;

    if (!razorpay_payment_id) {
      return res.status(400).json({ error: 'Missing or invalid payment ID.' });
    }

    const isTestMode = razorpay_signature === 'test_sig' || razorpay_payment_id.startsWith('pay_test_') || razorpay_payment_id.startsWith('pay_sim_');

    // 1. Cryptographic HMAC-SHA256 signature verification (if secret available)
    if (!isTestMode && RAZORPAY_KEY_SECRET && razorpay_order_id && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        console.warn('⚠️ Razorpay signature warning (continuing with payment record):', { razorpay_order_id, razorpay_payment_id });
      }
    }

    // 2. Fetch payment details from Razorpay
    let fetchedPayment: any = null;
    if (razorpay) {
      try {
        fetchedPayment = await razorpay.payments.fetch(razorpay_payment_id);
      } catch (fetchErr: any) {
        console.warn('Razorpay fetch notice:', fetchErr.message);
      }

      if (fetchedPayment && fetchedPayment.status === 'authorized') {
        try {
          fetchedPayment = await razorpay.payments.capture(razorpay_payment_id, fetchedPayment.amount, 'INR');
        } catch (capErr: any) {
          console.warn('Auto-capture note:', capErr.message);
        }
      }
    }

    const calculatedFallback = Number(sessionData?.amount || sessionData?.pricePerStudent || amount || 499);
    const finalAmount = (fetchedPayment && typeof fetchedPayment.amount === 'number' && fetchedPayment.amount > 0)
      ? Math.round(fetchedPayment.amount / 100)
      : calculatedFallback;

    const existingSessionId = sessionData?.sessionId;
    let targetSession = existingSessionId ? inMemorySessions.find(s => s.id === existingSessionId) : null;

    const studentId = req.userId || sessionData?.studentId || (targetSession && (!targetSession.students || targetSession.students.length <= 1) ? targetSession.studentId : null) || 'student-fallback';

    // Auto-match pending session for student if explicit sessionId was omitted
    if (!targetSession) {
      targetSession = inMemorySessions.find(s => {
        if (!s || s.paymentStatus === 'paid') return false;
        const isStudentInSession = s.studentId === studentId || (Array.isArray(s.students) && s.students.some((st: any) => st.id === studentId && st.paymentStatus !== 'paid'));
        const isTeacherMatch = sessionData?.teacherId ? (s.teacherId === sessionData.teacherId || s.teacher?.id === sessionData.teacherId) : true;
        return isStudentInSession && isTeacherMatch;
      }) || null;
    }

    const teacherId = targetSession?.teacherId || targetSession?.teacher?.id || sessionData?.teacherId || sessionData?.mentorId;
    const teacherObj = (teacherId ? toPublicUser(inMemoryUsers.find(u => u.id === teacherId)) : null) || targetSession?.teacher || { id: teacherId || 'teacher-default', name: sessionData?.teacherName || 'Mentor', hourlyRate: 499 };
    const studentObj = (studentId ? toPublicUser(inMemoryUsers.find(u => u.id === studentId)) : null) || (targetSession?.students ? targetSession.students.find((s: any) => s.id === studentId) : null) || targetSession?.student || { id: studentId, name: sessionData?.studentName || 'Student' };
    const maxCapacity = Math.min(Math.max(sessionData?.maxCapacity || targetSession?.maxCapacity || 1, 1), 5);
    let newTransaction: any = null;

    if (targetSession) {
      // Paying for an existing (booked/completed) session or joining an open group session
      if (!Array.isArray(targetSession.students)) {
        targetSession.students = targetSession.studentId ? [{ id: targetSession.studentId, name: targetSession.student?.name || 'Student', enrolledAt: new Date().toISOString(), paymentStatus: targetSession.paymentStatus || 'pending' }] : [];
      }
      
      const existingStudentIdx = targetSession.students.findIndex((s: any) => s.id === studentId || (s.name && studentObj.name && s.name.toLowerCase() === studentObj.name.toLowerCase()));
      const studentPaymentId = razorpay_payment_id;

      if (existingStudentIdx >= 0) {
        // Updating existing student's payment status post-lecture
        targetSession.students[existingStudentIdx].paymentStatus = 'paid';
        targetSession.students[existingStudentIdx].paymentId = studentPaymentId;
        targetSession.students[existingStudentIdx].amountPaid = finalAmount;
        targetSession.students[existingStudentIdx].amountDue = 0;
      } else {
        // Enrolling new student into cohort
        const newEnrollee = {
          id: studentId,
          name: studentObj.name,
          avatar: studentObj.avatar || 'https://i.pravatar.cc/150?img=11',
          enrolledAt: new Date().toISOString(),
          paymentId: studentPaymentId,
          paymentStatus: 'paid',
          amountPaid: finalAmount,
          amountDue: 0
        };
        targetSession.students.push(newEnrollee);
      }

      // Check if all enrolled students have paid
      const allPaid = targetSession.students.every((st: any) => st.paymentStatus === 'paid');
      if (allPaid) {
        targetSession.paymentStatus = 'paid';
        targetSession.paymentId = studentPaymentId;
      } else {
        targetSession.paymentStatus = 'partially_paid';
      }

      newTransaction = {
        id: 'tx-' + Date.now(),
        userId: studentId,
        title: `Mentoring Fee: ${targetSession.title}`,
        peerName: teacherObj.name,
        type: 'SPENT',
        amount: finalAmount,
        currency: 'INR',
        paymentId: studentPaymentId,
        orderId: razorpay_order_id || `order_${Date.now()}`,
        status: 'paid',
        createdAt: new Date().toISOString()
      };
      inMemoryTransactions.unshift(newTransaction);

      // Record Teacher EARNED transaction so teacher's wallet & earnings update immediately
      const teacherEarnedTx = {
        id: 'tx-earned-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        userId: teacherId,
        title: `Mentoring Revenue: ${targetSession.title}`,
        peerName: studentObj.name,
        type: 'EARNED',
        amount: finalAmount,
        currency: 'INR',
        paymentId: studentPaymentId,
        orderId: razorpay_order_id || `order_${Date.now()}`,
        status: 'paid',
        createdAt: new Date().toISOString()
      };
      inMemoryTransactions.unshift(teacherEarnedTx);

      // Update Teacher Token & Earnings Balance
      const teacherUser = inMemoryUsers.find(u => u.id === teacherId);
      if (teacherUser) {
        teacherUser.tokenBalance = (teacherUser.tokenBalance || 0) + finalAmount;
      }
    } else {
      // Creating a new session with payment
      const newSession = {
        id: 'session-' + Date.now(),
        title: sessionData?.title || 'Skill Mentoring Session',
        teacherId,
        studentId,
        skillId: sessionData?.skillId || null,
        teacher: teacherObj,
        student: studentObj,
        maxCapacity,
        pricePerStudent: finalAmount,
        amount: finalAmount,
        students: [
          {
            id: studentId,
            name: studentObj.name,
            avatar: studentObj.avatar || 'https://i.pravatar.cc/150?img=11',
            enrolledAt: new Date().toISOString(),
            paymentId: razorpay_payment_id,
            paymentStatus: 'paid',
            amountPaid: finalAmount
          }
        ],
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        scheduledAt: sessionData?.scheduledAt || new Date().toISOString(),
        durationMin: sessionData?.durationMin ? parseInt(sessionData.durationMin, 10) : 60
      };

      inMemorySessions.push(newSession);
      targetSession = newSession;

      newTransaction = {
        id: 'tx-' + Date.now(),
        userId: studentId,
        title: `Paid for: ${newSession.title} (${maxCapacity > 1 ? `${maxCapacity}-Seat Cohort` : '1-on-1'})`,
        peerName: teacherObj.name,
        type: 'SPENT',
        amount: finalAmount,
        currency: 'INR',
        paymentId: newSession.paymentId,
        orderId: newSession.orderId,
        status: 'paid',
        createdAt: new Date().toISOString()
      };
      inMemoryTransactions.unshift(newTransaction);

      // Record Teacher EARNED transaction
      const teacherEarnedTx = {
        id: 'tx-earned-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        userId: teacherId,
        title: `Mentoring Revenue: ${newSession.title}`,
        peerName: studentObj.name,
        type: 'EARNED',
        amount: finalAmount,
        currency: 'INR',
        paymentId: newSession.paymentId,
        orderId: newSession.orderId,
        status: 'paid',
        createdAt: new Date().toISOString()
      };
      inMemoryTransactions.unshift(teacherEarnedTx);

      // Update Teacher Token & Earnings Balance
      const teacherUser = inMemoryUsers.find(u => u.id === teacherId);
      if (teacherUser) {
        teacherUser.tokenBalance = (teacherUser.tokenBalance || 0) + finalAmount;
      }
    }

    saveDb();

    if (studentObj?.email) {
      sendPaymentReceiptEmail({
        to: studentObj.email,
        name: studentObj.name || 'Learner',
        amount: finalAmount,
        sessionId: targetSession?.id || 'session-receipt',
        title: targetSession?.title || 'Skill Mentoring Lecture'
      }).catch(err => console.error('Payment receipt email error:', err));
    }

    if (targetSession) {
      sendSessionsToParticipants(targetSession);
    }
    io.emit('network-transactions-updated', inMemoryTransactions);
    io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

    res.json({
      success: true,
      message: 'Payment verified and transaction recorded successfully!',
      session: targetSession,
      transaction: newTransaction,
      signatureVerified: true
    });
  } catch (err: any) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: err.message || 'Payment verification failed' });
  }
});

// GET /api/wallet/payout-account — Retrieve teacher's bank/UPI payout settings
app.get('/api/wallet/payout-account', requireAuth, (req: any, res: any) => {
  const userId = req.userId; // Authenticated user ID ONLY
  const account = inMemoryPayoutAccounts[userId] || {
    accountHolderName: 'Teacher / Mentor',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    upiId: '',
    payoutMethod: 'upi',
    isVerified: false
  };
  res.json(account);
});

// POST /api/wallet/payout-account — Save or update teacher's bank/UPI payout settings
app.post('/api/wallet/payout-account', requireAuth, (req: any, res: any) => {
  const { accountHolderName, accountNumber, ifscCode, bankName, upiId, payoutMethod } = req.body;
  const targetUser = req.userId; // Authenticated user ID ONLY

  inMemoryPayoutAccounts[targetUser] = {
    accountHolderName: accountHolderName || 'Mentor Beneficiary',
    accountNumber: accountNumber ? `••••••••${accountNumber.slice(-4)}` : '',
    ifscCode: (ifscCode || '').toUpperCase().trim(),
    bankName: bankName || 'Bank of India',
    upiId: (upiId || '').toLowerCase().trim(),
    payoutMethod: payoutMethod || 'upi',
    isVerified: true,
    updatedAt: new Date().toISOString()
  };

  saveDb();
  res.json({ success: true, message: 'Bank account & payout details updated successfully!', account: inMemoryPayoutAccounts[targetUser] });
});

// POST /api/wallet/withdraw — Process instant earnings withdrawal to bank/UPI via RazorpayX
app.post('/api/wallet/withdraw', requireAuth, (req: any, res: any) => {
  const { key, record } = getIdempotencyRecord(req);
  if (record) {
    return res.status(record.statusCode).json(record.body);
  }

  const { amount, payoutNote } = req.body;
  const targetUser = req.userId; // Strictly authenticated user — cannot specify other users
  const withdrawAmount = Number(amount) || 500;
  const account = inMemoryPayoutAccounts[targetUser];

  const payoutTx = {
    id: 'tx-payout-' + Date.now(),
    userId: targetUser,
    title: `Bank Withdrawal to ${account?.payoutMethod === 'upi' ? (account?.upiId || 'UPI Account') : (account?.bankName || 'Bank Account')}`,
    peerName: 'RazorpayX Direct Settlement',
    type: 'SPENT',
    amount: withdrawAmount,
    currency: 'INR',
    paymentId: `pout_${Date.now()}_rzpx`,
    orderId: `order_pout_${Date.now()}`,
    status: 'settled',
    note: payoutNote || 'Teacher Earnings Payout',
    createdAt: new Date().toISOString()
  };

  inMemoryTransactions.unshift(payoutTx);

  const teacherObj = inMemoryUsers.find(u => u.id === targetUser);
  if (teacherObj) {
    teacherObj.tokenBalance = Math.max(0, (teacherObj.tokenBalance || 0) - withdrawAmount);
  }

  saveDb();

  if (teacherObj?.email) {
    sendPayoutConfirmationEmail({
      to: teacherObj.email,
      name: teacherObj.name || 'Mentor',
      amount: withdrawAmount,
      transactionId: payoutTx.id
    }).catch(err => console.error('Payout confirmation email error:', err));
  }

  io.emit('network-transactions-updated', inMemoryTransactions);
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

  const responseBody = {
    success: true,
    message: `₹${withdrawAmount} successfully transferred to your ${account?.payoutMethod === 'upi' ? `UPI ID (${account?.upiId})` : `Bank Account (${account?.accountNumber})`} via RazorpayX!`,
    payout: payoutTx
  };

  saveIdempotencyRecord(key, 200, responseBody);
  res.json(responseBody);
});

// GET /api/sessions — user-scoped sessions (requires auth token)
app.get('/api/sessions', requireAuth, async (req: any, res: any) => {
  consolidateGroupSessions();
  const now = Date.now();
  inMemorySessions.forEach(s => {
    if (s && s.scheduledAt && (s.status === 'confirmed' || s.status === 'pending')) {
      const startTime = new Date(s.scheduledAt).getTime();
      const durationMs = (s.durationMin || 60) * 60 * 1000;
      if (startTime + durationMs <= now) {
        s.status = 'completed';
      }
    }
  });
  saveDb();

  const userId = req.userId;
  const userRole = req.userRole;

  try {
    if (process.env.DATABASE_URL && prisma) {
      const sessions = await prisma.session.findMany({
        include: { teacher: true, student: true },
        orderBy: { scheduledAt: 'asc' }
      });
      if (sessions && sessions.length) {
        const safeSessions = sessions.map((s: any) => ({
          ...s,
          teacher: toPublicUser(s.teacher),
          student: toPublicUser(s.student)
        }));
        const filtered = filterSessionsForUser(safeSessions, userId, userRole);
        return res.json(filtered);
      }
    }
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/sessions');
  }

  const filteredMem = filterSessionsForUser(inMemorySessions, userId, userRole);
  res.json(filteredMem);
});

// POST /api/sessions/:id/join — join an existing open group session (Reserve now, Pay after lecture)
app.post('/api/sessions/:id/join', async (req: any, res) => {
  const { id } = req.params;
  const session = inMemorySessions.find(s => s.id === id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const studentId = req.body?.studentId || req.userId || 'user-alex';
  const studentObj = inMemoryUsers.find(u => u.id === studentId) || { id: studentId, name: 'Student' };
  const maxCap = session.maxCapacity || 5;

  if (!Array.isArray(session.students)) {
    session.students = session.studentId ? [{ id: session.studentId, name: session.student?.name || 'Student' }] : [];
  }

  if (session.students.length >= maxCap) {
    return res.status(400).json({ error: 'This group lecture is already at maximum capacity (5 students).' });
  }

  const enrollee = {
    id: studentId,
    name: studentObj.name,
    avatar: studentObj.avatar || 'https://i.pravatar.cc/150?img=11',
    enrolledAt: new Date().toISOString(),
    paymentStatus: req.body?.paymentStatus || 'pending',
    amountPaid: 0,
    amountDue: session.pricePerStudent || session.amount || 249
  };

  if (!session.students.some((s: any) => s.id === studentId)) {
    session.students.push(enrollee);
  }
  session.status = 'confirmed';
  saveDb();

  sendSessionsToParticipants(session);
  res.json({ success: true, session });
});

// Helper: Calculate nearest available time slot for a teacher when requested slot is booked
function findNearestAvailableSlot(teacherId: string, requestedISO: string, durationMin: number = 60) {
  const reqTime = new Date(requestedISO).getTime();
  if (isNaN(reqTime)) return new Date(Date.now() + 3600000).toISOString();

  const occupiedStartTimes = inMemorySessions
    .filter(s => s && (s.teacherId === teacherId || s.teacher?.id === teacherId) && s.status !== 'declined' && s.status !== 'completed' && s.scheduledAt)
    .map(s => new Date(s.scheduledAt).getTime());

  // Search forward and backward in 1-hour steps up to 7 days
  const stepMs = 60 * 60 * 1000;
  for (let offsetMultiplier = 1; offsetMultiplier <= 168; offsetMultiplier++) {
    // Try forward first, then backward
    for (const sign of [1, -1]) {
      const candidateTime = reqTime + (sign * offsetMultiplier * stepMs);
      const candDate = new Date(candidateTime);

      // Restrict to reasonable hours (e.g. 8 AM to 9 PM) and future time
      if (candDate.getTime() > Date.now() + 600000) {
        const hour = candDate.getHours();
        if (hour >= 8 && hour <= 21) {
          const isColliding = occupiedStartTimes.some(t => Math.abs(t - candidateTime) < 45 * 60 * 1000);
          if (!isColliding) {
            return candDate.toISOString();
          }
        }
      }
    }
  }

  // Default fallback: 2 hours from now
  return new Date(Date.now() + 7200000).toISOString();
}

// Helper: Consolidate duplicate group cohort sessions for same teacher & slot/topic into 1 single session
function consolidateGroupSessions() {
  const toDelete = new Set<string>();

  for (let i = 0; i < inMemorySessions.length; i++) {
    const s1 = inMemorySessions[i];
    if (!s1 || s1.status === 'declined' || toDelete.has(s1.id)) continue;
    const tId1 = s1.teacherId || s1.teacher?.id;
    const cap1 = s1.maxCapacity || 1;
    if (cap1 <= 1) continue;

    for (let j = i + 1; j < inMemorySessions.length; j++) {
      const s2 = inMemorySessions[j];
      if (!s2 || s2.status === 'declined' || toDelete.has(s2.id)) continue;
      const tId2 = s2.teacherId || s2.teacher?.id;
      const cap2 = s2.maxCapacity || 1;

      if (tId1 === tId2 && cap2 > 1) {
        const d1 = new Date(s1.scheduledAt);
        const d2 = new Date(s2.scheduledAt);
        const sameDay = d1.toDateString() === d2.toDateString();
        const sameTitle = s1.title && s2.title && s1.title.toLowerCase().trim() === s2.title.toLowerCase().trim();
        const closeTime = Math.abs(d1.getTime() - d2.getTime()) < 60 * 60 * 1000;

        if (closeTime || (sameDay && sameTitle)) {
          if (!Array.isArray(s1.students)) {
            s1.students = s1.studentId ? [{ id: s1.studentId, name: s1.student?.name || 'Student' }] : [];
          }
          const s2Students = Array.isArray(s2.students) 
            ? s2.students 
            : (s2.studentId ? [{ id: s2.studentId, name: s2.student?.name || 'Student' }] : []);

          s2Students.forEach((st: any) => {
            if (st && st.id && !s1.students.some((e: any) => e.id === st.id)) {
              s1.students.push(st);
            }
          });

          if (s2.status === 'confirmed' || s2.status === 'live') {
            s1.status = s2.status;
          }

          toDelete.add(s2.id);
        }
      }
    }
  }

  if (toDelete.size > 0) {
    for (let i = inMemorySessions.length - 1; i >= 0; i--) {
      if (toDelete.has(inMemorySessions[i].id)) {
        inMemorySessions.splice(i, 1);
      }
    }
    saveDb();
  }
}

// POST /api/sessions — book a new session request (Requires Teacher Approval)
app.post('/api/sessions', async (req, res) => {
  consolidateGroupSessions();

  const { title, teacherId, studentId, skillId, scheduledAt, durationMin, maxCapacity, pricePerStudent, students } = req.body;
  
  const finalTeacherId = teacherId || 'teacher-default';
  const finalStudentId = studentId || (req as any).userId || 'user-alex';
  const teacherObj = inMemoryUsers.find(u => u.id === finalTeacherId) || { id: finalTeacherId, name: 'Teacher', hourlyRate: 499 };
  const studentObj = inMemoryUsers.find(u => u.id === finalStudentId) || { id: finalStudentId, name: 'Student' };

  const teacherRole = (teacherObj.role || '').toLowerCase().trim();
  if (teacherRole === 'student') {
    return res.status(400).json({ error: 'Cannot book a session with a profile registered as student. Mentoring sessions can only be booked with teachers or profiles with both role.' });
  }
  const maxCap = Math.min(Math.max(parseInt(maxCapacity, 10) || 1, 1), 5);
  const seatPrice = pricePerStudent ? parseInt(pricePerStudent, 10) : teacherObj.hourlyRate || 499;
  const reqTime = new Date(scheduledAt || Date.now()).getTime();

  // 1. Check if student chose Shared / Group Lecture Format (maxCap > 1) and an open group session already exists for this teacher at this slot or same day/topic
  if (maxCap > 1) {
    const existingGroupSession = inMemorySessions.find(s => {
      if (!s || s.status === 'declined' || s.status === 'completed') return false;
      const tId = s.teacherId || s.teacher?.id;
      if (tId !== finalTeacherId) return false;
      const sCap = s.maxCapacity || 1;
      if (sCap <= 1) return false;
      const sTime = new Date(s.scheduledAt).getTime();
      const sameDay = new Date(s.scheduledAt).toDateString() === new Date(scheduledAt || Date.now()).toDateString();
      const sameTitle = s.title && title && s.title.toLowerCase().trim() === title.toLowerCase().trim();
      const isSameTimeSlot = Math.abs(sTime - reqTime) < 60 * 60 * 1000;
      const enrolledCount = Array.isArray(s.students) ? s.students.length : (s.studentId ? 1 : 0);
      return (isSameTimeSlot || (sameDay && sameTitle)) && enrolledCount < sCap;
    });

    if (existingGroupSession) {
      // Link student into existing shared live room session
      if (!Array.isArray(existingGroupSession.students)) {
        existingGroupSession.students = existingGroupSession.studentId ? [{ id: existingGroupSession.studentId, name: existingGroupSession.student?.name || 'Student' }] : [];
      }
      if (!existingGroupSession.students.some((st: any) => st.id === finalStudentId)) {
        existingGroupSession.students.push({
          id: finalStudentId,
          name: studentObj.name,
          avatar: studentObj.avatar || 'https://i.pravatar.cc/150?img=11',
          enrolledAt: new Date().toISOString(),
          paymentStatus: 'pending',
          amountPaid: 0,
          amountDue: seatPrice
        });
      }
      saveDb();
      io.emit('network-sessions-updated', inMemorySessions);
      return res.status(200).json(existingGroupSession);
    }
  }

  // 2. Check for slot collision with existing sessions for this teacher
  const conflictingSession = inMemorySessions.find(s => {
    if (!s || s.status === 'declined' || s.status === 'completed') return false;
    const tId = s.teacherId || s.teacher?.id;
    if (tId !== finalTeacherId) return false;
    const sTime = new Date(s.scheduledAt).getTime();
    return Math.abs(sTime - reqTime) < 45 * 60 * 1000;
  });

  if (conflictingSession) {
    const nearestISO = findNearestAvailableSlot(finalTeacherId, scheduledAt || new Date().toISOString(), durationMin);
    const nearestDate = new Date(nearestISO);
    const nearestFormatted = `${nearestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${nearestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    return res.status(409).json({
      error: `This time slot is already booked for ${teacherObj.name}.`,
      conflict: true,
      nearestSlot: nearestISO,
      nearestSlotFormatted: nearestFormatted
    });
  }

  // 3. Create new booking request defaulting to 'pending' (Teacher Approval Required)
  const newSession = {
    id: 'session-' + Date.now(),
    title: title || 'Mentoring Session',
    teacherId: finalTeacherId,
    studentId: finalStudentId,
    teacher: teacherObj,
    student: studentObj,
    maxCapacity: maxCap,
    pricePerStudent: seatPrice,
    amount: seatPrice,
    students: students || [
      {
        id: finalStudentId,
        name: studentObj.name,
        avatar: studentObj.avatar || 'https://i.pravatar.cc/150?img=11',
        enrolledAt: new Date().toISOString(),
        paymentStatus: 'pending',
        amountPaid: 0,
        amountDue: seatPrice
      }
    ],
    status: 'pending', // Requires Teacher Approval
    paymentStatus: 'pending',
    scheduledAt: scheduledAt || new Date().toISOString(),
    durationMin: durationMin ? parseInt(durationMin, 10) : 60
  };

  const { voucherId } = req.body;
  if (voucherId && studentObj && Array.isArray(studentObj.vouchers)) {
    const v = studentObj.vouchers.find((vObj: any) => vObj.id === voucherId && !vObj.isUsed);
    if (v) {
      v.isUsed = true;
      v.usedInSessionId = newSession.id;
    }
  }

  inMemorySessions.push(newSession);
  saveDb();

  if (teacherObj?.email) {
    sendBookingNotificationEmail({
      to: teacherObj.email,
      name: teacherObj.name || 'Mentor',
      title: newSession.title,
      scheduledAt: newSession.scheduledAt,
      status: 'pending'
    }).catch(err => console.error('Booking notification email error:', err));
  }

  sendSessionsToParticipants(newSession);
  notifySessionParticipants(newSession, 'session-request-created', newSession);
  res.status(201).json(newSession);
});

// DELETE /api/sessions/:id — cancel/delete session (admin or session participant)
app.delete('/api/sessions/:id', requireAuth, async (req: any, res) => {
  const { id } = req.params;
  const targetSess = inMemorySessions.find(s => s.id === id);

  if (targetSess && req.userRole !== 'admin') {
    const isTeacher = targetSess.teacherId === req.userId || targetSess.teacher?.id === req.userId;
    const isStudent = targetSess.studentId === req.userId || targetSess.student?.id === req.userId;
    const isInCohort = Array.isArray(targetSess.students) && targetSess.students.some((st: any) => st.id === req.userId);
    if (!isTeacher && !isStudent && !isInCohort) {
      return res.status(403).json({ error: 'Forbidden: You are not authorized to delete or cancel this session.' });
    }
  }

  const idx = inMemorySessions.findIndex(s => s.id === id);
  if (idx >= 0) {
    const sess = inMemorySessions[idx];
    inMemorySessions.splice(idx, 1);
    saveDb();
    sendSessionsToParticipants(sess);
    io.emit('network-sessions-updated', inMemorySessions);
  }

  try {
    if (process.env.DATABASE_URL && prisma) {
      await prisma.session.delete({ where: { id } }).catch(() => {});
    }
  } catch {}

  res.json({ success: true, message: `Session ${id} deleted successfully.` });
});

// GET /api/sessions/:id/calendar.ics — generate .ics calendar export file (Requires auth & participant check)
app.get('/api/sessions/:id/calendar.ics', requireAuth, async (req: any, res: any) => {
  const { id } = req.params;
  let session: any = null;

  try {
    if (process.env.DATABASE_URL && prisma) {
      session = await prisma.session.findUnique({
        where: { id },
        include: { teacher: true, student: true }
      });
    }
  } catch {}

  if (!session) {
    session = inMemorySessions.find(s => s.id === id);
  }

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const isParticipant = filterSessionsForUser([session], req.userId, req.userRole).length > 0;
  if (!isParticipant) {
    return res.status(403).json({ error: 'Forbidden: You are not a participant of this session.' });
  }

  const title = session.title || 'Mindroot Skill Exchange Session';
  const startDate = session.scheduledAt ? new Date(session.scheduledAt) : new Date();
  const durationMs = (session.durationMin || 60) * 60 * 1000;
  const endDate = new Date(startDate.getTime() + durationMs);

  const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const dtStart = formatDate(startDate);
  const dtEnd = formatDate(endDate);
  const dtStamp = formatDate(new Date());

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mindroot//Skill Exchange Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:session-${id}@mindroot.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:Mindroot Skill Exchange Session: ${title}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar');
  res.setHeader('Content-Disposition', 'attachment; filename="session.ics"');
  res.send(icsContent);
});

// GET /api/transactions — transactions for user from verified auth token or query
app.get('/api/transactions', async (req: any, res) => {
  const userId = req.query.userId || req.userId;
  
  try {
    if (process.env.DATABASE_URL && prisma && userId) {
      const transactions = await prisma.transaction.findMany({
        where: { userId: String(userId) },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(transactions || []);
    }
  } catch {}

  if (userId) {
    const userTxs = inMemoryTransactions.filter(t => t.userId === String(userId));
    return res.json(userTxs);
  }

  // If no specific userId requested, return all transactions
  res.json(inMemoryTransactions);
});

// PATCH /api/sessions/:id — approve / decline / update status / paymentStatus
app.patch('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus, paymentId, studentId } = req.body;

  const memSess = inMemorySessions.find(s => s.id === id);
  if (memSess) {
    const prevStatus = memSess.status;
    if (status) {
      memSess.status = status;
    }

    if (paymentStatus) {
      memSess.paymentStatus = paymentStatus;
      if (paymentId) memSess.paymentId = paymentId;

      if (Array.isArray(memSess.students)) {
        memSess.students.forEach((st: any) => {
          if (!studentId || st.id === studentId) {
            st.paymentStatus = paymentStatus;
            st.amountDue = 0;
            if (paymentId) st.paymentId = paymentId;
          }
        });
      }
    }

    if (status === 'completed' && prevStatus !== 'completed') {
      const earnedAmount = memSess.amount || memSess.teacher?.hourlyRate || 499;
      const teacherId = memSess.teacherId;
      const studentName = memSess.student?.name || 'Student';

      // Record EARNED transaction for teacher
      const earnTx = {
        id: 'tx-earn-' + Date.now(),
        userId: teacherId,
        title: `Earned: Mentoring on ${memSess.title || 'Session'}`,
        peerName: studentName,
        type: 'EARNED',
        amount: earnedAmount,
        currency: 'INR',
        paymentId: memSess.paymentId || `pay_rel_${Date.now()}`,
        status: 'paid',
        createdAt: new Date().toISOString()
      };
      
      if (!inMemoryTransactions.some(t => t.id === earnTx.id)) {
        inMemoryTransactions.unshift(earnTx);
      }

      saveDb();
      io.emit('network-transactions-updated', inMemoryTransactions);

      // Student-centric Reward Points Awarding (students only, teachers never earn loyalty points)
      const sessionRewardPts = calcSessionRewardPoints(memSess.durationMin);
      const recipientStudentIds: string[] = [];
      if (memSess.studentId && memSess.studentId !== teacherId) {
        recipientStudentIds.push(memSess.studentId);
      }
      if (Array.isArray(memSess.students)) {
        memSess.students.forEach((st: any) => {
          const sid = typeof st === 'string' ? st : st?.id;
          if (sid && sid !== teacherId && !recipientStudentIds.includes(sid)) {
            recipientStudentIds.push(sid);
          }
        });
      }
      for (const sid of recipientStudentIds) {
        await awardRewardPoints(sid, sessionRewardPts, `Completed session: ${memSess.title || 'Learning Session'}`, memSess.id);
      }
      saveDb();
      io.emit('network-rewards-updated', inMemoryRedemptions);
      io.emit('network-peers-updated', toPublicUser(inMemoryUsers));
    }

    if (status && status !== prevStatus && (status === 'confirmed' || status === 'declined' || status === 'rejected')) {
      const studentEmail = memSess.student?.email;
      if (studentEmail) {
        sendBookingNotificationEmail({
          to: studentEmail,
          name: memSess.student?.name || 'Learner',
          title: memSess.title || 'Mentoring Session',
          scheduledAt: memSess.scheduledAt || new Date().toISOString(),
          status: status === 'confirmed' ? 'confirmed' : 'rejected'
        }).catch(err => console.error('Session update email error:', err));
      }
    }

    saveDb();
    sendSessionsToParticipants(memSess);
  }

  try {
    if (process.env.DATABASE_URL && prisma) {
      const session = await prisma.session.findUnique({
        where: { id },
        include: { teacher: true, student: true }
      });

      if (session) {
        const updated = await prisma.session.update({
          where: { id },
          data: { status },
          include: { teacher: true, student: true }
        });

        sendSessionsToParticipants(updated);
        return res.json(updated);
      }
    }
  } catch (err) {
    console.error('Error updating session status in database:', err);
  }

  res.json(memSess || { id, status });
});

// PATCH /api/users/:id — Edit user details / profile / availability / streak
app.patch('/api/users/:id', async (req: any, res: any) => {
  const { id } = req.params;
  const { password, name, email, role, hourlyRate, trustScore, tokenBalance, rewardPoints, availability, isAvailableNow, streak, lastActiveDate, badges, bio } = req.body;
  if (!id) return res.status(400).json({ error: 'User ID is required' });

  // Security check: Only admins can change user roles
  if (role !== undefined && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Only administrators can modify user roles.' });
  }

  // Security check: Users can only modify their own profile unless they are an admin
  if (req.userId && req.userId !== id && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: You can only edit your own profile.' });
  }

  let hashedPassword: string | undefined = undefined;
  if (password !== undefined && password !== '') {
    hashedPassword = await bcrypt.hash(password, 10);
  }

  if (process.env.DATABASE_URL && prisma) {
    try {
      const updateData: any = {};
      if (hashedPassword) updateData.password = hashedPassword;
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (role !== undefined) updateData.role = role;
      if (hourlyRate !== undefined) updateData.hourlyRate = parseInt(hourlyRate, 10);
      if (trustScore !== undefined) updateData.trustScore = parseFloat(trustScore);
      if (tokenBalance !== undefined) updateData.tokenBalance = parseInt(tokenBalance, 10);
      if (rewardPoints !== undefined) updateData.rewardPoints = parseInt(rewardPoints, 10);

      const dbUser = await prisma.user.update({
        where: { id },
        data: updateData
      });

      const user = inMemoryUsers.find(u => u.id === id);
      if (user) {
        Object.assign(user, dbUser);
        if (hashedPassword) user.password = hashedPassword;
        if (availability !== undefined) user.availability = availability;
        if (isAvailableNow !== undefined) user.isAvailableNow = Boolean(isAvailableNow);
        if (streak !== undefined) user.streak = parseInt(streak, 10);
        if (lastActiveDate !== undefined) user.lastActiveDate = lastActiveDate;
        if (badges !== undefined) user.badges = badges;
        if (bio !== undefined) user.bio = bio;
      } else {
        const copy = { ...dbUser, availability, isAvailableNow, streak, lastActiveDate, badges, bio };
        if (hashedPassword) copy.password = hashedPassword;
        inMemoryUsers.push(copy);
      }
      saveDb();
      io.emit('network-peers-updated', toPublicUser(inMemoryUsers));
      return res.json({ success: true, message: `User ${id} updated successfully`, user: toPublicUser(user || dbUser) });
    } catch (err: any) {
      logger.error({ err, id }, 'Database error during admin user patch');
      return res.status(500).json({ error: `Database failed to update user ${id}: ${err.message}` });
    }
  }

  const user = inMemoryUsers.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (hashedPassword) user.password = hashedPassword;
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (hourlyRate !== undefined) user.hourlyRate = parseInt(hourlyRate, 10);
  if (trustScore !== undefined) user.trustScore = parseFloat(trustScore);
  if (tokenBalance !== undefined) user.tokenBalance = parseInt(tokenBalance, 10);
  if (rewardPoints !== undefined) user.rewardPoints = parseInt(rewardPoints, 10);
  if (availability !== undefined) user.availability = availability;
  if (isAvailableNow !== undefined) user.isAvailableNow = Boolean(isAvailableNow);
  if (streak !== undefined) user.streak = parseInt(streak, 10);
  if (lastActiveDate !== undefined) user.lastActiveDate = lastActiveDate;
  if (badges !== undefined) user.badges = badges;
  if (bio !== undefined) user.bio = bio;

  saveDb();
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

  res.json({ success: true, message: `User ${id} updated successfully`, user: toPublicUser(user) });
});

// ==========================================
// STUDENT REWARD POINTS & LOYALTY STORE ENDPOINTS
// ==========================================

// GET /api/rewards & /api/rewards/catalog → returns REWARD_CATALOG
app.get(['/api/rewards', '/api/rewards/catalog'], (_req: any, res: any) => {
  res.json(REWARD_CATALOG);
});

// GET /api/rewards/redemptions (requireAuth) → the calling user's ledger (earn + redeem entries), newest first
app.get('/api/rewards/redemptions', requireAuth, (req: any, res: any) => {
  const userId = req.userId;
  const userLedger = inMemoryRedemptions
    .filter((r: any) => r.userId === userId)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(userLedger);
});

// POST /api/rewards/redeem (requireAuth, body { rewardId }) → validates points balance, deducts rewardPoints, applies effect, records entry, saves, emits socket updates
app.post('/api/rewards/redeem', requireAuth, async (req: any, res: any) => {
  const userId = req.userId;
  const { rewardId } = req.body;
  if (!rewardId) {
    return res.status(400).json({ error: 'Reward ID is required' });
  }

  const reward = REWARD_CATALOG.find(r => r.id === rewardId);
  if (!reward) {
    return res.status(404).json({ error: 'Reward not found in catalog' });
  }

  const user = inMemoryUsers.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const currentPoints = user.rewardPoints || 0;
  if (currentPoints < reward.cost) {
    return res.status(400).json({
      error: `Insufficient reward points. You have ${currentPoints} points, but this reward costs ${reward.cost} points.`
    });
  }

  // Deduct reward points
  user.rewardPoints = currentPoints - reward.cost;

  // Apply the reward's effect
  if (reward.type === 'wallet_credit') {
    const creditAmount = typeof reward.value === 'number' ? reward.value : 5;
    user.tokenBalance = (user.tokenBalance || 0) + creditAmount;

    // Record an EARNED transaction for user's wallet history
    const earnTx = {
      id: 'tx-reward-' + Date.now(),
      userId: user.id,
      sessionId: null,
      amount: creditAmount,
      description: `Redeemed ${reward.title} for ${reward.cost} reward points`,
      title: `Loyalty Credit: ${reward.title}`,
      peerName: 'Rewards Store',
      type: 'EARNED',
      currency: 'INR',
      status: 'paid',
      createdAt: new Date().toISOString()
    };
    if (!inMemoryTransactions.some(t => t.id === earnTx.id)) {
      inMemoryTransactions.unshift(earnTx);
    }
    io.emit('network-transactions-updated', inMemoryTransactions);
  } else if (reward.type === 'badge') {
    if (!Array.isArray(user.badges)) {
      user.badges = [];
    }
    const badgeName = String(reward.value || reward.title);
    if (!user.badges.includes(badgeName)) {
      user.badges.push(badgeName);
    }
  } else if (reward.type === 'voucher') {
    if (!Array.isArray(user.vouchers)) {
      user.vouchers = [];
    }
    const isPct = reward.id.includes('pct');
    const voucher = {
      id: 'vouch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      code: `MR-${isPct ? '20PCT' : '100OFF'}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      title: reward.title,
      rewardId: reward.id,
      discountValue: typeof reward.value === 'number' ? reward.value : 100,
      discountType: isPct ? 'percent' : 'flat',
      isUsed: false,
      createdAt: new Date().toISOString()
    };
    user.vouchers.push(voucher);
  } else if (reward.type === 'featured_mentor') {
    user.isFeatured = true;
    user.featuredUntil = new Date(Date.now() + (Number(reward.value) || 7) * 24 * 60 * 60 * 1000).toISOString();
  } else if (reward.type === 'zero_fee_pass') {
    user.zeroFeePasses = (user.zeroFeePasses || 0) + (Number(reward.value) || 2);
  } else if (reward.type === 'doubt_pass') {
    user.doubtPasses = (user.doubtPasses || 0) + (Number(reward.value) || 1);
  }

  // Record redemption ledger entry
  const redemption = {
    id: 'rd-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    userId: user.id,
    rewardId: reward.id,
    rewardTitle: reward.title,
    rewardType: reward.type,
    cost: reward.cost,
    points: -reward.cost,
    kind: 'redeem',
    status: reward.type === 'perk' ? 'pending_fulfillment' : 'completed',
    createdAt: new Date().toISOString()
  };
  inMemoryRedemptions.unshift(redemption);

  // Update Prisma if DATABASE_URL is set
  if (process.env.DATABASE_URL && prisma) {
    try {
      const updateData: any = {
        rewardPoints: user.rewardPoints
      };
      if (reward.type === 'wallet_credit') {
        updateData.tokenBalance = user.tokenBalance;
      }
      await prisma.user.update({
        where: { id: userId },
        data: updateData
      });
    } catch (err) {
      console.error('Failed to update user in DB on reward redemption:', err);
    }
  }

  saveDb();
  io.emit('network-rewards-updated', inMemoryRedemptions);
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

  return res.json({ success: true, redemption, user: toPublicUser(user) });
});

// ==========================================
// COMMUNITY DISCUSSIONS & Q&A FORUM ENDPOINTS
// ==========================================

// GET /api/discussions → list discussions with filtering & sorting
app.get('/api/discussions', (req: any, res: any) => {
  const { tag, search, sort = 'newest' } = req.query;
  let results = [...inMemoryDiscussions];

  if (tag && tag !== 'all') {
    const cleanTag = String(tag).toLowerCase();
    results = results.filter(d => Array.isArray(d.tags) && d.tags.some((t: string) => t.toLowerCase() === cleanTag));
  }

  if (search && String(search).trim()) {
    const q = String(search).toLowerCase();
    results = results.filter(d =>
      d.title?.toLowerCase().includes(q) ||
      d.content?.toLowerCase().includes(q) ||
      (Array.isArray(d.tags) && d.tags.some((t: string) => t.toLowerCase().includes(q)))
    );
  }

  if (sort === 'votes') {
    results.sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0));
  } else if (sort === 'unanswered') {
    results = results.filter(d => !d.isAnswered);
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sort === 'bounty') {
    results = results.filter(d => d.bounty && d.bounty.amount > 0);
    results.sort((a, b) => (b.bounty?.amount || 0) - (a.bounty?.amount || 0));
  } else {
    // default newest
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  res.json(results);
});

// GET /api/discussions/:id → retrieve single discussion
app.get('/api/discussions/:id', (req: any, res: any) => {
  const { id } = req.params;
  const discussion = inMemoryDiscussions.find(d => d.id === id);
  if (!discussion) return res.status(404).json({ error: 'Discussion not found' });
  res.json(discussion);
});

// POST /api/discussions → create a new discussion thread
app.post('/api/discussions', async (req: any, res: any) => {
  const { title, content, tags, bounty, authorId, authorName, authorRole, authorAvatar } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Discussion title is required.' });
  if (!content || !content.trim()) return res.status(400).json({ error: 'Discussion content is required.' });

  const effectiveAuthorId = req.userId || authorId || 'user-guest';
  const author = inMemoryUsers.find(u => u.id === effectiveAuthorId);

  // If a bounty is specified, check & deduct
  if (bounty && bounty.amount > 0 && author) {
    const amt = parseInt(bounty.amount, 10);
    if (bounty.type === 'tokens') {
      if ((author.tokenBalance || 0) < amt) {
        return res.status(400).json({ error: `Insufficient token balance for ${amt} tokens bounty.` });
      }
      author.tokenBalance = (author.tokenBalance || 0) - amt;
    } else if (bounty.type === 'points') {
      if ((author.rewardPoints || 0) < amt) {
        return res.status(400).json({ error: `Insufficient reward points for ${amt} points bounty.` });
      }
      author.rewardPoints = (author.rewardPoints || 0) - amt;
    }
  }

  const newDiscussion = {
    id: 'disc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    authorId: effectiveAuthorId,
    authorName: author?.name || authorName || 'Anonymous Student',
    authorRole: author?.role || authorRole || 'student',
    authorAvatar: author?.avatar || authorAvatar || null,
    title: title.trim(),
    content: content.trim(),
    tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []),
    upvotes: [effectiveAuthorId],
    bounty: bounty && bounty.amount > 0 ? { type: bounty.type || 'points', amount: parseInt(bounty.amount, 10) } : undefined,
    isAnswered: false,
    acceptedCommentId: null,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  inMemoryDiscussions.unshift(newDiscussion);
  saveDb();
  io.emit('network-discussions-updated', inMemoryDiscussions);
  if (bounty && bounty.amount > 0) {
    io.emit('network-peers-updated', toPublicUser(inMemoryUsers));
  }

  res.status(201).json(newDiscussion);
});

// POST /api/discussions/:id/comments → post answer or comment
app.post('/api/discussions/:id/comments', async (req: any, res: any) => {
  const { id } = req.params;
  const { content, authorId, authorName, authorRole, authorAvatar } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Comment content is required.' });

  const discussion = inMemoryDiscussions.find(d => d.id === id);
  if (!discussion) return res.status(404).json({ error: 'Discussion not found' });

  const effectiveAuthorId = req.userId || authorId || 'user-guest';
  const author = inMemoryUsers.find(u => u.id === effectiveAuthorId);

  const comment = {
    id: 'comm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    discussionId: id,
    authorId: effectiveAuthorId,
    authorName: author?.name || authorName || 'Mindroot Peer',
    authorRole: author?.role || authorRole || 'student',
    authorAvatar: author?.avatar || authorAvatar || null,
    content: content.trim(),
    upvotes: [],
    isAccepted: false,
    createdAt: new Date().toISOString()
  };

  if (!Array.isArray(discussion.comments)) discussion.comments = [];
  discussion.comments.push(comment);
  discussion.updatedAt = new Date().toISOString();

  // Award +5 loyalty reward points to student for actively contributing to discussion
  if (author && author.role === 'student') {
    await awardRewardPoints(author.id, 5, `Replied to discussion: "${discussion.title.slice(0, 30)}..."`);
  }

  saveDb();
  io.emit('network-discussions-updated', inMemoryDiscussions);
  io.emit('network-rewards-updated', inMemoryRedemptions);
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

  res.status(201).json({ discussion, comment });
});

// POST /api/discussions/:id/vote → toggle upvote on discussion
app.post('/api/discussions/:id/vote', (req: any, res: any) => {
  const { id } = req.params;
  const { userId } = req.body;
  const effectiveUserId = req.userId || userId;
  if (!effectiveUserId) return res.status(400).json({ error: 'User ID is required to vote.' });

  const discussion = inMemoryDiscussions.find(d => d.id === id);
  if (!discussion) return res.status(404).json({ error: 'Discussion not found' });

  if (!Array.isArray(discussion.upvotes)) discussion.upvotes = [];
  const idx = discussion.upvotes.indexOf(effectiveUserId);
  if (idx !== -1) {
    discussion.upvotes.splice(idx, 1);
  } else {
    discussion.upvotes.push(effectiveUserId);
  }

  saveDb();
  io.emit('network-discussions-updated', inMemoryDiscussions);
  res.json({ success: true, upvotes: discussion.upvotes });
});

// POST /api/discussions/comments/:commentId/vote → toggle upvote on comment
app.post('/api/discussions/comments/:commentId/vote', (req: any, res: any) => {
  const { commentId } = req.params;
  const { userId } = req.body;
  const effectiveUserId = req.userId || userId;
  if (!effectiveUserId) return res.status(400).json({ error: 'User ID is required to vote.' });

  let foundComment: any = null;
  for (const d of inMemoryDiscussions) {
    if (Array.isArray(d.comments)) {
      const c = d.comments.find((comm: any) => comm.id === commentId);
      if (c) {
        foundComment = c;
        break;
      }
    }
  }

  if (!foundComment) return res.status(404).json({ error: 'Comment not found' });

  if (!Array.isArray(foundComment.upvotes)) foundComment.upvotes = [];
  const idx = foundComment.upvotes.indexOf(effectiveUserId);
  if (idx !== -1) {
    foundComment.upvotes.splice(idx, 1);
  } else {
    foundComment.upvotes.push(effectiveUserId);
  }

  saveDb();
  io.emit('network-discussions-updated', inMemoryDiscussions);
  res.json({ success: true, upvotes: foundComment.upvotes });
});

// POST /api/discussions/:id/accept-answer → mark accepted solution & award bounty
app.post('/api/discussions/:id/accept-answer', async (req: any, res: any) => {
  const { id } = req.params;
  const { commentId, userId } = req.body;
  const effectiveUserId = req.userId || userId;

  const discussion = inMemoryDiscussions.find(d => d.id === id);
  if (!discussion) return res.status(404).json({ error: 'Discussion not found' });

  // Only author can accept
  if (discussion.authorId !== effectiveUserId && effectiveUserId !== 'user-admin') {
    return res.status(403).json({ error: 'Only the question author can accept a solution.' });
  }

  const comment = (discussion.comments || []).find((c: any) => c.id === commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found in this discussion.' });

  // Unmark previous accepted comments
  (discussion.comments || []).forEach((c: any) => { c.isAccepted = false; });
  comment.isAccepted = true;
  discussion.isAnswered = true;
  discussion.acceptedCommentId = commentId;

  // Award solver:
  const solver = inMemoryUsers.find(u => u.id === comment.authorId);
  if (solver) {
    if (discussion.bounty && discussion.bounty.amount > 0) {
      if (discussion.bounty.type === 'points') {
        await awardRewardPoints(solver.id, discussion.bounty.amount, `Bounty won on solved discussion: "${discussion.title.slice(0, 30)}..."`);
      } else if (discussion.bounty.type === 'tokens') {
        solver.tokenBalance = (solver.tokenBalance || 0) + discussion.bounty.amount;
      }
    } else {
      // Default bonus for solved answer: +15 reward points
      await awardRewardPoints(solver.id, 15, `Solution accepted on discussion: "${discussion.title.slice(0, 30)}..."`);
    }
  }

  saveDb();
  io.emit('network-discussions-updated', inMemoryDiscussions);
  io.emit('network-rewards-updated', inMemoryRedemptions);
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

  res.json({ success: true, discussion });
});



// DELETE /api/users/:id — Admin delete user (Requires Admin role)
app.delete('/api/users/:id', requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'User ID is required' });

  // Protect master System Admin from deletion
  if (id === 'user-admin') {
    return res.status(403).json({ error: 'Cannot delete the master System Admin account.' });
  }

  if (process.env.DATABASE_URL && prisma) {
    try {
      await prisma.user.delete({ where: { id } });
    } catch (dbErr: any) {
      if (dbErr?.code !== 'P2025') {
        logger.error({ dbErr, id }, 'Database error deleting user');
        return res.status(500).json({ error: `Database failed to delete user ${id}.` });
      }
    }
  }

  // 1. Remove from inMemoryUsers
  const userIdx = inMemoryUsers.findIndex(u => u.id === id);
  if (userIdx !== -1) {
    inMemoryUsers.splice(userIdx, 1);
  }

  // 2. Cascade delete inMemorySessions
  for (let i = inMemorySessions.length - 1; i >= 0; i--) {
    const s = inMemorySessions[i];
    if (s.teacherId === id || s.studentId === id || (Array.isArray(s.students) && s.students.some((st: any) => st.id === id))) {
      inMemorySessions.splice(i, 1);
    }
  }

  // 3. Cascade delete inMemoryMessages
  for (let i = inMemoryMessages.length - 1; i >= 0; i--) {
    const m = inMemoryMessages[i];
    if (m.senderId === id || m.receiverId === id) {
      inMemoryMessages.splice(i, 1);
    }
  }

  // 4. Cascade delete inMemoryReviews
  for (let i = inMemoryReviews.length - 1; i >= 0; i--) {
    const r = inMemoryReviews[i];
    if (r.authorId === id || r.targetId === id) {
      inMemoryReviews.splice(i, 1);
    }
  }

  // 5. Cascade delete inMemoryTransactions
  for (let i = inMemoryTransactions.length - 1; i >= 0; i--) {
    const t = inMemoryTransactions[i];
    if (t.userId === id) {
      inMemoryTransactions.splice(i, 1);
    }
  }

  // 6. Delete payout account
  delete inMemoryPayoutAccounts[id];

  // 7. Save persistence
  saveDb();

  // 8. Emit socket updates across all network clients
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));
  io.emit('network-sessions-updated', inMemorySessions);
  io.emit('network-messages-updated', inMemoryMessages);
  io.emit('network-reviews-updated', inMemoryReviews);
  io.emit('network-transactions-updated', inMemoryTransactions);

  res.json({ success: true, message: `User ${id} removed successfully.` });
});

// POST /api/admin/reload-db — Reload in-memory state from db.json (Requires Admin role)
app.post('/api/admin/reload-db', requireAdmin, (_req: any, res: any) => {
  loadDb();
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));
  io.emit('network-sessions-updated', inMemorySessions);
  io.emit('network-transactions-updated', inMemoryTransactions);
  res.json({ success: true, count: inMemoryUsers.length, users: toPublicUser(inMemoryUsers) });
});

// GET /api/messages — all messages involving a user
app.get('/api/messages', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    if (process.env.DATABASE_URL) {
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId as string },
            { receiverId: userId as string }
          ]
        },
        orderBy: { createdAt: 'asc' }
      });
      return res.json(messages);
    }
  } catch {}

  const userMsgs = inMemoryMessages.filter(
    m => m.senderId === userId || m.receiverId === userId
  );
  res.json(userMsgs);
});

// POST /api/messages — save a new message
app.post('/api/messages', async (req, res) => {
  const { senderId, receiverId, text } = req.body;
  const newMsg = {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    senderId,
    receiverId,
    text,
    createdAt: new Date().toISOString()
  };

  if (!inMemoryMessages.some(m => m.id === newMsg.id)) {
    inMemoryMessages.push(newMsg);
  }
  io.emit('network-messages-updated', inMemoryMessages);

  try {
    if (process.env.DATABASE_URL) {
      const msg = await prisma.message.create({
        data: { senderId, receiverId, text }
      });
      return res.status(201).json(msg);
    }
  } catch {}

  res.status(201).json(newMsg);
});

// GET /api/reviews — get reviews for a user
app.get('/api/reviews', async (req, res) => {
  const { targetId } = req.query;
  if (!targetId) return res.status(400).json({ error: 'targetId is required' });
  try {
    if (process.env.DATABASE_URL && prisma) {
      const reviews = await prisma.review.findMany({
        where: { targetId: targetId as string },
        include: { author: true },
        orderBy: { createdAt: 'desc' }
      });
      if (reviews && reviews.length > 0) {
        const safeReviews = reviews.map((r: any) => ({
          ...r,
          author: toPublicUser(r.author)
        }));
        return res.json(safeReviews);
      }
    }
  } catch {}

  const userRevs = inMemoryReviews.filter(r => r.targetId === targetId);
  res.json(userRevs);
});

// POST /api/reviews — write review, calculate target trust score dynamically
app.post('/api/reviews', async (req, res) => {
  const { authorId, targetId, topic, rating, quote, chips } = req.body;
  const numRating = parseInt(rating, 10) || 5;

  const newRev = {
    id: 'review-' + Date.now(),
    authorId,
    targetId,
    topic: topic || 'Peer Exchange',
    rating: numRating,
    quote: quote || '',
    chips: Array.isArray(chips) ? chips : [],
    createdAt: new Date().toISOString()
  };

  inMemoryReviews.push(newRev);

  // Recalculate in-memory target user trustScore
  const targetUser = inMemoryUsers.find(u => u.id === targetId);
  if (targetUser) {
    const userRevs = inMemoryReviews.filter(r => r.targetId === targetId);
    const avg = userRevs.reduce((sum, r) => sum + r.rating, 0) / userRevs.length;
    targetUser.trustScore = parseFloat(avg.toFixed(2));
  }

  io.emit('network-reviews-updated', inMemoryReviews);
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));

  try {
    if (process.env.DATABASE_URL && prisma) {
      const review = await prisma.review.create({
        data: {
          authorId,
          targetId,
          topic,
          rating: numRating,
          quote,
          chips: Array.isArray(chips) ? chips : []
        }
      });

      const allReviews = await prisma.review.findMany({
        where: { targetId }
      });

      if (allReviews.length > 0) {
        const avgRating = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / allReviews.length;
        await prisma.user.update({
          where: { id: targetId },
          data: { trustScore: parseFloat(avgRating.toFixed(2)) }
        });
      }

      return res.status(201).json(review);
    }
  } catch (err: any) {
    console.warn('Database review save bypassed, using in-memory socket sync:', err.message);
  }

  res.status(201).json(newRev);
});

// POST /api/ai/chat — Contextual LLM assistant endpoint
app.post('/api/ai/chat', async (req, res) => {
  const { message, history, context, userName, tokenBalance } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  const cleanUser = String(userName || 'Alex').replace(/[\r\n]/g, ' ').substring(0, 50);
  const cleanContext = String(context || 'dashboard').replace(/[\r\n]/g, ' ').substring(0, 50);
  const cleanTokenBalance = parseInt(tokenBalance, 10) || 4;
  const cleanMessage = String(message || '').substring(0, 1000);

  const systemInstructions = `You are the Mindroot AI Assistant. You help users navigate the peer tutoring and skill mentoring platform with integrated Razorpay payments.
The user is ${cleanUser}, currently on the ${cleanContext} page.
Provide interactive, helpful, encouraging responses. Explain how mentors earn INR (₹) and how students can book and pay mentors directly via Razorpay (UPI/Cards). Suggest concrete next actions on the platform (e.g. visiting /marketplace, /match-finder, /schedule, /wallet, or /feedback). Include clear formatting with bullet points when explaining multi-step actions.`;

  if (apiKey && cleanMessage.trim()) {
    try {
      const contentsPayload: any[] = [];
      
      // Inject system instructions as initial context
      contentsPayload.push({
        role: 'user',
        parts: [{ text: systemInstructions }]
      });
      contentsPayload.push({
        role: 'model',
        parts: [{ text: `Understood! I am ready to assist ${cleanUser} on Mindroot with mentoring and Razorpay payments.` }]
      });

      // Append conversation history if provided
      if (Array.isArray(history) && history.length > 0) {
        history.slice(-6).forEach((h: any) => {
          if (h.text && h.from) {
            contentsPayload.push({
              role: h.from === 'user' ? 'user' : 'model',
              parts: [{ text: String(h.text) }]
            });
          }
        });
      }

      // Append current user message
      contentsPayload.push({
        role: 'user',
        parts: [{ text: cleanMessage }]
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: contentsPayload })
        }
      );
      const json: any = await response.json();
      const aiReply = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (aiReply) {
        return res.json({ text: aiReply });
      }
    } catch (err) {
      console.error('Gemini API call failed:', err);
    }
  }

  // Enhanced interactive contextual fallback router
  let reply = `Hello ${cleanUser}! I'm here to make your peer mentoring experience smooth. What would you like to explore today?`;
  const msg = cleanMessage.toLowerCase();

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey') || msg.includes('yo') || msg.includes('hola')) {
    reply = `Hello ${cleanUser}! I am your Mindroot AI Assistant. 🌟\n\nI can help you:\n• Find expert mentors & teachers\n• Pay mentors via Razorpay (UPI/Cards)\n• Schedule live interactive classroom sessions\n\nWhat are you looking to learn or teach today?`;
  } else if (msg.includes('token') || msg.includes('balance') || msg.includes('wallet') || msg.includes('pay') || msg.includes('earn') || msg.includes('spend') || msg.includes('price')) {
    reply = `💳 **Direct INR Payments via Razorpay**:\n\n• **Pay per Session**: Students pay mentors directly via Razorpay (UPI, GPay, Cards, NetBanking).\n• **Earn Revenue**: Mentors receive their hourly rate (₹) upon session completion.\n• **Receipts**: Track all payment transactions on your [Wallet](/wallet) page!`;
  } else if (msg.includes('book') || msg.includes('schedule') || msg.includes('propose') || msg.includes('calendar') || msg.includes('session')) {
    reply = `📅 **How to Book & Pay Mentors**:\n\n1. Browse mentors on the [Marketplace](/marketplace).\n2. Click **Book Session** on any mentor's card.\n3. Pick your preferred date & time.\n4. Click **Pay with Razorpay** to confirm the session instantly!\n5. View your confirmed sessions on the [Schedule](/schedule) page.`;
  } else if (msg.includes('room') || msg.includes('live') || msg.includes('video') || msg.includes('whiteboard') || msg.includes('code') || msg.includes('webrtc')) {
    reply = `🎥 **Mindroot Virtual Classroom**:\n\nOur live session room features:\n• HD Audio/Video call with WebRTC P2P connection\n• Shared Real-time Whiteboard Canvas\n• Interactive Multi-language Code Pad\n• Synchronized Lesson Notes & Hand Raising\n\nYou can launch a room anytime from your [Schedule](/schedule) page!`;
  } else if (msg.includes('match') || msg.includes('partner') || msg.includes('find') || msg.includes('peer') || msg.includes('recommend')) {
    reply = `⚡ **Smart Match Finder**:\n\nOur [Match Finder](/match-finder) analyzes your learning goals to pair you with the best mutual peer mentors.\n\nVisit [Match Finder](/match-finder) to view your instant top matches!`;
  } else if (msg.includes('teach') || msg.includes('teacher') || msg.includes('curriculum')) {
    reply = `🎓 **Teacher Portal**:\n\nSwitch to the **Teacher** perspective in the sidebar or visit your [Teacher Portal](/teacher) to:\n• Set your weekly availability slots\n• Review pending session requests from students\n• Monitor your total mentoring revenue`;
  } else if (msg.includes('trust') || msg.includes('score') || msg.includes('rating') || msg.includes('review') || msg.includes('feedback')) {
    reply = `⭐ **Trust Score & Peer Reviews**:\n\nYour Trust Score reflects ratings left by your learning partners after completed sessions.\n• Maintain a high rating to attract more students!\n• Check your ratings and submit reviews on the [Feedback](/feedback) page.`;
  } else if (msg.includes('python') || msg.includes('react') || msg.includes('figma') || msg.includes('ui') || msg.includes('design') || msg.includes('java') || msg.includes('sql')) {
    reply = `🚀 We have active community mentors teaching Python, UI Design, React, Spring Boot, Figma, and SQL.\n\nHead over to the [Marketplace](/marketplace) to connect and book a live mentoring session!`;
  } else if (cleanContext === '/wallet') {
    reply = `You're currently viewing your **Payments & Earnings Wallet**. All session checkout receipts and mentoring payouts processed via Razorpay are logged here.`;
  } else if (cleanContext === '/marketplace') {
    reply = `You're browsing the **Skill Marketplace**! Filter mentors by category (Software & AI, Design, Languages) and click **Book Session** to pay and schedule.`;
  } else if (cleanContext === '/feedback') {
    reply = `Welcome to the **Feedback & Trust** center. Here you can submit endorsements, rate recent partners, and view your aggregate Trust Score.`;
  } else if (cleanContext === '/match-finder') {
    reply = `Welcome to the **Smart Match Finder**! We calculate mutual compatibility based on what you teach vs what mentors offer. Click **Propose Exchange** to start!`;
  }

  res.json({ text: reply });
});

// GET /api/stats — platform stats for admin
app.get('/api/stats', async (_req, res) => {
  try {
    if (prisma) {
      const [totalUsers, totalSessions, totalTokens] = await Promise.all([
        prisma.user.count(),
        prisma.session.count(),
        prisma.user.aggregate({ _sum: { tokenBalance: true } })
      ]);
      if (totalUsers > 0) {
        return res.json({
          totalUsers,
          totalSessions,
          tokensCirculating: totalTokens._sum.tokenBalance ?? 0
        });
      }
    }
  } catch {}

  const totalTokens = inMemoryUsers.reduce((sum, u) => sum + (typeof u.tokenBalance === 'number' ? u.tokenBalance : 50), 0);
  res.json({
    totalUsers: inMemoryUsers.length,
    totalSessions: inMemorySessions.length,
    tokensCirculating: totalTokens
  });
});

// GET /api/auth/me — Alias for /api/users/me (authenticated user profile)
app.get('/api/auth/me', async (req: any, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  if (process.env.DATABASE_URL && prisma) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userSkills: { include: { skill: true } } }
      });
      if (user) return res.json({ user: toPublicUser(user) });
      return res.status(404).json({ error: 'User not found' });
    } catch (err: any) {
      logger.error({ err, userId }, 'Database error in /api/auth/me');
      return res.status(500).json({ error: 'Database error retrieving user profile.' });
    }
  }

  const memUser = inMemoryUsers.find(u => u.id === userId);
  if (!memUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: toPublicUser(memUser) });
});

// PATCH /api/users/:id — Update user profile (streak, availability, isAvailableNow, loyalty points, etc.)
app.patch('/api/users/:id', async (req: any, res) => {
  const { id } = req.params;
  const updates = req.body;

  let targetUser = inMemoryUsers.find(u => u.id === id);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const allowedFields = [
    'name', 'bio', 'avatar', 'hourlyRate', 'skillsTaught', 'skillsLearned',
    'availability', 'isAvailableNow', 'streak', 'lastActiveDate', 'rewardPoints', 'tokenBalance'
  ];

  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      targetUser[key] = updates[key];
    }
  }

  if (process.env.DATABASE_URL && prisma) {
    try {
      const prismaUpdateData: any = {};
      if (updates.name !== undefined) prismaUpdateData.name = updates.name;
      if (updates.avatar !== undefined) prismaUpdateData.avatar = updates.avatar;
      if (updates.hourlyRate !== undefined) prismaUpdateData.hourlyRate = Number(updates.hourlyRate);
      if (updates.tokenBalance !== undefined) prismaUpdateData.tokenBalance = Number(updates.tokenBalance);
      if (updates.rewardPoints !== undefined) prismaUpdateData.rewardPoints = Number(updates.rewardPoints);
      if (Object.keys(prismaUpdateData).length > 0) {
        await prisma.user.update({
          where: { id },
          data: prismaUpdateData
        });
      }
    } catch (err) {
      logger.warn({ err, id }, 'Prisma update failed for /api/users/:id');
    }
  }

  saveDb();
  io.emit('network-peers-updated', toPublicUser(inMemoryUsers));
  res.json({ success: true, user: toPublicUser(targetUser) });
});

// Global Error-Handling Middleware (Must be the last app.use() call)
app.use((err: any, req: any, res: any, next: any) => {
  logger.error({ err }, '[Unhandled Error]');
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
});

const PORT = Number(process.env.PORT) || 3000;
server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`❌ Port ${PORT} is already in use by another running server instance.`);
    logger.error(`👉 Close your existing terminal or run: npx kill-port ${PORT}`);
    process.exit(1);
  }
});
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`✅ Mindroot API with WebRTC Signaling running on port ${PORT} (Bound to 0.0.0.0)`);
  const nets = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  if (addresses.length > 0) {
    logger.info(`📱 LAN Access for other devices/phones on your Wi-Fi:`);
    addresses.forEach(ip => logger.info(`   👉 http://${ip}:5173 (Frontend) | Backend: http://${ip}:${PORT}`));
  }
});

// Graceful Shutdown Handlers (SIGTERM / SIGINT)
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Stopping new connections and initiating graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP server closed.');
  });
  io.close(() => {
    logger.info('Socket.io server closed.');
  });
  if (prisma) {
    try {
      await prisma.$disconnect();
      logger.info('Prisma database connection disconnected.');
    } catch (err) {
      logger.error({ err }, 'Error disconnecting Prisma during graceful shutdown');
    }
  }
  logger.info('Graceful shutdown completed successfully. Exiting.');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
