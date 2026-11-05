import { forwardRef, type HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'outlined' | 'subtle';
  hoverable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, variant = 'default', hoverable = false, onClick, ...props }, ref) => {
    const isInteractive = hoverable || variant === 'interactive' || Boolean(onClick);

    const baseStyles = "rounded-2xl transition-all duration-200 border";
    
    const variantStyles = {
      default: "bg-surface border-border shadow-elevation-1",
      interactive: "bg-surface border-border shadow-elevation-1 hover:border-primary/40 hover:shadow-elevation-2 cursor-pointer",
      outlined: "bg-surface border-border",
      subtle: "bg-surface-2/60 border-border/60"
    };

    if (isInteractive) {
      return (
        <motion.div
          ref={ref}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={onClick}
          className={clsx(
            baseStyles,
            variantStyles[variant === 'default' ? 'interactive' : variant],
            "p-6",
            className
          )}
          {...(props as HTMLMotionProps<'div'>)}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          "p-6",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Deprecation alias for backward compatibility
export const CerebralCard = Card;
