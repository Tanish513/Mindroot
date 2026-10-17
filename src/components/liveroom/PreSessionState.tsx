import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export type SessionAccessState =
  | 'confirmed-early'
  | 'pending'
  | 'declined'
  | 'cancelled'
  | 'expired'
  | 'completed'
  | 'no-access'
  | 'ended';

interface PreSessionStateProps {
  state: SessionAccessState;
  session?: any;
  userRole?: string;
  onJoinLobby?: () => void;
}

export function PreSessionState({
  state,
  session,
  userRole = 'student',
  onJoinLobby
}: PreSessionStateProps) {
  const navigate = useNavigate();

  // Live countdown state for 'confirmed-early'
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; totalMs: number }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMs: 0
  });

  useEffect(() => {
    if (state !== 'confirmed-early' || !session?.scheduledAt) return;

    const calculateTime = () => {
      const startTime = new Date(session.scheduledAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, startTime - now);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, totalMs: diff });

      // If user enters within the 10-minute window, notify or allow lobby
      if (diff <= 10 * 60 * 1000 && onJoinLobby) {
        onJoinLobby();
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [state, session?.scheduledAt, onJoinLobby]);

  const handleDownloadCalendar = () => {
    if (!session || !session.scheduledAt) return;
    try {
      const start = new Date(session.scheduledAt);
      const end = new Date(start.getTime() + (session.durationMin || 60) * 60 * 1000);
      const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Mindroot//Peer Mentoring//EN',
        'BEGIN:VEVENT',
        `UID:session-${session.id}@mindroot.app`,
        `DTSTAMP:${formatDate(new Date())}`,
        `DTSTART:${formatDate(start)}`,
        `DTEND:${formatDate(end)}`,
        `SUMMARY:Mindroot Lecture: ${session.title || 'Peer Mentorship'}`,
        `DESCRIPTION:Join your live peer lecture on Mindroot: ${window.location.origin}/live-room/${session.id}`,
        `LOCATION:${window.location.origin}/live-room/${session.id}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${session.title || 'lecture'}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Failed to create calendar event:', e);
    }
  };

  const partnerObj = userRole === 'teacher' ? (session?.student || {}) : (session?.teacher || {});
  const partnerName = partnerObj.name || (userRole === 'teacher' ? 'Student' : 'Mentor');
  const partnerAvatar = partnerObj.avatar || (userRole === 'teacher' ? 'https://i.pravatar.cc/150?img=11' : 'https://i.pravatar.cc/150?img=12');

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] p-6 select-none">
      <div className="w-full max-w-xl bg-surface border border-outline-variant rounded-3xl p-6 md:p-8 shadow-elevation-2 text-center flex flex-col items-center">
        {/* CASE 1: Confirmed but Early */}
        {state === 'confirmed-early' && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-primary-container text-primary flex items-center justify-center mb-5 shadow-elevation-1">
              <span className="material-symbols-outlined text-3xl">alarm</span>
            </div>

            <span className="px-3 py-1 bg-teaching-emerald-container text-teaching-emerald font-bold text-xs rounded-full mb-3 border border-teaching-emerald/30">
              Session Confirmed
            </span>

            <h1 className="text-xl md:text-2xl font-black text-on-surface tracking-tight mb-2">
              {session?.title || 'Scheduled Peer Lecture'}
            </h1>

            <p className="text-xs text-on-surface-variant max-w-md mb-6">
              Starts on <span className="font-bold text-on-surface">{new Date(session?.scheduledAt).toLocaleString()}</span>
            </p>

            {/* Live Countdown Display */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex flex-col items-center bg-surface-container border border-outline-variant rounded-2xl px-4 py-3 min-w-[72px]">
                <span className="text-2xl md:text-3xl font-black text-primary font-mono">
                  {String(timeLeft.hours).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">Hours</span>
              </div>
              <span className="text-xl font-bold text-on-surface-variant">:</span>
              <div className="flex flex-col items-center bg-surface-container border border-outline-variant rounded-2xl px-4 py-3 min-w-[72px]">
                <span className="text-2xl md:text-3xl font-black text-primary font-mono">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">Mins</span>
              </div>
              <span className="text-xl font-bold text-on-surface-variant">:</span>
              <div className="flex flex-col items-center bg-surface-container border border-outline-variant rounded-2xl px-4 py-3 min-w-[72px]">
                <span className="text-2xl md:text-3xl font-black text-primary font-mono">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">Secs</span>
              </div>
            </div>

            {/* Partner Details */}
            <div className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface-container border border-outline-variant text-left mb-6">
              <img
                src={partnerAvatar}
                alt={partnerName}
                className="w-12 h-12 rounded-xl object-cover border border-outline-variant shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-on-surface truncate">{partnerName}</p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {userRole === 'teacher' ? 'Enrolled Student' : 'Host Mentor'} • {session?.durationMin || 60} mins
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 w-full">
              <button
                disabled
                className="w-full h-11 bg-surface-container-high text-on-surface-variant border border-outline-variant font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                title="Classroom access unlocks 10 minutes before start"
              >
                <span className="material-symbols-outlined text-base">lock_clock</span>
                <span>Join Classroom (Opens 10 mins before start)</span>
              </button>

              <div className="flex items-center gap-2.5 w-full">
                <button
                  onClick={handleDownloadCalendar}
                  className="flex-1 h-11 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">calendar_add_on</span>
                  <span>Add to Calendar</span>
                </button>

                <button
                  onClick={() => navigate('/schedule')}
                  className="flex-1 h-11 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">calendar_month</span>
                  <span>View Schedule</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* CASE 2: Pending Approval */}
        {state === 'pending' && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-learning-amber-container text-learning-amber flex items-center justify-center mb-5 shadow-elevation-1">
              <span className="material-symbols-outlined text-3xl">hourglass_top</span>
            </div>

            <h1 className="text-xl md:text-2xl font-black text-on-surface tracking-tight mb-2">
              Waiting for the mentor to accept
            </h1>

            <p className="text-xs text-on-surface-variant max-w-md mb-6 leading-relaxed">
              Your request for <span className="font-bold text-on-surface">"{session?.title || 'Mentoring Session'}"</span> has been submitted to {partnerName}. Once confirmed, the live room will be accessible.
            </p>

            <button
              onClick={() => navigate('/schedule')}
              className="w-full h-11 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">visibility</span>
              <span>View Request in Schedule</span>
            </button>
          </>
        )}

        {/* CASE 3: Declined, Cancelled, or Expired */}
        {(state === 'declined' || state === 'cancelled' || state === 'expired') && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-5 shadow-elevation-1">
              <span className="material-symbols-outlined text-3xl">event_busy</span>
            </div>

            <h1 className="text-xl md:text-2xl font-black text-on-surface tracking-tight mb-2">
              Session {state === 'declined' ? 'Declined' : (state === 'cancelled' ? 'Cancelled' : 'Expired')}
            </h1>

            <p className="text-xs text-on-surface-variant max-w-md mb-4 leading-relaxed">
              {session?.declineReason || session?.cancelReason || 'This booking request is no longer active.'}
            </p>

            {/* Token Refund Status Note */}
            <div className="w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/30 text-xs font-semibold mb-6 text-left">
              <span className="material-symbols-outlined text-lg text-teaching-emerald shrink-0">account_balance_wallet</span>
              <p>Refund note: Any tokens held for this booking have been fully refunded to your wallet.</p>
            </div>

            <div className="flex items-center gap-2.5 w-full">
              <button
                onClick={() => navigate('/schedule')}
                className="flex-1 h-11 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                <span>Rebook Session</span>
              </button>

              <button
                onClick={() => navigate('/marketplace')}
                className="flex-1 h-11 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">person_search</span>
                <span>Find Another Mentor</span>
              </button>
            </div>
          </>
        )}

        {/* CASE 4: Completed */}
        {state === 'completed' && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-teaching-emerald-container text-teaching-emerald flex items-center justify-center mb-5 shadow-elevation-1">
              <span className="material-symbols-outlined text-3xl">task_alt</span>
            </div>

            <h1 className="text-xl md:text-2xl font-black text-on-surface tracking-tight mb-2">
              Lecture Completed
            </h1>

            <p className="text-xs text-on-surface-variant max-w-md mb-6 leading-relaxed">
              You completed <span className="font-bold text-on-surface">"{session?.title || 'Mentoring Session'}"</span>. We hope you had a fruitful learning experience!
            </p>

            <div className="flex items-center gap-2.5 w-full">
              <button
                onClick={() => navigate('/feedback')}
                className="flex-1 h-11 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">rate_review</span>
                <span>Leave Feedback</span>
              </button>

              <button
                onClick={() => navigate('/wallet')}
                className="flex-1 h-11 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">receipt_long</span>
                <span>View Receipt</span>
              </button>
            </div>
          </>
        )}

        {/* CASE 5: No Access or Not Found */}
        {state === 'no-access' && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-5 shadow-elevation-1">
              <span className="material-symbols-outlined text-3xl">lock</span>
            </div>

            <h1 className="text-xl md:text-2xl font-black text-on-surface tracking-tight mb-2">
              You don't have access to this room
            </h1>

            <p className="text-xs text-on-surface-variant max-w-md mb-6 leading-relaxed">
              This classroom is restricted to the host mentor and enrolled cohort students.
            </p>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full h-11 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">dashboard</span>
              <span>Go to Dashboard</span>
            </button>
          </>
        )}

        {/* CASE 6: Session Ended */}
        {state === 'ended' && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-surface-container text-on-surface-variant flex items-center justify-center mb-5 shadow-elevation-1">
              <span className="material-symbols-outlined text-3xl">history_toggle_off</span>
            </div>

            <h1 className="text-xl md:text-2xl font-black text-on-surface tracking-tight mb-2">
              Session Ended
            </h1>

            <p className="text-xs text-on-surface-variant max-w-md mb-6 leading-relaxed">
              This lecture was scheduled for an earlier time and is now closed.
            </p>

            <div className="flex items-center gap-2.5 w-full">
              <button
                onClick={() => navigate('/schedule')}
                className="flex-1 h-11 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">calendar_month</span>
                <span>Schedule Next Session</span>
              </button>

              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 h-11 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">dashboard</span>
                <span>Go to Dashboard</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
