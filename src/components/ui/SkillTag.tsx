import { clsx } from 'clsx';

export interface SkillTagProps {
  label: string;
  type?: 'teaching' | 'learning' | 'neutral';
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function SkillTag({
  label,
  type = 'neutral',
  onRemove,
  onClick,
  selected = false,
  className,
  size = 'md'
}: SkillTagProps) {
  const typeStyles = {
    teaching: selected
      ? 'bg-primary text-on-primary border-primary'
      : 'bg-primary-tint/70 hover:bg-primary-tint border-primary/25 text-primary-text',
    learning: selected
      ? 'bg-accent text-on-primary border-accent'
      : 'bg-accent-tint/70 hover:bg-accent-tint border-accent/25 text-accent-text',
    neutral: selected
      ? 'bg-surface-2 border-primary text-text'
      : 'bg-surface-2/80 hover:bg-surface-2 border-border text-text'
  };

  const defaultIcons = {
    teaching: 'school',
    learning: 'auto_stories',
    neutral: 'tag'
  };

  const sizeStyles = size === 'sm'
    ? 'text-xs px-2 py-0.5 gap-1'
    : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      onClick={onClick}
      className={clsx(
        "inline-flex items-center rounded-lg border font-medium transition-all select-none",
        onClick && "cursor-pointer active:scale-95",
        sizeStyles,
        typeStyles[type],
        className
      )}
    >
      <span 
        aria-hidden="true" 
        className={clsx("material-symbols-outlined shrink-0", size === 'sm' ? "text-[12px]" : "text-[14px]")}
      >
        {defaultIcons[type]}
      </span>
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${label}`}
          className="ml-0.5 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors inline-flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[12px]">close</span>
        </button>
      )}
    </span>
  );
}
