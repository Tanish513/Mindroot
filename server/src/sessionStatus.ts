/**
 * Canonical Session Status Definitions for Mindroot Platform
 * Single source of truth across client and server.
 */

export const SessionStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  LIVE: 'live',
  REJECTED: 'rejected',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  EXPIRED: 'expired'
} as const;

export type SessionStatusType = typeof SessionStatus[keyof typeof SessionStatus];

export const ACTIVE_SESSION_STATUSES: SessionStatusType[] = [
  SessionStatus.PENDING,
  SessionStatus.CONFIRMED,
  SessionStatus.LIVE
];

export const RESOLVED_SESSION_STATUSES: SessionStatusType[] = [
  SessionStatus.COMPLETED,
  SessionStatus.DECLINED,
  SessionStatus.REJECTED,
  SessionStatus.CANCELLED,
  SessionStatus.EXPIRED
];

/**
 * Normalizes a status string into canonical form (handles rejected/declined synonyms)
 */
export function normalizeSessionStatus(status?: string): SessionStatusType {
  const s = (status || '').toLowerCase().trim();
  if (s === 'rejected' || s === 'declined') return SessionStatus.DECLINED;
  if (s === 'confirmed' || s === 'accepted') return SessionStatus.CONFIRMED;
  if (s === 'live') return SessionStatus.LIVE;
  if (s === 'completed') return SessionStatus.COMPLETED;
  if (s === 'cancelled') return SessionStatus.CANCELLED;
  if (s === 'expired') return SessionStatus.EXPIRED;
  return SessionStatus.PENDING;
}
