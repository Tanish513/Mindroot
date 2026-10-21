import { SessionStatus } from './sessionStatus';

/**
 * Shared service for retrieving bookings for a user.
 * Single source of truth used across Student Schedule, Teacher Schedule, and Teacher Portal.
 */
export function getBookingsForUser(
  sessions: any[],
  userId?: string,
  role?: 'student' | 'teacher' | 'both' | 'admin',
  statusFilter?: string
): any[] {
  if (!userId) return [];
  if (!Array.isArray(sessions)) return [];

  return sessions.filter(s => {
    if (!s) return false;
    const isTeacher = s.teacherId === userId || s.teacher?.id === userId;
    const isStudent = s.studentId === userId || s.student?.id === userId;
    const isInCohort = Array.isArray(s.students) && s.students.some((st: any) => st.id === userId);

    if (role === 'teacher') {
      if (!isTeacher) return false;
    } else if (role === 'student') {
      if (!isStudent && !isInCohort) return false;
    } else if (role !== 'admin') {
      if (!isTeacher && !isStudent && !isInCohort) return false;
    }

    if (statusFilter) {
      const canonicalStatus = s.status === 'accepted' ? SessionStatus.CONFIRMED : s.status;
      if (statusFilter === 'pending') {
        return canonicalStatus === SessionStatus.PENDING;
      }
      if (statusFilter === 'confirmed') {
        return canonicalStatus === SessionStatus.CONFIRMED || canonicalStatus === SessionStatus.LIVE;
      }
      if (statusFilter === 'completed') {
        return canonicalStatus === SessionStatus.COMPLETED;
      }
      if (statusFilter === 'declined' || statusFilter === 'rejected') {
        return canonicalStatus === SessionStatus.DECLINED || canonicalStatus === SessionStatus.REJECTED;
      }
      return canonicalStatus === statusFilter;
    }

    return true;
  });
}
