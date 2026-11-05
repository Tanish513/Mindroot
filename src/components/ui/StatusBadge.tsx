import { clsx } from 'clsx';

export type BadgeStatus = 'live' | 'confirmed' | 'pending' | 'completed' | 'canceled' | 'verified' | 'default';

export interface StatusBadgeProps {
  label: string;
  status?: BadgeStatus;
  className?: string;
  icon?: string;
  size?: 'sm' | 'md';
}

const defaultIcons: Record<BadgeStatus, string> = {
  live: 'radio_button_checked',
  confirmed: 'check_circle',
  pending: 'schedule',
  completed: 'task_alt',
  canceled: 'cancel',
  verified: 'verified',
  default: 'info'
};

const statusStyles: Record<BadgeStatus, string> = {
  live: 'bg-primary-tint border-primary/30 text-primary-text font-semibold',
  confirmed: 'bg-primary-tint border-primary/20 text-primary-text font-semibold',
  pending: 'bg-accent-tint border-accent/25 text-accent-text font-semibold',
  completed: 'bg-surface-2 border-border text-muted font-medium',
  canceled: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 font-medium',
  verified: 'bg-surface-2 border-border text-text font-semibold',
  default: 'bg-surface-2 border-border text-text font-medium'
};

export function StatusBadge({ 
  label, 
  status = 'default', 
  className, 
  icon,
  size = 'md' 
}: StatusBadgeProps) {
  const displayIcon = icon ?? defaultIcons[status];
  const sizeStyles = size === 'sm' 
    ? 'text-xs px-2 py-0.5 gap-1' 
    : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span 
      className={clsx(
        "inline-flex items-center rounded-full border transition-colors select-none",
        sizeStyles,
        statusStyles[status],
        className
      )}
    >
      {displayIcon && (
        <span 
          aria-hidden="true" 
          className={clsx(
            "material-symbols-outlined shrink-0", 
            size === 'sm' ? "text-[12px]" : "text-[14px]",
            status === 'live' && "animate-pulse text-primary"
          )}
        >
          {displayIcon}
        </span>
      )}
      <span>{label}</span>
    </span>
  );
}
