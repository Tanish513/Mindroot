import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: string;
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon = 'auto_stories',
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  children,
  className
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-border bg-surface/50",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-primary-tint/70 text-primary flex items-center justify-center mb-4 shadow-sm">
        <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
          {icon}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-text mb-1">
        {title}
      </h3>
      <p className="text-sm text-muted max-w-md mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary" size="md" className="min-h-[44px]">
          {actionIcon && (
            <span className="material-symbols-outlined text-[18px] mr-1" aria-hidden="true">
              {actionIcon}
            </span>
          )}
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
