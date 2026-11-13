export interface SuggestedPeer {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
  rating?: string | number;
  isNew?: boolean;
  reviewCount?: number;
  matchScore?: number;
  isAvailableNow?: boolean;
}

interface SuggestedPeersCardProps {
  peers: SuggestedPeer[];
  loading?: boolean;
  onBrowseAll: () => void;
  onConnect: (peerId: string) => void;
}

export function SuggestedPeersCard({
  peers,
  loading,
  onBrowseAll,
  onConnect
}: SuggestedPeersCardProps) {
  return (
    <section className="bg-transparent md:bg-surface border-0 md:border border-border rounded-xl p-0 md:p-5 shadow-none md:shadow-xs space-y-3 md:space-y-4">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-start sm:items-center gap-2.5">
          <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5 sm:mt-0" aria-hidden="true">
            recommend
          </span>
          <div>
            <h3 className="text-base font-semibold text-text">Suggested peers</h3>
            <p className="text-[13px] text-muted font-normal">
              Recommended peers based on your skills and learning goals
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBrowseAll}
          className="self-start sm:self-auto text-xs font-semibold text-primary hover:text-primary-hover transition-colors cursor-pointer min-h-[44px] sm:min-h-0 flex items-center"
        >
          Browse all &rarr;
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-surface-2/30 animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-2 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-surface-2 rounded-sm w-24" />
                  <div className="h-3 bg-surface-2 rounded-sm w-36" />
                </div>
              </div>
              <div className="h-8 bg-surface-2 rounded-lg w-full" />
            </div>
          ))}
        </div>
      ) : peers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {peers.map((peer) => (
            <div
              key={peer.id}
              className="p-2.5 md:p-4 rounded-xl border border-border bg-surface hover:border-primary/30 transition-all flex flex-col justify-between gap-2 md:gap-3.5 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={
                        peer.avatar ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
                      }
                      alt={peer.name}
                      className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border border-border"
                    />
                    {peer.isAvailableNow && (
                      <span
                        className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-surface"
                        title="Online now"
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-text truncate">{peer.name}</h4>
                    <p className="text-xs text-muted line-clamp-2 md:truncate mt-0.5 leading-snug">
                      {peer.role || 'Peer Scholar'}
                    </p>
                  </div>
                </div>

                {peer.matchScore ? (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold shrink-0">
                    {peer.matchScore}%
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between pt-1.5 md:pt-2 border-t border-border/60">
                {peer.isNew || peer.rating === 'New' || !peer.rating ? (
                  <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold text-xs border border-accent/20">
                    New
                  </span>
                ) : (
                  <span className="text-xs font-medium text-text flex items-center gap-1">
                    <span className="text-accent">★</span>
                    <span>{peer.rating}</span>
                    {typeof peer.reviewCount === 'number' && peer.reviewCount > 0 && (
                      <span className="text-muted">({peer.reviewCount})</span>
                    )}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onConnect(peer.id)}
                  className="px-3 md:px-3.5 py-1.5 text-xs font-medium text-text bg-surface hover:bg-surface-2 border border-border rounded-lg transition-colors cursor-pointer min-h-[44px] md:min-h-0 flex items-center justify-center"
                >
                  Connect
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-[13px] text-muted">
          No peer suggestions available right now.
        </div>
      )}
    </section>
  );
}
