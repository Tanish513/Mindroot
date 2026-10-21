// Booking rules, interval overlap, and availability slot calculation

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
 * Adjacent intervals (e.g. 10:00-11:00 and 11:00-12:00) do NOT overlap.
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

/**
 * Converts calendar date + time in a target timezone to an exact UTC millisecond timestamp.
 */
export function getUtcTimestampFromTz(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string = 'Asia/Kolkata'
): number {
  const isoGuess = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
  const utcGuess = new Date(isoGuess).getTime();

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date(utcGuess));
    const partMap: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        partMap[p.type] = parseInt(p.value, 10);
      }
    }
    const tzHour = partMap.hour === 24 ? 0 : partMap.hour;
    const asTzUtc = Date.UTC(partMap.year, partMap.month - 1, partMap.day, tzHour, partMap.minute, partMap.second);
    const offset = asTzUtc - utcGuess;
    return utcGuess - offset;
  } catch {
    return utcGuess;
  }
}

/**
 * Finds the nearest available slot for a teacher:
 * - Only proposes times inside the teacher's weekly availability
 * - In the future (now + 10 minutes)
 * - Not already booked by any active session (pending, confirmed, live)
 * - If teacher has set no availability, returns null with clear message
 */
export function findNearestAvailableSlot(
  teacher: any,
  requestedISO: string,
  durationMin: number = 60,
  sessions: SessionInterval[] = [],
  timeZone: string = 'Asia/Kolkata'
): {
  nearestSlot: string | null;
  nearestSlotFormatted: string | null;
  hasAvailability: boolean;
  noAvailability?: boolean;
  message?: string;
} {
  const availability = teacher?.availability;
  if (!availability || typeof availability !== 'object') {
    return {
      nearestSlot: null,
      nearestSlotFormatted: null,
      hasAvailability: false,
      noAvailability: true,
      message: "This teacher hasn't set availability yet"
    };
  }

  // Extract open slots: e.g. "Mon-10:00 AM": true
  const openSlots = Object.entries(availability)
    .filter(([_, isOpen]) => Boolean(isOpen))
    .map(([key]) => key);

  if (openSlots.length === 0) {
    return {
      nearestSlot: null,
      nearestSlotFormatted: null,
      hasAvailability: false,
      noAvailability: true,
      message: "This teacher hasn't set availability yet"
    };
  }

  const dayNameMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };

  const parsedSlots: { dayOfWeek: number; hour: number; minute: number }[] = [];
  for (const slotKey of openSlots) {
    const dashIdx = slotKey.indexOf('-');
    if (dashIdx === -1) continue;
    const dayStr = slotKey.substring(0, dashIdx).trim();
    const timeStr = slotKey.substring(dashIdx + 1).trim();
    const dayOfWeek = dayNameMap[dayStr];
    if (dayOfWeek === undefined) continue;

    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) continue;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    parsedSlots.push({ dayOfWeek, hour: h, minute: m });
  }

  if (parsedSlots.length === 0) {
    return {
      nearestSlot: null,
      nearestSlotFormatted: null,
      hasAvailability: false,
      noAvailability: true,
      message: "This teacher hasn't set availability yet"
    };
  }

  const reqTime = new Date(requestedISO).getTime();
  const now = Date.now() + 10 * 60 * 1000; // minimum 10 min in the future
  const teacherId = teacher.id || teacherIdOrUndefined(teacher);

  const candidateDates: number[] = [];
  const startCheck = new Date();

  // Search through the next 28 days for candidate slots in the teacher's availability
  for (let dayOffset = 0; dayOffset <= 28; dayOffset++) {
    const d = new Date(startCheck.getTime() + dayOffset * 86400000);
    const tzString = d.toLocaleDateString('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const [mm, dd, yyyy] = tzString.split('/');

    for (const slot of parsedSlots) {
      // Check day of week for this calendar date
      const testDate = new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`);
      const weekdayStr = testDate.toLocaleDateString('en-US', { timeZone, weekday: 'short' });
      if (dayNameMap[weekdayStr] !== slot.dayOfWeek) continue;

      const candidateUtc = getUtcTimestampFromTz(Number(yyyy), Number(mm), Number(dd), slot.hour, slot.minute, timeZone);

      if (candidateUtc > now) {
        const conflict = isSlotConflicting(sessions, teacherId, candidateUtc, durationMin);
        if (!conflict) {
          candidateDates.push(candidateUtc);
        }
      }
    }
  }

  if (candidateDates.length === 0) {
    return {
      nearestSlot: null,
      nearestSlotFormatted: null,
      hasAvailability: true,
      message: "No open slots available in the next 4 weeks"
    };
  }

  // Pick candidate >= reqTime closest to reqTime, or earliest future candidate
  const futureOfReq = candidateDates.filter(t => t >= reqTime);
  const bestSlotTime = futureOfReq.length > 0
    ? futureOfReq.sort((a, b) => a - b)[0]
    : candidateDates.sort((a, b) => Math.abs(a - reqTime) - Math.abs(b - reqTime))[0];

  const bestDate = new Date(bestSlotTime);
  const bestISO = bestDate.toISOString();

  const dateFormatted = bestDate.toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' });
  const timeFormatted = bestDate.toLocaleTimeString('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: true });
  const nearestSlotFormatted = `${dateFormatted} at ${timeFormatted}`;

  return {
    nearestSlot: bestISO,
    nearestSlotFormatted,
    hasAvailability: true
  };
}

function teacherIdOrUndefined(t: any): string {
  return t?.id || '';
}
