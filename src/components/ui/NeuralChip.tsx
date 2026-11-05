import { StatusBadge, type BadgeStatus } from './StatusBadge';

export interface NeuralChipProps {
  label: string;
  status?: 'live' | 'verified' | 'confirmed' | 'pending' | 'completed' | 'default';
  className?: string;
  icon?: string;
}

export function NeuralChip({ label, status = 'default', className, icon }: NeuralChipProps) {
  const mappedStatus = status as BadgeStatus;
  return (
    <StatusBadge
      label={label}
      status={mappedStatus}
      className={className}
      icon={icon}
      size="sm"
    />
  );
}

export { StatusBadge } from './StatusBadge';
export { SkillTag } from './SkillTag';
