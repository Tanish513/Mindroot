interface UpcomingSessionsWidgetProps {
  sessions: any[];
  currentUserId?: string;
  sessionNoteCounts: Record<string, number>;
  isSessionLiveNow: (scheduledAt: string) => boolean;
  getCountdownLabel: (scheduledAt: string) => string;
  getGoogleCalendarUrl: (session: any) => string;
  onDownloadIcs: (session: any) => void;
  onSelectSessionForNotes: (session: any) => void;
  onJoinRoom: (sessionId: string) => void;
  onFindMatch?: () => void;
  onOpenSchedule: () => void;
}

export function UpcomingSessionsWidget({
  sessions,
  currentUserId,
  sessionNoteCounts,
  isSessionLiveNow,
  getCountdownLabel,
  getGoogleCalendarUrl,
  onDownloadIcs,
  onSelectSessionForNotes,
  onJoinRoom,
  onFindMatch: _onFindMatch,
  onOpenSchedule
}: UpcomingSessionsWidgetProps) {
  const displaySessions = sessions.slice(0, 3);

  return (
    <section className="bg-surface border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between h-full">
      {/* Clean Card Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">
              calendar_today
            </span>
            <h3 className="text-base font-semibold text-text">Upcoming sessions</h3>
          </div>
          <button
            type="button"
            onClick={onOpenSchedule}
            className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors cursor-pointer"
          >
            Calendar &rarr;
          </button>
        </div>

        {displaySessions.length === 0 ? (
          /* Empty State: Concise single line, no duplicate button */
          <div className="py-4 flex items-center gap-2.5 text-xs text-muted border-t border-border/40">
            <span className="material-symbols-outlined text-[18px] text-muted shrink-0" aria-hidden="true">
              event_available
            </span>
            <span className="text-[13px] text-muted">No upcoming sessions yet.</span>
          </div>
        ) : (
        <div className="divide-y divide-border pt-1">
          {displaySessions.map((session) => {
            const isLive = isSessionLiveNow(session.scheduledAt);
            const countdown = getCountdownLabel(session.scheduledAt);

            return (
              <div
                key={session.id}
                className="py-3 first:pt-1 last:pb-1 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 ${
                      isLive
                        ? 'bg-primary text-white shadow-xs animate-pulse'
                        : 'bg-primary/10 text-primary-text border border-primary/20'
                    }`}
                  >
                    {isLive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                    {countdown}
                  </span>
                  <span className="text-xs text-muted font-medium">
                    {session.scheduledAt
                      ? new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Flexible'}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-text truncate">{session.title}</h4>
                  <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-xs text-muted" aria-hidden="true">
                      person
                    </span>
                    <span>
                      {session.teacherId === currentUserId
                        ? `Teaching ${session.student?.name || 'Student'}`
                        : `Learning from ${session.teacher?.name || 'Teacher'}`}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => onSelectSessionForNotes(session)}
                    className="flex-1 py-1 px-2 bg-surface hover:bg-surface-2 text-text rounded-md text-xs font-medium border border-border transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs text-primary" aria-hidden="true">
                      edit_note
                    </span>
                    <span>Notes</span>
                    {(sessionNoteCounts[session.id] || 0) > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {sessionNoteCounts[session.id]}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(getGoogleCalendarUrl(session), '_blank')}
                    title="Add to Google Calendar"
                    className="py-1 px-2 bg-surface hover:bg-surface-2 text-text rounded-md text-xs font-medium border border-border transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs text-primary" aria-hidden="true">
                      calendar_month
                    </span>
                    <span>Cal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadIcs(session)}
                    title="Download .ics"
                    className="py-1 px-2 bg-surface hover:bg-surface-2 text-text rounded-md text-xs font-medium border border-border transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs" aria-hidden="true">
                      download
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onJoinRoom(session.id)}
                    className={`py-1 px-3 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      isLive
                        ? 'bg-primary text-white hover:bg-primary-hover shadow-xs'
                        : 'bg-surface hover:bg-surface-2 text-text border border-border'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      videocam
                    </span>
                    <span>{isLive ? 'Join' : 'Enter'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </section>
  );
}
