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
      primary: "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover shadow hover:shadow-md focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-bg",
      secondary: "bg-surface text-text border border-border shadow hover:bg-surface-2 hover:text-text hover:border-border focus:ring-2 focus:ring-primary/20",
      amber: "bg-accent text-on-primary hover:opacity-90 shadow hover:shadow-md focus:ring-2 focus:ring-accent/20",
      mint: "bg-primary-tint text-primary-text border border-primary/20 hover:bg-primary-tint/80 shadow",
      ghost: "bg-transparent text-primary-text hover:bg-primary-tint hover:text-primary-text focus:ring-2 focus:ring-primary/20",
      danger: "bg-danger text-white hover:opacity-90 shadow hover:shadow-md focus:ring-2 focus:ring-danger/20"
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
