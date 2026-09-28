import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class InsufficientTokensError extends Error {
  public statusCode = 400;
  public available: number;
  public required: number;

  constructor(message: string, available: number, required: number) {
    super(message);
    this.name = 'InsufficientTokensError';
    this.available = available;
    this.required = required;
  }
}

export class ConcurrencyConflictError extends Error {
  public statusCode = 409;
  constructor(message: string = 'Concurrent update conflict detected. Please retry.') {
    super(message);
    this.name = 'ConcurrencyConflictError';
  }
}

/**
 * KeyedMutex serializes concurrent async operations for the same key (e.g. userId)
 * in the Node.js event loop, preventing in-process race conditions.
 */
export class KeyedMutex {
  private queues = new Map<string, Promise<any>>();

  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const currentQueue = this.queues.get(key) || Promise.resolve();

    let releaseLock: () => void;
    const nextQueue = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // Replace the queue promise for this key
    this.queues.set(key, currentQueue.then(() => nextQueue));

    try {
      // Wait for any prior operation on this key to finish
      await currentQueue;
      return await fn();
    } finally {
      releaseLock!();
      if (this.queues.get(key) === nextQueue) {
        this.queues.delete(key);
      }
    }
  }
}

export const userMutex = new KeyedMutex();

/**
 * Acquire multiple keyed locks in consistent lexicographical order to prevent deadlocks.
 */
export async function withOrderedLocks<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
  const sorted = [...new Set(keys.filter(Boolean))].sort();
  const acquire = async (idx: number): Promise<T> => {
    if (idx >= sorted.length) return fn();
    return userMutex.runExclusive(sorted[idx], () => acquire(idx + 1));
  };
  return acquire(0);
}

export interface TokenOperationDependencies {
  prisma: any;
  inMemoryUsers: any[];
  inMemorySessions: any[];
  inMemoryTransactions: any[];
  saveDb: () => void;
  io?: any;
}

/**
 * Atomically book a session using tokens.
 * Wraps user balance deduction, transaction logging (with before/after balance),
 * and session status update into a single atomic transaction.
 */
export async function bookSessionWithTokens(
  deps: TokenOperationDependencies,
  params: {
    studentId: string;
    teacherId: string;
    title: string;
    skillId?: string | null;
    scheduledAt: string | Date;
    durationMin?: number;
    tokenCost: number;
    maxCapacity?: number;
    isSwap?: boolean;
    giveSkill?: string | null;
    takeSkill?: string | null;
    teacherObj?: any;
    studentObj?: any;
  }
) {
  const { studentId, teacherId, title, scheduledAt, durationMin = 60, tokenCost, maxCapacity = 1 } = params;

  if (tokenCost < 0) {
    throw new Error('Token cost cannot be negative.');
  }

  return userMutex.runExclusive(studentId, async () => {
    const scheduledDate = new Date(scheduledAt);
    const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const txId = 'tx-token-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const teacher = params.teacherObj || deps.inMemoryUsers.find(u => u.id === teacherId) || { id: teacherId, name: 'Mentor', hourlyRate: 499 };
    const student = params.studentObj || deps.inMemoryUsers.find(u => u.id === studentId) || { id: studentId, name: 'Student' };

    let dbSession: any = null;
    let dbTransaction: any = null;
    let balanceBefore = 0;
    let balanceAfter = 0;

    // 1. If Prisma and database connection are active, execute via Prisma $transaction
    if (deps.prisma && process.env.DATABASE_URL) {
      try {
        const result = await deps.prisma.$transaction(async (tx: any) => {
          // Row-level lock on User
          const rawUsers: any[] = await tx.$queryRaw`
            SELECT "id", "tokenBalance", "version", "name"
            FROM "User"
            WHERE "id" = ${studentId}
            FOR UPDATE
          `;

          let dbUser = rawUsers && rawUsers.length > 0 ? rawUsers[0] : null;
          if (!dbUser) {
            dbUser = await tx.user.findUnique({ where: { id: studentId } });
          }

          if (!dbUser) {
            throw new Error(`Student user with ID "${studentId}" not found in database.`);
          }

          const currentBalance = dbUser.tokenBalance;
          if (currentBalance < tokenCost) {
            throw new InsufficientTokensError(
              `Insufficient token balance. You have ${currentBalance} tokens, but ${tokenCost} tokens are required to book this session.`,
              currentBalance,
              tokenCost
            );
          }

          const newBalance = currentBalance - tokenCost;
          if (newBalance < 0) {
            throw new InsufficientTokensError('Transaction rejected: Balance cannot become negative.', currentBalance, tokenCost);
          }

          balanceBefore = currentBalance;
          balanceAfter = newBalance;

          // Optimistic Concurrency & atomic decrement
          const currentVersion = dbUser.version || 0;
          await tx.user.update({
            where: { id: studentId },
            data: {
              tokenBalance: newBalance,
              version: currentVersion + 1
            }
          });

          // Create confirmed Session
          const session = await tx.session.create({
            data: {
              id: sessionId,
              title,
              teacherId,
              studentId,
              skillId: params.skillId || null,
              isSwap: Boolean(params.isSwap),
              giveSkill: params.giveSkill || null,
              takeSkill: params.takeSkill || null,
              status: 'confirmed',
              paymentStatus: 'paid',
              paymentId: txId,
              pricePerStudent: tokenCost,
              amount: tokenCost,
              maxCapacity,
              scheduledAt: scheduledDate,
              durationMin
            }
          });

          // Create Transaction record with before/after balance audit trail
          const transaction = await tx.transaction.create({
            data: {
              id: txId,
              userId: studentId,
              sessionId: session.id,
              amount: tokenCost,
              description: `Paid ${tokenCost} token(s) for session: ${title}`,
              title: `Session Booking: ${title}`,
              peerName: teacher.name || 'Mentor',
              type: 'SPENT',
              balanceBefore,
              balanceAfter,
              paymentId: txId,
              currency: 'TOKENS',
              status: 'paid'
            }
          });

          return { session, transaction, balanceBefore, balanceAfter };
        });

        dbSession = result.session;
        dbTransaction = result.transaction;
      } catch (err: any) {
        if (err instanceof InsufficientTokensError || err instanceof ConcurrencyConflictError) {
          throw err;
        }
        logger.error({ err }, 'Prisma $transaction booking failed');
        if (process.env.DATABASE_URL) {
          if (process.env.ALLOW_UNSAFE_IN_MEMORY_FAILOVER === 'true') {
            logger.warn('⚠️ UNSAFE FAILOVER: Falling back to in-memory store because ALLOW_UNSAFE_IN_MEMORY_FAILOVER=true');
          } else {
            const dbError: any = new Error('Database service unavailable. Operation aborted to protect ledger integrity.');
            dbError.statusCode = 503;
            throw dbError;
          }
        }
      }
    }

    // 2. Synchronize In-Memory & Fallback Persistence
    const memStudent = deps.inMemoryUsers.find(u => u.id === studentId);
    if (!dbSession) {
      if (!memStudent) {
        throw new Error(`Student user with ID "${studentId}" not found.`);
      }
      // In-memory atomic validation
      const currentMemBalance = typeof memStudent.tokenBalance === 'number' ? memStudent.tokenBalance : 0;
      if (currentMemBalance < tokenCost) {
        throw new InsufficientTokensError(
          `Insufficient token balance. You have ${currentMemBalance} tokens, but ${tokenCost} tokens are required to book this session.`,
          currentMemBalance,
          tokenCost
        );
      }

      balanceBefore = currentMemBalance;
      balanceAfter = currentMemBalance - tokenCost;
      if (balanceAfter < 0) {
        throw new InsufficientTokensError('Transaction rejected: Balance cannot become negative.', currentMemBalance, tokenCost);
      }
    }

    if (memStudent) {
      memStudent.tokenBalance = balanceAfter;
    }

    const sessionPayload: any = {
      id: sessionId,
      title,
      teacherId,
      studentId,
      proposerId: studentId,
      isSwap: Boolean(params.isSwap),
      giveSkill: params.giveSkill || null,
      takeSkill: params.takeSkill || null,
      teacher,
      student,
      maxCapacity,
      pricePerStudent: tokenCost,
      amount: tokenCost,
      students: [
        {
          id: studentId,
          name: student.name,
          avatar: student.avatar || 'https://i.pravatar.cc/150?img=11',
          enrolledAt: new Date().toISOString(),
          paymentStatus: 'paid',
          paymentId: txId,
          amountPaid: tokenCost,
          amountDue: 0
        }
      ],
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentId: txId,
      scheduledAt: scheduledDate.toISOString(),
      durationMin
    };

    const transactionPayload: any = {
      id: txId,
      userId: studentId,
      sessionId,
      amount: tokenCost,
      description: `Paid ${tokenCost} token(s) for session: ${title}`,
      title: `Session Booking: ${title}`,
      peerName: teacher.name || 'Mentor',
      type: 'SPENT',
      balanceBefore,
      balanceAfter,
      paymentId: txId,
      currency: 'TOKENS',
      status: 'paid',
      createdAt: new Date().toISOString()
    };

    deps.inMemorySessions.push(sessionPayload);
    deps.inMemoryTransactions.unshift(transactionPayload);
    deps.saveDb();

    logger.info(
      { userId: studentId, tokenCost, balanceBefore, balanceAfter, sessionId, txId },
      '[TokenService] Atomic session booking completed successfully'
    );

    return {
      session: sessionPayload,
      transaction: transactionPayload,
      balanceBefore,
      balanceAfter
    };
  });
}

/**
 * Atomically deduct tokens from a user (e.g. for bounties, withdrawal, penalty)
 * Ensures user has sufficient balance and records balanceBefore/balanceAfter.
 */
export async function deductTokensAtomic(
  deps: TokenOperationDependencies,
  params: {
    userId: string;
    amount: number;
    reason: string;
    sessionId?: string;
    peerName?: string;
    currency?: string;
    paymentId?: string;
  }
) {
  const { userId, amount, reason, sessionId, peerName, currency = 'TOKENS', paymentId } = params;

  if (amount <= 0) {
    throw new Error('Deduction amount must be greater than zero.');
  }

  return userMutex.runExclusive(userId, async () => {
    const txId = paymentId || ('tx-deduct-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));
    let balanceBefore = 0;
    let balanceAfter = 0;

    if (deps.prisma && process.env.DATABASE_URL) {
      try {
        await deps.prisma.$transaction(async (tx: any) => {
          const rawUsers: any[] = await tx.$queryRaw`
            SELECT "id", "tokenBalance", "version"
            FROM "User"
            WHERE "id" = ${userId}
            FOR UPDATE
          `;

          let dbUser = rawUsers && rawUsers.length > 0 ? rawUsers[0] : null;
          if (!dbUser) dbUser = await tx.user.findUnique({ where: { id: userId } });

          if (!dbUser) throw new Error(`User "${userId}" not found in database.`);

          const current = dbUser.tokenBalance;
          if (current < amount) {
            throw new InsufficientTokensError(`Insufficient token balance (Available: ${current}, Required: ${amount})`, current, amount);
          }

          balanceBefore = current;
          balanceAfter = current - amount;
          if (balanceAfter < 0) {
            throw new InsufficientTokensError('Transaction rejected: Balance cannot become negative.', current, amount);
          }

          await tx.user.update({
            where: { id: userId },
            data: {
              tokenBalance: balanceAfter,
              version: { increment: 1 }
            }
          });

          await tx.transaction.create({
            data: {
              id: txId,
              userId,
              sessionId: sessionId || null,
              amount,
              description: reason,
              title: reason,
              peerName: peerName || 'Platform',
              type: 'SPENT',
              balanceBefore,
              balanceAfter,
              paymentId: txId,
              currency,
              status: 'paid'
            }
          });
        });
      } catch (err: any) {
        if (err instanceof InsufficientTokensError) throw err;
        logger.error({ err }, 'Prisma deductTokensAtomic failed');
        if (process.env.DATABASE_URL) {
          if (process.env.ALLOW_UNSAFE_IN_MEMORY_FAILOVER === 'true') {
            logger.warn('⚠️ UNSAFE FAILOVER: Falling back to in-memory store because ALLOW_UNSAFE_IN_MEMORY_FAILOVER=true');
          } else {
            const dbError: any = new Error('Database service unavailable. Operation aborted to protect ledger integrity.');
            dbError.statusCode = 503;
            throw dbError;
          }
        }
      }
    }

    const memUser = deps.inMemoryUsers.find(u => u.id === userId);
    if (balanceBefore === 0 && balanceAfter === 0) {
      if (!memUser) {
        throw new Error(`User with ID "${userId}" not found.`);
      }
      const current = currency === 'INR'
        ? (typeof memUser.inrWalletBalance === 'number' ? memUser.inrWalletBalance : 0)
        : (typeof memUser.tokenBalance === 'number' ? memUser.tokenBalance : 0);
      if (current < amount) {
        throw new InsufficientTokensError(`Insufficient balance (Available: ${current}, Required: ${amount})`, current, amount);
      }
      balanceBefore = current;
      balanceAfter = current - amount;
      if (balanceAfter < 0) {
        throw new InsufficientTokensError('Transaction rejected: Balance cannot become negative.', current, amount);
      }
    }

    if (memUser) {
      if (currency === 'INR') {
        memUser.inrWalletBalance = balanceAfter;
      } else {
        memUser.tokenBalance = balanceAfter;
      }
    }

    const txRecord = {
      id: txId,
      userId,
      sessionId: sessionId || null,
      amount,
      description: reason,
      title: reason,
      peerName: peerName || 'Platform',
      type: 'SPENT',
      balanceBefore,
      balanceAfter,
      paymentId: txId,
      currency,
      status: 'paid',
      createdAt: new Date().toISOString()
    };

    deps.inMemoryTransactions.unshift(txRecord);
    deps.saveDb();

    logger.info({ userId, amount, balanceBefore, balanceAfter, reason }, '[TokenService] Deducted tokens atomically');

    return { balanceBefore, balanceAfter, transaction: txRecord };
  });
}

/**
 * Atomically credit tokens to a user (e.g. mentor earnings, loyalty redemption, bounty solve)
 * Records balanceBefore and balanceAfter.
 */
export async function creditTokensAtomic(
  deps: TokenOperationDependencies,
  params: {
    userId: string;
    amount: number;
    reason: string;
    sessionId?: string;
    peerName?: string;
    currency?: string;
    paymentId?: string;
  }
) {
  const { userId, amount, reason, sessionId, peerName, currency = 'TOKENS', paymentId } = params;

  if (amount <= 0) {
    throw new Error('Credit amount must be greater than zero.');
  }

  return userMutex.runExclusive(userId, async () => {
    const txId = paymentId || ('tx-credit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));
    let balanceBefore = 0;
    let balanceAfter = 0;

    if (deps.prisma && process.env.DATABASE_URL) {
      try {
        await deps.prisma.$transaction(async (tx: any) => {
          const rawUsers: any[] = await tx.$queryRaw`
            SELECT "id", "tokenBalance", "version"
            FROM "User"
            WHERE "id" = ${userId}
            FOR UPDATE
          `;

          let dbUser = rawUsers && rawUsers.length > 0 ? rawUsers[0] : null;
          if (!dbUser) dbUser = await tx.user.findUnique({ where: { id: userId } });

          if (dbUser) {
            balanceBefore = dbUser.tokenBalance;
            balanceAfter = balanceBefore + amount;

            await tx.user.update({
              where: { id: userId },
              data: {
                tokenBalance: balanceAfter,
                version: { increment: 1 }
              }
            });

            await tx.transaction.create({
              data: {
                id: txId,
                userId,
                sessionId: sessionId || null,
                amount,
                description: reason,
                title: reason,
                peerName: peerName || 'Platform',
                type: 'EARNED',
                balanceBefore,
                balanceAfter,
                paymentId: txId,
                currency,
                status: 'paid'
              }
            });
          }
        });
      } catch (err: any) {
        logger.error({ err }, 'Prisma creditTokensAtomic failed');
        if (process.env.DATABASE_URL) {
          if (process.env.ALLOW_UNSAFE_IN_MEMORY_FAILOVER === 'true') {
            logger.warn('⚠️ UNSAFE FAILOVER: Falling back to in-memory store because ALLOW_UNSAFE_IN_MEMORY_FAILOVER=true');
          } else {
            const dbError: any = new Error('Database service unavailable. Operation aborted to protect ledger integrity.');
            dbError.statusCode = 503;
            throw dbError;
          }
        }
      }
    }

    const memUser = deps.inMemoryUsers.find(u => u.id === userId);
    if (balanceBefore === 0 && balanceAfter === 0 && memUser) {
      if (currency === 'INR') {
        balanceBefore = typeof memUser.inrWalletBalance === 'number' ? memUser.inrWalletBalance : 0;
      } else {
        balanceBefore = typeof memUser.tokenBalance === 'number' ? memUser.tokenBalance : 50;
      }
      balanceAfter = balanceBefore + amount;
    }

    if (memUser) {
      if (currency === 'INR') {
        memUser.inrWalletBalance = balanceAfter;
        memUser.totalEarned = (memUser.totalEarned || 0) + amount;
      } else {
        memUser.tokenBalance = balanceAfter;
      }
    }

    const txRecord = {
      id: txId,
      userId,
      sessionId: sessionId || null,
      amount,
      description: reason,
      title: reason,
      peerName: peerName || 'Platform',
      type: 'EARNED',
      balanceBefore,
      balanceAfter,
      paymentId: txId,
      currency,
      status: 'paid',
      createdAt: new Date().toISOString()
    };

    deps.inMemoryTransactions.unshift(txRecord);
    deps.saveDb();

    logger.info({ userId, amount, balanceBefore, balanceAfter, reason }, '[TokenService] Credited tokens atomically');

    return { balanceBefore, balanceAfter, transaction: txRecord };
  });
}
