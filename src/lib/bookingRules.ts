// Booking rules, interval overlap, and availability slot calculation (Client)

export const ACTIVE_SESSION_STATUSES = ['pending', 'confirmed', 'live', 'accepted'] as const;
export const EXCLUDED_STATUSES = ['cancelled', 'rejected', 'declined', 'expired', 'completed'] as const;

export interface SessionInterval {
  id?: string;
  teacherId?: string;
  teacher?: { id?: string };
  scheduledAt: string | Date;
  durationMin?: number;
  status: string;
}

/**
 * Checks whether two time intervals [startA, endA) and [startB, endB) overlap.
 * Uses end-exclusive comparison: startA < endB && endA > startB.
 */
export function doIntervalsOverlap(
  startA: number,
  durationA: number,
  startB: number,
  durationB: number
): boolean {
  const endA = startA + durationA;
  const endB = startB + durationB;
  return startA < endB && endA > startB;
}

/**
 * Determines whether a session blocks a given slot:
 * - Belongs strictly to the requested teacherId (not student, not other mentors)
 * - Status must be active ('pending', 'confirmed', 'live', 'accepted')
 * - Explicitly excludes 'cancelled', 'rejected', 'declined', 'expired', 'completed'
 * - Time ranges overlap with end-exclusive comparison, all compared as UTC instants
 */
export function isSlotConflicting(
  sessions: SessionInterval[],
  teacherId: string,
  reqStart: number, // UTC timestamp in ms
  reqDurationMin: number = 60,
  ignoreSessionId?: string
): SessionInterval | undefined {
  if (!teacherId || !Array.isArray(sessions) || sessions.length === 0) return undefined;
  const reqDurationMs = Math.max(15, reqDurationMin || 60) * 60 * 1000;

  return sessions.find(s => {
    if (!s) return false;
    if (ignoreSessionId && s.id === ignoreSessionId) return false;

    const sStatus = (s.status || '').toLowerCase().trim();
    if (EXCLUDED_STATUSES.includes(sStatus as any)) return false;
    if (!ACTIVE_SESSION_STATUSES.includes(sStatus as any)) return false;

    const tId = s.teacherId || s.teacher?.id;
    if (!tId || tId !== teacherId) return false;

    const sStart = new Date(s.scheduledAt).getTime();
    if (isNaN(sStart)) return false;
    const sDurationMs = Math.max(15, s.durationMin || 60) * 60 * 1000;

    return doIntervalsOverlap(reqStart, reqDurationMs, sStart, sDurationMs);
  });
}

/**
 * Filters all active booked sessions for a specific teacher, optionally bounded by [fromMs, toMs].
 */
export function getTeacherActiveBookings(
  sessions: SessionInterval[],
  teacherId: string,
  fromMs?: number,
  toMs?: number
): SessionInterval[] {
  if (!teacherId || !Array.isArray(sessions)) return [];
  return sessions.filter(s => {
    if (!s) return false;
    const sStatus = (s.status || '').toLowerCase().trim();
    if (EXCLUDED_STATUSES.includes(sStatus as any)) return false;
    if (!ACTIVE_SESSION_STATUSES.includes(sStatus as any)) return false;

    const tId = s.teacherId || s.teacher?.id;
    if (!tId || tId !== teacherId) return false;

    const sStart = new Date(s.scheduledAt).getTime();
    if (isNaN(sStart)) return false;
    const sDurationMs = Math.max(15, s.durationMin || 60) * 60 * 1000;
    const sEnd = sStart + sDurationMs;

    if (fromMs !== undefined && sEnd <= fromMs) return false;
    if (toMs !== undefined && sStart >= toMs) return false;
    return true;
  });
}
