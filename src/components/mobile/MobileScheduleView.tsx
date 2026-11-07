import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { getUserTimezone, getTimezoneAbbreviation } from '../../lib/timezone';

interface MobileScheduleViewProps {
  sessions: any[];
  currentUser: any;
  onBookNewSession?: () => void;
  onOpenUpiPayment?: (session: any) => void;
}

export function MobileScheduleView({
  sessions,
  currentUser,
  onBookNewSession,
  onOpenUpiPayment,
}: MobileScheduleViewProps) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const userTz = getUserTimezone();
  const tzAbbr = getTimezoneAbbreviation(userTz);

  // Unpaid sessions requiring payment
  const unpaidSessions = useMemo(() => {
    if (!Array.isArray(sessions)) return [];
    return sessions.filter((s: any) => {
      const isTeacher = s.teacherId === currentUser?.id || s.teacher?.id === currentUser?.id;
      const isPaid = s.paymentStatus === 'paid' || s.isPaid;
      return !isTeacher && !isPaid && s.status !== 'cancelled' && s.status !== 'declined';
    });
  }, [sessions, currentUser]);

  // Generate 7-day strip around the current week of selectedDate
  const weekDays = useMemo(() => {
    const curr = new Date(selectedDate);
    const day = curr.getDay(); // 0 is Sunday, 1 is Monday...
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(curr.setDate(diff));

    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      // Check if any sessions exist on this date
      const hasSessions = Array.isArray(sessions) && sessions.some((s: any) => {
        if (!s.scheduledAt && !s.startTime) return false;
        const sDate = (s.scheduledAt || s.startTime).split('T')[0];
        return sDate === dateStr && s.status !== 'cancelled' && s.status !== 'declined';
      });

      days.push({
        dateObj: d,
        dayName: dayNames[i],
        dayNumber: d.getDate(),
        dateStr,
        hasSessions,
        isToday: d.toDateString() === new Date().toDateString(),
        isSelected: d.toDateString() === selectedDate.toDateString(),
      });
    }
    return days;
  }, [selectedDate, sessions]);

  // Navigate week
  const handlePrevWeek = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 7);
    setSelectedDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7);
    setSelectedDate(next);
  };

  // Filter sessions for selected date
  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const daySessions = useMemo(() => {
    if (!Array.isArray(sessions)) return [];
    return sessions
      .filter((s: any) => {
        if (!s.scheduledAt && !s.startTime) return false;
        const sDate = (s.scheduledAt || s.startTime).split('T')[0];
        return sDate === selectedDateStr && s.status !== 'cancelled' && s.status !== 'declined';
      })
      .sort((a: any, b: any) => {
        const timeA = new Date(a.scheduledAt || a.startTime).getTime();
        const timeB = new Date(b.scheduledAt || b.startTime).getTime();
        return timeA - timeB;
      });
  }, [sessions, selectedDateStr]);

  const monthYearLabel = selectedDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col w-full pb-8 select-none">
      {/* Unpaid Sessions Banner for Students */}
      {unpaidSessions.map((session: any) => {
        const amt = session.pricePerStudent || session.amount || session.price || session.teacher?.hourlyRate || 499;
        return (
          <div key={session.id} className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col gap-2 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">payments</span>
                Pending Payment Required
              </span>
              <span className="text-xs font-black text-primary">₹{amt}</span>
            </div>
            <p className="text-xs text-text font-semibold truncate">{session.title || 'Peer Mentorship Session'}</p>
            <button
              type="button"
              onClick={() => onOpenUpiPayment?.(session)}
              className="w-full py-1.5 px-3 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">payments</span>
              <span>Pay ₹{amt} to Mentor via UPI</span>
            </button>
          </div>
        );
      })}

      {/* 1. Interactive 7-Day Date Strip */}
      <div className="bg-surface border border-border rounded-2xl p-3 shadow-xs mb-4">
        {/* Month & Arrow Navigation */}
        <div className="flex items-center justify-between text-xs text-muted px-1 mb-2.5">
          <div className="flex items-center gap-1 font-bold text-text">
            <span>{monthYearLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className="px-2 py-0.5 mr-1 rounded-md bg-surface-2 border border-border text-[10px] font-bold text-text hover:bg-surface transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handlePrevWeek}
              aria-label="Previous week"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-muted hover:text-text cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              aria-label="Next week"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-muted hover:text-text cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>

        {/* 7 Days Row */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => setSelectedDate(day.dateObj)}
              className={clsx(
                "flex flex-col items-center py-2 px-1 rounded-xl transition-all cursor-pointer relative",
                day.isSelected
                  ? "bg-primary text-on-primary shadow-xs font-bold scale-[1.02]"
                  : "hover:bg-surface-2 text-text"
              )}
            >
              <span className={clsx(
                "text-[10px] uppercase font-bold tracking-wider mb-1",
                day.isSelected ? "text-on-primary/90" : "text-muted"
              )}>
                {day.dayName}
              </span>
              <span className="text-sm font-extrabold">
                {day.dayNumber}
              </span>

              {/* Indicator Dot for Days with Sessions */}
              {day.hasSessions && !day.isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
              )}
              {day.hasSessions && day.isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-on-primary mt-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Selected Day Header Banner */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs font-bold text-text">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <span className="text-[10px] font-mono font-bold text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">
          {tzAbbr}
        </span>
      </div>

      {/* 3. Vertical Timeline Flow */}
      <div className="flex flex-col gap-3">
        {daySessions.length > 0 ? (
          daySessions.map((session: any) => {
            const timeObj = new Date(session.scheduledAt || session.startTime);
            const timeFormatted = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const ampm = timeFormatted.slice(-2);
            const timeWithoutAmPm = timeFormatted.replace(/ AM| PM/i, '');

            const isTeacher = session.teacherId === currentUser?.id || session.teacher?.id === currentUser?.id;
            const peer = isTeacher ? session.student : session.teacher;
            const isConfirmed = session.status === 'confirmed';
            const isUnpaidStudent = !isTeacher && session.paymentStatus !== 'paid' && (session.price > 0 || session.pricePerStudent > 0);

            return (
              <div key={session.id} className="flex gap-2.5 items-start">
                {/* Left Time Column */}
                <div className="w-14 pt-2.5 flex flex-col items-end shrink-0">
                  <span className="text-xs font-bold text-text">
                    {timeWithoutAmPm}
                  </span>
                  <span className="text-[10px] font-bold text-muted">
                    {ampm}
                  </span>
                  {isConfirmed && (
                    <span className="mt-1 text-primary text-[10px] font-bold">
                      Soon
                    </span>
                  )}
                </div>

                {/* Session Card */}
                <div className="flex-1 bg-surface border border-border rounded-2xl p-3.5 shadow-xs flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={clsx(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold",
                        isConfirmed ? "bg-primary-tint/40 text-primary border border-primary/20" : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      )}>
                        {isConfirmed ? 'Confirmed' : 'Pending Approval'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-2 text-muted text-[10px] font-medium border border-border">
                        {isTeacher ? 'You are teaching' : '1:1 Mentorship'}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-text truncate">
                    {session.title || 'Peer Mentorship Session'}
                  </h3>

                  <div className="flex items-center gap-2">
                    <img
                      src={peer?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80'}
                      alt={peer?.name}
                      className="w-5 h-5 rounded-full object-cover border border-border shrink-0"
                    />
                    <p className="text-xs text-muted truncate">
                      with {peer?.name || 'Peer Scholar'} • {session.durationMin || 60} mins
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-border mt-1 gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-muted">
                      <span className="material-symbols-outlined text-sm text-primary">videocam</span>
                      <span>WebRTC Live Room</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isUnpaidStudent && (
                        <button
                          type="button"
                          onClick={() => onOpenUpiPayment?.(session)}
                          className="h-8 px-3.5 rounded-lg bg-primary hover:bg-primary-hover active:scale-95 text-on-primary text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">payments</span>
                          <span>Pay ₹{session.pricePerStudent || session.price || 499} to Mentor via UPI</span>
                        </button>
                      )}

                      {isConfirmed ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/live/${session.id}`)}
                          className="h-8 px-3.5 rounded-lg bg-surface border border-border hover:bg-surface-2 active:scale-95 text-text text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                        >
                          <span>Join Room</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted italic">
                          Awaiting confirmation
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-surface border border-border rounded-2xl p-6 text-center shadow-xs flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-3xl text-muted">event_busy</span>
            <p className="text-xs font-bold text-text">No sessions on this day</p>
            <p className="text-[11px] text-muted max-w-xs">
              You have free time available to learn or teach.
            </p>
            {onBookNewSession && (
              <button
                type="button"
                onClick={onBookNewSession}
                className="mt-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-hover active:scale-95 transition-all shadow-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>Book New Session</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
