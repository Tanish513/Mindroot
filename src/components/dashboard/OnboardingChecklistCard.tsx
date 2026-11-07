interface OnboardingChecklistCardProps {
  isProfileComplete: boolean;
  isMatched: boolean;
  hasBookedSession: boolean;
  onEditProfile: () => void;
  onFindMatch: () => void;
  onSchedule: () => void;
}

export function OnboardingChecklistCard({
  isProfileComplete,
  isMatched,
  hasBookedSession,
  onEditProfile,
  onFindMatch,
  onSchedule
}: OnboardingChecklistCardProps) {
  const steps = [
    {
      id: 1,
      title: 'Complete your profile',
      description: 'Add your taught & learned skills so we can match you with peers.',
      isDone: isProfileComplete,
      actionLabel: 'Edit Profile',
      onAction: onEditProfile
    },
    {
      id: 2,
      title: 'Find a peer match',
      description: 'Browse recommended peer scholars and discover reciprocal skills.',
      isDone: isMatched,
      actionLabel: 'Find Match',
      onAction: onFindMatch
    },
    {
      id: 3,
      title: 'Book your first session',
      description: 'Schedule a 1-on-1 peer exchange or collaborative study room.',
      isDone: hasBookedSession,
      actionLabel: 'Schedule',
      onAction: onSchedule
    }
  ];

  const completedCount = steps.filter(s => s.isDone).length;
  if (completedCount === steps.length) {
    return null;
  }

  // Find index of first incomplete step as the CURRENT step
  const currentStepIdx = steps.findIndex(s => !s.isDone);
  const currentStepNumber = currentStepIdx === -1 ? steps.length : currentStepIdx + 1;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <section className="bg-primary/[0.06] border border-primary/20 border-l-4 border-l-primary rounded-xl p-3.5 sm:p-5 shadow-xs space-y-2.5 sm:space-y-3.5 h-full flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-text">Get started</h3>
          <span className="text-[11px] sm:text-xs font-semibold text-primary">
            Step {currentStepNumber} of {steps.length}
          </span>
        </div>

        {/* Thin 4px progress bar with green fill */}
        <div className="w-full h-1 bg-primary/15 rounded-full overflow-hidden mt-2.5">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps: no bordered rows, clean divider lines */}
      <div className="divide-y divide-primary/10 pt-1">
        {steps.map((step, idx) => {
          const isCurrent = idx === currentStepIdx;

          return (
            <div
              key={step.id}
              className="py-2 sm:py-3 first:pt-1 last:pb-0.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors mt-0.5 sm:mt-0 ${
                    step.isDone
                      ? 'bg-primary text-white'
                      : isCurrent
                        ? 'bg-primary/20 text-primary border border-primary/40 font-bold'
                        : 'bg-surface border border-border text-muted'
                  }`}
                >
                  {step.isDone ? '✓' : step.id}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs sm:text-sm font-semibold ${step.isDone ? 'text-text/70 line-through' : 'text-text'}`}>
                    {step.title}
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted line-clamp-2 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-end sm:self-center pl-9 sm:pl-0">
                {step.isDone ? (
                  <span className="text-xs font-semibold text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check</span>
                    Done
                  </span>
                ) : isCurrent ? (
                  <button
                    type="button"
                    onClick={step.onAction}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg shadow-xs transition-colors cursor-pointer min-h-[44px] sm:min-h-0 flex items-center justify-center"
                  >
                    {step.actionLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={step.onAction}
                    className="px-3.5 py-1.5 text-xs font-medium text-text bg-surface hover:bg-surface-2 border border-border rounded-lg transition-colors cursor-pointer min-h-[44px] sm:min-h-0 flex items-center justify-center"
                  >
                    {step.actionLabel}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
