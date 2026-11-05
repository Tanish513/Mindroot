export interface StreakDay {
  num: number;
  day: string;
  full: string;
  dateStr: string;
  isToday: boolean;
  isGift: boolean;
  isVisited: boolean;
  isMissed: boolean;
}

interface DashboardHeroHeaderProps {
  greeting: string;
  userName?: string;
  roleBadgeLabel?: string;
  roleSubtitle: string;
  isTeacherRole?: boolean;
  onFindMatch: () => void;
  onSchedule: () => void;
  streakCount: number;
  isTodayCompleted?: boolean;
  weeklyTrackerDays: StreakDay[];
  canClaimBonus?: boolean;
  isClaimingStreak?: boolean;
  streakClaimSuccess?: boolean;
  onClaimBonus?: () => void;
}

export function DashboardHeroHeader({
  greeting,
  userName = 'Peer',
  roleSubtitle,
  onFindMatch,
  onSchedule,
  streakCount,
  isTodayCompleted,
  weeklyTrackerDays,
  canClaimBonus,
  isClaimingStreak,
  streakClaimSuccess,
  onClaimBonus
}: DashboardHeroHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-1 select-none">
      {/* Left: Greeting + Streak Chip + Subtitle (Directly on page background) */}
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[26px] font-bold text-text tracking-tight">
            {greeting}, {userName}
          </h1>

          {/* Compact Streak Chip with Week Dots Tooltip */}
          <div className="relative group inline-flex items-center">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary-text border border-primary/20 text-xs font-semibold hover:bg-primary/15 transition-colors cursor-pointer"
              aria-label={`${streakCount > 0 ? streakCount : 0}-day streak. Hover to view weekly calendar.`}
            >
              <span className="material-symbols-outlined text-[15px] text-primary" aria-hidden="true">
                local_fire_department
              </span>
              <span>{streakCount > 0 ? `${streakCount}-day streak` : '0-day streak'}</span>
            </button>

            {/* Tooltip on hover/focus */}
            <div
              className="absolute left-0 top-full mt-2 z-40 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-all duration-150 bg-surface border border-border rounded-xl p-3 shadow-lg flex flex-col gap-2 min-w-[260px]"
              data-testid="streak-tracker-container"
              role="tooltip"
            >
              <div className="flex items-center justify-between text-xs border-b border-border pb-1.5">
                <span className="font-semibold text-text">Weekly Streak</span>
                <span className="text-muted">{isTodayCompleted ? 'Logged today' : 'Visit today to keep it'}</span>
              </div>

              <div className="flex items-center justify-between gap-1 pt-0.5">
                {weeklyTrackerDays.map((item) => {
                  const ariaLabel = item.isToday
                    ? `${item.full}, today, ${item.isVisited ? 'visited' : 'not visited'}`
                    : item.isVisited
                      ? `${item.full}, visited`
                      : item.isMissed
                        ? `${item.full}, missed`
                        : `${item.full}, upcoming`;

                  return (
                    <div
                      key={item.num}
                      className="flex flex-col items-center gap-1"
                      title={`${item.full} (${item.dateStr})`}
                      aria-label={ariaLabel}
                      role="group"
                      data-testid={`streak-day-container-${item.num}`}
                    >
                      {item.isToday ? (
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border ${
                            item.isVisited
                              ? 'bg-primary text-white border-primary'
                              : 'bg-surface text-text border-primary'
                          }`}
                          data-testid="streak-day-today"
                          aria-label={ariaLabel}
                        >
                          {item.isVisited ? '✓' : item.day.slice(0, 1)}
                        </div>
                      ) : item.isVisited ? (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-primary/15 text-primary-text border border-primary/30"
                          data-testid={`streak-day-${item.num}`}
                          aria-label={ariaLabel}
                        >
                          ✓
                        </div>
                      ) : item.isMissed ? (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center border border-border bg-surface-2 text-xs text-muted"
                          data-testid={`streak-day-${item.num}`}
                          aria-label={ariaLabel}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-missed-dot" />
                        </div>
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-muted border border-border bg-surface"
                          data-testid={`streak-day-${item.num}`}
                          aria-label={ariaLabel}
                        >
                          {item.day.slice(0, 1)}
                        </div>
                      )}
                      <span className={`text-xs leading-none ${item.isToday ? 'font-semibold text-text' : 'text-muted'}`}>
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>

              {canClaimBonus && (
                <button
                  type="button"
                  disabled={isClaimingStreak}
                  onClick={onClaimBonus}
                  className="mt-1 text-xs font-semibold py-1 px-2.5 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity cursor-pointer text-center"
                >
                  {isClaimingStreak ? 'Claiming...' : 'Claim 20 pts'}
                </button>
              )}
              {streakClaimSuccess && (
                <span className="text-center text-xs font-medium text-accent-text">
                  20 pts claimed!
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-muted">
          {roleSubtitle}
        </p>
      </div>

      {/* Right: Primary "Schedule Session" & Secondary "Find Peer Match" (Text Link) */}
      <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
        <button
          type="button"
          onClick={onFindMatch}
          className="text-sm font-medium text-muted hover:text-text px-3 py-2 rounded-lg transition-colors duration-150 cursor-pointer"
        >
          Find Peer Match
        </button>
        <button
          type="button"
          onClick={onSchedule}
          className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors duration-150 shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
        >
          Schedule Session
        </button>
      </div>
    </div>
  );
}
