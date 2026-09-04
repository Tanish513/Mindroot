import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'amber' | 'mint' | 'ghost' | 'danger';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ease-in-out focus:outline-none select-none";
    
    const variants = {
      primary: "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active shadow-elevation-1 hover:shadow-elevation-2 focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background",
      secondary: "bg-surface text-on-surface border border-outline-variant shadow-elevation-1 hover:bg-surface-container hover:text-primary hover:border-outline focus:ring-2 focus:ring-primary/20",
      amber: "bg-learning-amber text-on-learning-amber hover:bg-learning-amber-hover shadow-elevation-1 hover:shadow-elevation-2 focus:ring-2 focus:ring-learning-amber/20",
      mint: "bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20 hover:bg-teaching-emerald-container/80 shadow-elevation-1",
      ghost: "bg-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus:ring-2 focus:ring-primary/20",
      danger: "bg-alert-rose text-on-alert-rose hover:bg-alert-rose-hover shadow-elevation-1 hover:shadow-elevation-2 focus:ring-2 focus:ring-alert-rose/20"
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(baseStyles, variants[variant], className)}
        {...(props as any)}
      />
    );
  }
);
Button.displayName = 'Button';
