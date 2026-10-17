import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

interface NoLectureScheduledProps {
  demoMode?: boolean;
}

export function NoLectureScheduled({ demoMode = false }: NoLectureScheduledProps) {
  const navigate = useNavigate();
  const [topMatch, setTopMatch] = useState<any | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);

  useEffect(() => {
    let active = true;
    api.getPeers()
      .then(peers => {
        if (!active || !Array.isArray(peers) || peers.length === 0) return;
        // Find top peer by rating / trustScore
        const sorted = [...peers].sort((a, b) => {
          const scoreA = (b.trustScore || b.rating || 5);
          const scoreB = (a.trustScore || a.rating || 5);
          return scoreA - scoreB;
        });
        setTopMatch(sorted[0] || null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingMatch(false);
      });

    return () => { active = false; };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] p-6 select-none">
      <div className="w-full max-w-xl bg-surface border border-outline-variant rounded-3xl p-8 shadow-elevation-2 text-center flex flex-col items-center">
        {/* Animated Icon Badge */}
        <div className="w-20 h-20 rounded-2xl bg-primary-container text-primary flex items-center justify-center mb-6 shadow-elevation-1">
          <span className="material-symbols-outlined text-4xl">event_busy</span>
        </div>

        {/* Title & Description */}
        <h1 className="text-2xl font-black tracking-tight text-on-surface mb-2">
          No lecture scheduled
        </h1>
        <p className="text-sm text-on-surface-variant max-w-md mb-8 leading-relaxed">
          You don't have an active or upcoming peer lecture right now. Explore peer mentors in our community or schedule your next session.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full mb-8">
          <button
            onClick={() => navigate('/match-finder')}
            className="flex-1 min-w-[160px] h-12 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">search_check</span>
            <span>Find a Match</span>
          </button>

          <button
            onClick={() => navigate('/schedule')}
            className="flex-1 min-w-[160px] h-12 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-elevation-1 transition-all active:scale-98 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">calendar_today</span>
            <span>Schedule Session</span>
          </button>

          {demoMode && (
            <button
              onClick={() => navigate('/live-room/practice')}
              className="w-full h-11 bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/30 hover:bg-teaching-emerald hover:text-on-teaching-emerald font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer mt-1"
            >
              <span className="material-symbols-outlined text-lg">videocam</span>
              <span>Enter Practice / Device Check Room</span>
            </button>
          )}
        </div>

        {/* Top Peer Match Recommendation Card */}
        {topMatch && !loadingMatch && (
          <div className="w-full border-t border-outline-variant pt-6 text-left">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary">auto_awesome</span>
                Top Recommended Peer Mentor
              </span>
              <span className="text-xs font-bold text-teaching-emerald bg-teaching-emerald-container px-2 py-0.5 rounded-full">
                98% Match
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-container border border-outline-variant hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={topMatch.avatar || 'https://i.pravatar.cc/150?img=33'}
                  alt={topMatch.name}
                  className="w-12 h-12 rounded-xl object-cover border border-outline-variant shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-on-surface truncate">
                    {topMatch.name}
                  </h3>
                  <p className="text-xs text-on-surface-variant truncate">
                    {topMatch.skills?.[0] || topMatch.role || 'Peer Specialist'} • {topMatch.trustScore || topMatch.rating || '5.0'} ⭐
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate('/match-finder')}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-elevation-1"
              >
                Connect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
