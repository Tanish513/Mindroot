/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Primary Brand Color - Used for primary actions, links, focus rings
        "primary": "rgb(var(--color-primary) / <alpha-value>)",
        "primary-hover": "rgb(var(--color-primary-hover) / <alpha-value>)",
        "primary-active": "rgb(var(--color-primary-active) / <alpha-value>)",
        "primary-container": "rgb(var(--color-primary-container) / <alpha-value>)",
        "on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
        "on-primary-container": "rgb(var(--color-on-primary-container) / <alpha-value>)",

        // Secondary / Navy Accent
        "secondary": "rgb(var(--color-secondary) / <alpha-value>)",
        "secondary-hover": "rgb(var(--color-secondary-hover) / <alpha-value>)",
        "secondary-container": "rgb(var(--color-secondary-container) / <alpha-value>)",
        "on-secondary": "rgb(var(--color-on-secondary) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--color-on-secondary-container) / <alpha-value>)",

        // Neutrals & Surface Hierarchy
        "background": "rgb(var(--color-background) / <alpha-value>)",
        "surface": "rgb(var(--color-surface) / <alpha-value>)",
        "surface-bright": "rgb(var(--color-surface-bright) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--color-surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--color-surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--color-surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--color-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--color-surface-container-highest) / <alpha-value>)",
        "on-background": "rgb(var(--color-on-background) / <alpha-value>)",
        "on-surface": "rgb(var(--color-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--color-on-surface-variant) / <alpha-value>)",
        "outline": "rgb(var(--color-outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--color-outline-variant) / <alpha-value>)",
        "neutral-subtle": "rgb(var(--color-neutral-subtle) / <alpha-value>)",
        "neutral-muted": "rgb(var(--color-neutral-muted) / <alpha-value>)",
        "neutral-dark": "rgb(var(--color-neutral-dark) / <alpha-value>)",

        // Semantic Accents (Teaching vs Learning)
        "teaching-emerald": "rgb(var(--color-teaching-emerald) / <alpha-value>)",
        "teaching-emerald-hover": "rgb(var(--color-teaching-emerald-hover) / <alpha-value>)",
        "teaching-emerald-container": "rgb(var(--color-teaching-emerald-container) / <alpha-value>)",
        "on-teaching-emerald": "rgb(var(--color-on-teaching-emerald) / <alpha-value>)",
        "on-teaching-emerald-container": "rgb(var(--color-on-teaching-emerald-container) / <alpha-value>)",

        "learning-amber": "rgb(var(--color-learning-amber) / <alpha-value>)",
        "learning-amber-hover": "rgb(var(--color-learning-amber-hover) / <alpha-value>)",
        "learning-amber-container": "rgb(var(--color-learning-amber-container) / <alpha-value>)",
        "on-learning-amber": "rgb(var(--color-on-learning-amber) / <alpha-value>)",
        "on-learning-amber-container": "rgb(var(--color-on-learning-amber-container) / <alpha-value>)",

        // Muted Supporting Tones (Desaturated / Subtle Tints)
        "electric-cyan": "rgb(var(--color-electric-cyan) / <alpha-value>)",
        "electric-cyan-container": "rgb(var(--color-electric-cyan-container) / <alpha-value>)",
        "on-electric-cyan-container": "rgb(var(--color-on-electric-cyan-container) / <alpha-value>)",

        "trust-purple": "rgb(var(--color-trust-purple) / <alpha-value>)",
        "trust-purple-container": "rgb(var(--color-trust-purple-container) / <alpha-value>)",
        "on-trust-purple-container": "rgb(var(--color-on-trust-purple-container) / <alpha-value>)",

        "sky-blue": "rgb(var(--color-sky-blue) / <alpha-value>)",
        "sky-blue-container": "rgb(var(--color-sky-blue-container) / <alpha-value>)",
        "on-sky-blue-container": "rgb(var(--color-on-sky-blue-container) / <alpha-value>)",

        // Semantic Alerts & Errors
        "alert-rose": "rgb(var(--color-alert-rose) / <alpha-value>)",
        "alert-rose-hover": "rgb(var(--color-alert-rose-hover) / <alpha-value>)",
        "alert-rose-container": "rgb(var(--color-alert-rose-container) / <alpha-value>)",
        "on-alert-rose": "rgb(var(--color-on-alert-rose) / <alpha-value>)",
        "on-alert-rose-container": "rgb(var(--color-on-alert-rose-container) / <alpha-value>)",

        "error": "rgb(var(--color-error) / <alpha-value>)",
        "error-hover": "rgb(var(--color-error-hover) / <alpha-value>)",
        "error-container": "rgb(var(--color-error-container) / <alpha-value>)",
        "on-error": "rgb(var(--color-on-error) / <alpha-value>)",
        "on-error-container": "rgb(var(--color-on-error-container) / <alpha-value>)",
      },
      borderRadius: {
        "DEFAULT": "0.5rem", // 8px
        "sm": "0.375rem",    // 6px
        "md": "0.5rem",      // 8px
        "lg": "0.75rem",     // 12px
        "xl": "1rem",        // 16px
        "2xl": "1.25rem",    // 20px
        "3xl": "1.5rem",     // 24px
        "full": "9999px"
      },
      spacing: {
        "gutter": "24px",
        "neural_gap": "8px",
        "header_height": "72px",
        "sidebar_width": "260px",
        "margin_mobile": "16px",
        "container_max": "1280px",
        "margin_desktop": "32px"
      },
      fontFamily: {
        "headline-lg": ["Plus Jakarta Sans"],
        "headline-lg-mobile": ["Plus Jakarta Sans"],
        "label-md": ["Plus Jakarta Sans"],
        "body-sm": ["Plus Jakarta Sans"],
        "display": ["Plus Jakarta Sans"],
        "body-lg": ["Plus Jakarta Sans"],
        "body-md": ["Plus Jakarta Sans"],
        "headline-sm": ["Plus Jakarta Sans"],
        "label-sm": ["Plus Jakarta Sans"],
        "headline-md": ["Plus Jakarta Sans"]
      },
      fontSize: {
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.02em", fontWeight: "600" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "display": ["44px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "headline-sm": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "label-sm": ["12px", { lineHeight: "16px", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }]
      },
      boxShadow: {
        'elevation-1': 'var(--shadow-elevation-1)',
        'elevation-2': 'var(--shadow-elevation-2)',
        'elevation-3': 'var(--shadow-elevation-3)',
        'lifted': 'var(--shadow-lifted)',
        'lifted-hover': 'var(--shadow-lifted-hover)',
      }
    },
  },
  plugins: [],
}
