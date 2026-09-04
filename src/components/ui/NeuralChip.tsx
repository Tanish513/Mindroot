import { clsx } from 'clsx';

interface NeuralChipProps {
  label: string;
  status?: 'live' | 'verified' | 'confirmed' | 'pending' | 'completed' | 'default';
  className?: string;
  icon?: string;
}

export function NeuralChip({ label, status = 'default', className, icon }: NeuralChipProps) {
  const statusStyles = {
    live: 'bg-surface-container border border-primary/40 text-primary font-semibold',
    verified: 'bg-surface-container border border-outline-variant text-on-surface font-semibold',
    confirmed: 'bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container font-semibold',
    pending: 'bg-learning-amber-container border border-learning-amber/20 text-on-learning-amber-container font-semibold',
    completed: 'bg-surface-container border border-outline-variant text-on-surface-variant font-medium',
    default: 'bg-surface-container border border-outline-variant text-on-surface font-semibold'
  };

  return (
    <span 
      className={clsx("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] tracking-wide uppercase select-none", statusStyles[status], className)}
    >
      {icon && <span className="material-symbols-outlined text-[12px]">{icon}</span>}
      {label}
    </span>
  );
}
