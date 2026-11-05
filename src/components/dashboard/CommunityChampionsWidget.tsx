interface Champion {
  id?: string;
  name: string;
  avatar?: string;
  badge?: string;
  role?: string;
  rating?: string | number;
  score?: string | number;
}

interface CommunityChampionsWidgetProps {
  champions: Champion[];
  loading: boolean;
  onJoinDiscussions: () => void;
}

export function CommunityChampionsWidget({
  champions,
  loading,
  onJoinDiscussions
}: CommunityChampionsWidgetProps) {
  const rankBadges = [
    { label: '🥇 1st', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
    { label: '🥈 2nd', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20' },
    { label: '🥉 3rd', color: 'bg-amber-700/10 text-amber-800 dark:text-amber-500 border-amber-700/20' }
  ];

  return (
    <section className="bg-surface border border-border rounded-xl p-5 shadow-xs space-y-3.5">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-accent text-[18px]" aria-hidden="true">
            military_tech
          </span>
          <h3 className="text-base font-semibold text-text">Community Champions</h3>
        </div>
        <button
          type="button"
          onClick={onJoinDiscussions}
          className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors cursor-pointer"
        >
          Discussions &rarr;
        </button>
      </div>

      {loading ? (
        <div className="divide-y divide-border pt-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-surface-2 shrink-0" />
                <div className="space-y-1">
                  <div className="h-3 bg-surface-2 rounded-sm w-24" />
                  <div className="h-2.5 bg-surface-2 rounded-sm w-16" />
                </div>
              </div>
              <div className="h-5 bg-surface-2 rounded-full w-12" />
            </div>
          ))}
        </div>
      ) : champions.length > 0 ? (
        <div className="divide-y divide-border pt-1">
          {champions.slice(0, 3).map((champion, idx) => {
            const rank = rankBadges[idx] || {
              label: `${idx + 1}th`,
              color: 'bg-surface-2 text-muted border-border'
            };
            const rawName = champion.name || 'Peer Scholar';
            const cleanName = rawName.includes('@')
              ? rawName.split('@')[0].charAt(0).toUpperCase() + rawName.split('@')[0].slice(1)
              : rawName;

            return (
              <div
                key={champion.id || idx}
                className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={
                      champion.avatar ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
                    }
                    alt={cleanName}
                    className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-text truncate" title={cleanName}>
                      {cleanName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                      <span className="truncate">{champion.role || 'Peer Scholar'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-text font-medium shrink-0">
                        <span className="text-accent">★</span> {champion.rating || '5.0'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold border ${rank.color}`}
                  >
                    {rank.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-4 text-center text-xs text-muted">
          Leaderboard updating soon with active weekly learners.
        </div>
      )}
    </section>
  );
}
