import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface CerebralCardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export function CerebralCard({ children, className, hoverable = false, onClick }: CerebralCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={hoverable ? { y: -3, scale: 1.01 } : undefined}
      whileTap={hoverable ? { scale: 0.985 } : undefined}
      onClick={onClick}
      className={clsx(
        "bg-surface rounded-2xl p-6 transition-all duration-200 border border-outline-variant shadow-elevation-1",
        hoverable && "cursor-pointer hover:border-outline hover:shadow-elevation-2",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
