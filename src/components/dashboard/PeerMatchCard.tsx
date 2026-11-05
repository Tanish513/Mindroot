export interface ScoredPeerMatch {
  peer: {
    id: string;
    name?: string;
    avatar?: string;
    isAvailableNow?: boolean;
    trustScore?: number;
    hourlyRate?: number;
  };
  matchScore: number;
  sessionCount: number;
  teachStr: string;
  learnStr: string;
}

interface PeerMatchCardProps {
  match: ScoredPeerMatch | null;
  onBrowseAll: () => void;
  onMessage: (peerId: string) => void;
  onProposeExchange: (peerId: string) => void;
}

export function PeerMatchCard({
  match,
  onBrowseAll,
  onMessage,
  onProposeExchange
}: PeerMatchCardProps) {
  return (
    <section className="bg-surface border border-border rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-primary text-xl" aria-hidden="true">
            recommend
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text">Recommended Peer Match</h3>
            <p className="text-[13px] text-muted font-normal">
              Top peer recommendation based on your mutual skills
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBrowseAll}
          className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors cursor-pointer"
        >
          Browse All Matches &rarr;
        </button>
      </div>

      {match ? (
        <div
          onClick={onBrowseAll}
          className="p-4 rounded-lg border border-border bg-surface hover:border-primary/40 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <img
                className="w-12 h-12 rounded-full object-cover border border-border"
                src={
                  match.peer.avatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
                }
                alt={`${match.peer.name || 'Peer'} profile avatar`}
              />
              <span
                className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full ring-2 ring-surface"
                title={match.peer.isAvailableNow ? 'Online now' : 'Active learner'}
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-text">
                  {match.peer.name || 'Peer Scholar'}
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
                  {match.matchScore}% Match
                </span>
                <span className="text-[13px] text-muted">
                  • {match.peer.isAvailableNow ? 'Available Today' : 'Available for Booking'}
                </span>
              </div>

              {/* Dual-Sided Skill Presentation as small pills */}
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-medium text-muted">Teaches:</span>
                <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary-text border border-primary/20 text-xs font-medium">
                  {match.teachStr}
                </span>
                <span className="text-muted/60">•</span>
                <span className="font-medium text-muted">Learns:</span>
                <span className="px-2.5 py-0.5 rounded-md bg-accent/10 text-accent-text border border-accent/20 text-xs font-medium">
                  {match.learnStr}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 self-end md:self-center">
            <div className="text-right mr-1">
              <div className="flex items-center gap-1 text-[13px] font-semibold text-text justify-end">
                <span className="material-symbols-outlined text-[15px] text-accent" aria-hidden="true">
                  star
                </span>
                <span>{(match.peer.trustScore || 5.0).toFixed(1)}</span>
              </div>
              <p className="text-[13px] text-muted font-medium">
                ₹{match.peer.hourlyRate || 499}/hr
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMessage(match.peer.id);
              }}
              className="px-3 py-1.5 text-xs font-medium border border-border hover:bg-surface-2 text-text rounded-lg transition-colors cursor-pointer"
            >
              Message
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onProposeExchange(match.peer.id);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-primary text-white hover:bg-primary-hover rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Propose Exchange
            </button>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-[32px] text-muted mb-2" aria-hidden="true">
            person_search
          </span>
          <p className="text-sm font-semibold text-text">No peer recommendations yet</p>
          <p className="text-[13px] text-muted mt-0.5 mb-3 max-w-sm">
            As students join and select their skills, your personalized peer matches will appear here.
          </p>
          <button
            type="button"
            onClick={onBrowseAll}
            className="px-3.5 py-1.5 text-xs font-medium border border-border hover:bg-surface-2 text-text rounded-lg transition-colors cursor-pointer"
          >
            Explore Match Finder
          </button>
        </div>
      )}
    </section>
  );
}
