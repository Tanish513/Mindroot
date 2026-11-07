import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';

interface MobileDashboardViewProps {
  currentUser: any;
  streakDays: number;
  sessions: any[];
  peers: any[];
  onConnectPeer?: (peer: any) => void;
}

export function MobileDashboardView({
  currentUser,
  streakDays,
  sessions,
  peers,
  onConnectPeer,
}: MobileDashboardViewProps) {
  const navigate = useNavigate();

  // Find next upcoming session
  const nextSession = useMemo(() => {
    if (!Array.isArray(sessions) || sessions.length === 0) return null;
    const now = Date.now();
    const upcoming = sessions
      .filter((s: any) => s.status !== 'cancelled' && s.status !== 'declined')
      .map((s: any) => {
        const start = s.startTime ? new Date(s.startTime).getTime() : 0;
        return { ...s, startTimeMs: start };
      })
      .filter((s: any) => s.startTimeMs > now - 3600000) // Within past hour or future
      .sort((a: any, b: any) => a.startTimeMs - b.startTimeMs);

    return upcoming[0] || null;
  }, [sessions]);

  // Dynamic Greeting based on current hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Compute Onboarding checklist states
  const hasProfileSkills = Boolean(
    currentUser?.userSkills && currentUser.userSkills.length > 0
  );
  const hasCompletedSession = useMemo(() => {
    return Array.isArray(sessions) && sessions.some((s: any) => s.status === 'completed');
  }, [sessions]);
  const hasBookedSession = Boolean(sessions && sessions.length > 0);

  // Trust score & tokens
  const trustScorePercent = Math.min(
    100,
    Math.round((currentUser?.trustScore || 4.95) * 20)
  );
  const tokenBalance = currentUser?.tokenBalance ?? 250;
  const learningGoalsCount = Array.isArray(currentUser?.userSkills)
    ? currentUser.userSkills.filter((us: any) => us.type === 'wants_to_learn').length || 3
    : 3;

  return (
    <div className="flex flex-col w-full pb-8 select-none">
      {/* 1. Greeting & Balance Sub-header */}
      <section className="mb-4 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">
            {greeting}, {currentUser?.name?.split(' ')[0] || 'Scholar'}
          </h1>
          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent-tint text-accent text-xs font-bold border border-accent/20">
            <span className="material-symbols-outlined text-sm text-accent">local_fire_department</span>
            <span>{streakDays || 2}d streak</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{currentUser?.role === 'teacher' ? 'Faculty Mentor' : 'Student Scholar'}</span>
          <span className="w-1 h-1 rounded-full bg-border"></span>
          <span className="font-bold text-primary">{tokenBalance} tokens available</span>
        </div>
      </section>

      {/* 2. Focal Point: Next Session Hero Card */}
      <section className="mb-4">
        {nextSession ? (
          <div className="w-full bg-surface border border-border rounded-2xl shadow-xs p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="font-bold uppercase tracking-wider text-primary text-[11px]">
                  Upcoming Class
                </span>
              </div>
              <span className="text-muted font-medium">
                {nextSession.startTime
                  ? new Date(nextSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Today'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Next up</span>
              <h2 className="text-base font-bold text-text truncate">
                {nextSession.title || 'Peer Mentorship Session'}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span className="material-symbols-outlined text-sm text-primary">school</span>
                <span className="truncate">
                  with {nextSession.teacher?.name || nextSession.student?.name || 'Peer Mentor'}
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/live-room')}
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.99] text-on-primary font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">videocam</span>
              <span>Join Live Room Now</span>
            </button>
          </div>
        ) : (
          <div className="w-full bg-surface border border-border rounded-2xl shadow-xs p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-text">Ready to learn or teach?</span>
              <span className="text-primary text-[11px] font-bold">1 hr = 1 token</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Find an expert peer or schedule your next learning exchange without upfront fees.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Link
                to="/schedule"
                className="h-10 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-1 hover:bg-primary-hover transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">calendar_month</span>
                <span>Schedule</span>
              </Link>
              <Link
                to="/marketplace"
                className="h-10 rounded-xl border border-primary text-primary bg-primary-tint/30 text-xs font-bold flex items-center justify-center gap-1 hover:bg-primary-tint/60 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">handshake</span>
                <span>Find Match</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* 3. 2x2 Minimalist Stats Grid */}
      <section className="mb-4">
        <div className="w-full bg-surface border border-border rounded-2xl p-4 shadow-xs">
          <div className="grid grid-cols-2 gap-3 divide-x divide-border">
            {/* Stat 1: Hours Learned */}
            <div className="flex flex-col pr-2">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-text">
                  {currentUser?.hoursLearned || 12}
                </span>
                <span className="text-xs font-bold text-muted">hrs</span>
              </div>
              <span className="text-[11px] text-muted mt-0.5">Hours learned</span>
            </div>

            {/* Stat 2: Tokens Exchanged */}
            <div className="flex flex-col pl-4">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-text">
                  {currentUser?.tokenBalance || 250}
                </span>
                <span className="text-xs font-bold text-primary">pts</span>
              </div>
              <span className="text-[11px] text-muted mt-0.5">Skill tokens</span>
            </div>
          </div>

          <div className="border-t border-border mt-3 pt-3 grid grid-cols-2 gap-3 divide-x divide-border">
            {/* Stat 3: Goals on Track */}
            <div className="flex flex-col pr-2">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-text">
                  {learningGoalsCount}
                </span>
                <span className="text-xs font-bold text-muted">goals</span>
              </div>
              <span className="text-[11px] text-muted mt-0.5">Active goals</span>
            </div>

            {/* Stat 4: Reliability Score */}
            <div className="flex flex-col pl-4">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-text">
                  {trustScorePercent}%
                </span>
              </div>
              <span className="text-[11px] text-muted mt-0.5">Reliability score</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Compact Onboarding Checklist */}
      <section className="mb-4">
        <div className="w-full bg-surface border border-border rounded-2xl p-4 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1 border-b border-border">
            <span className="text-xs font-bold text-text">Get Started</span>
            <span className="text-[11px] font-bold text-primary">
              {hasCompletedSession ? 'Step 3 of 3' : hasBookedSession ? 'Step 2 of 3' : 'Step 1 of 3'}
            </span>
          </div>

          <div className="space-y-2">
            {/* Item 1 */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={clsx(
                  "material-symbols-outlined text-base",
                  hasProfileSkills ? "text-primary" : "text-muted"
                )}>
                  {hasProfileSkills ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className={hasProfileSkills ? 'line-through text-muted' : 'font-medium text-text'}>
                  Complete your profile skills
                </span>
              </div>
              {!hasProfileSkills && (
                <Link to="/profile" className="text-[11px] font-bold text-primary hover:underline">
                  Add →
                </Link>
              )}
            </div>

            {/* Item 2 */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={clsx(
                  "material-symbols-outlined text-base",
                  hasBookedSession ? "text-primary" : "text-muted"
                )}>
                  {hasBookedSession ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className={hasBookedSession ? 'line-through text-muted' : 'font-medium text-text'}>
                  Book your first peer session
                </span>
              </div>
              {!hasBookedSession && (
                <Link to="/marketplace" className="text-[11px] font-bold text-primary hover:underline">
                  Browse →
                </Link>
              )}
            </div>

            {/* Item 3 */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={clsx(
                  "material-symbols-outlined text-base",
                  hasCompletedSession ? "text-primary" : "text-muted"
                )}>
                  {hasCompletedSession ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className={hasCompletedSession ? 'line-through text-muted' : 'font-medium text-text'}>
                  Exchange a skill in Live Room
                </span>
              </div>
              {!hasCompletedSession && (
                <Link to="/live-room" className="text-[11px] font-bold text-primary hover:underline">
                  Join →
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Suggested Peer Mentors (Horizontal Swipe Carousel) */}
      <section className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-text uppercase tracking-wider">
            Suggested Peers
          </h3>
          <Link to="/marketplace" className="text-xs font-bold text-primary hover:underline">
            Browse all →
          </Link>
        </div>

        <div className="flex overflow-x-auto no-scrollbar gap-3 pb-1 -mx-4 px-4">
          {Array.isArray(peers) && peers.length > 0 ? (
            peers.slice(0, 6).map((peer: any) => {
              const skills = Array.isArray(peer.skillsTaught)
                ? peer.skillsTaught
                : Array.isArray(peer.userSkills)
                ? peer.userSkills.map((s: any) => s.skill?.name).filter(Boolean)
                : ['Coding', 'Design'];

              return (
                <div
                  key={peer.id}
                  className="min-w-[240px] max-w-[260px] bg-surface border border-border rounded-2xl p-3.5 shadow-xs flex flex-col justify-between shrink-0"
                >
                  <div className="flex items-start gap-2.5 mb-2.5">
                    <img
                      src={peer.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80'}
                      alt={peer.name}
                      className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-text truncate">
                          {peer.name}
                        </span>
                        <span className="material-symbols-outlined text-[14px] text-primary shrink-0" title="Verified">
                          verified
                        </span>
                      </div>
                      <span className="text-[10px] text-muted truncate block">
                        {peer.college || 'Peer Scholar'} • {peer.trustScore ? `${peer.trustScore}★` : '5.0★'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {skills.slice(0, 2).map((skill: string) => (
                      <span
                        key={skill}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-surface-2 text-text font-medium border border-border truncate"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs font-bold text-primary">
                      ₹{peer.hourlyRate || 399}/hr
                    </span>
                    <button
                      type="button"
                      onClick={() => onConnectPeer ? onConnectPeer(peer) : navigate(`/messages?peer=${peer.id}`)}
                      className="px-3 py-1 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-hover active:scale-95 transition-all cursor-pointer shadow-xs"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="w-full text-center py-6 text-xs text-muted">
              Loading recommended mentors...
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
