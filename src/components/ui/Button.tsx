import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'amber' | 'mint' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
    
    const sizeStyles = {
      sm: "px-3 py-1.5 text-xs font-medium rounded-lg",
      md: "px-4 py-2.5 text-sm",
      lg: "px-5 py-3 text-base"
    };

    const variants = {
      primary: "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover shadow-sm hover:shadow",
      secondary: "bg-surface text-text border border-border shadow-sm hover:bg-surface-2 hover:border-border/80",
      outline: "bg-transparent text-text border border-border hover:bg-surface-2 hover:border-text/30",
      amber: "bg-accent text-on-primary hover:opacity-90 shadow-sm",
      mint: "bg-primary-tint text-primary-text border border-primary/20 hover:bg-primary-tint/80",
      ghost: "bg-transparent text-text hover:bg-surface-2 hover:text-primary-text",
      danger: "bg-danger text-white hover:opacity-90 shadow-sm"
    };

    return (
      <motion.button
        ref={ref}
        whileHover={disabled || isLoading ? undefined : { y: -1 }}
        whileTap={disabled || isLoading ? undefined : { y: 0, scale: 0.99 }}
        transition={{ duration: 0.12 }}
        disabled={disabled || isLoading}
        className={cn(baseStyles, sizeStyles[size], variants[variant], className)}
        {...(props as any)}
      >
        {isLoading && (
          <span className="material-symbols-outlined text-[16px] animate-spin">
            progress_activity
          </span>
        )}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
