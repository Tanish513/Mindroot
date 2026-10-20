/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Mindroot Semantic Design Tokens
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        "text-muted": "var(--muted)",

        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        "primary-soft": "var(--primary-tint)",
        "primary-tint": "var(--primary-tint)",
        "primary-text": "var(--primary-text)",
        "on-primary": "var(--on-primary)",

        accent: "var(--accent)",
        "accent-soft": "var(--accent-tint)",
        "accent-tint": "var(--accent-tint)",
        "accent-text": "var(--accent-text)",

        danger: "var(--danger)",

        "nav-hover": "var(--nav-hover)",

        "sidebar-bg": "var(--sidebar-bg)",
        "sidebar-icon": "var(--sidebar-icon)",
        "sidebar-icon-hover": "var(--sidebar-icon-hover)",
        "sidebar-hover-bg": "var(--sidebar-hover-bg)",
        "sidebar-active-bg": "var(--sidebar-active-bg)",
        "sidebar-active-icon": "var(--sidebar-active-icon)",
        "sidebar-active-icon-bg": "var(--sidebar-active-icon-bg)",
        "sidebar-active-text": "var(--sidebar-active-text)",
        "sidebar-border": "var(--sidebar-border)",
        "sidebar-active": "var(--sidebar-active-bg)",
        "sidebar-logo-tile": "var(--sidebar-logo-tile)",

        // Status Colors
        success: "var(--primary)",
        warning: "var(--accent)",
        info: "var(--primary)",

        // Backward compatibility mappings
        background: "var(--bg)",
        "on-background": "var(--text)",
        "on-surface": "var(--text)",
        "on-surface-variant": "var(--muted)",
        "surface-bright": "var(--surface)",
        "surface-container-lowest": "var(--surface)",
        "surface-container-low": "var(--surface)",
        "surface-container": "var(--surface-2)",
        "surface-container-high": "var(--surface-2)",
        "surface-container-highest": "var(--surface-2)",
        "primary-container": "var(--primary-tint)",
        "on-primary-container": "var(--primary-text)",
        "primary-active": "var(--primary-hover)",
        outline: "var(--border)",
        "outline-variant": "var(--border)",
        "neutral-subtle": "var(--muted)",
        "neutral-muted": "var(--muted)",
        "neutral-dark": "var(--text)",

        // Semantic Accents
        "teaching-emerald": "var(--primary)",
        "teaching-emerald-hover": "var(--primary-hover)",
        "teaching-emerald-container": "var(--primary-tint)",
        "on-teaching-emerald": "var(--on-primary)",
        "on-teaching-emerald-container": "var(--primary-text)",

        "learning-amber": "var(--accent)",
        "learning-amber-hover": "var(--accent)",
        "learning-amber-container": "var(--accent-tint)",
        "on-learning-amber": "var(--on-primary)",
        "on-learning-amber-container": "var(--accent-text)",

        "electric-cyan": "var(--primary)",
        "electric-cyan-container": "var(--primary-tint)",
        "on-electric-cyan-container": "var(--primary-text)",

        "trust-purple": "var(--primary)",
        "trust-purple-container": "var(--primary-tint)",
        "on-trust-purple-container": "var(--primary-text)",

        "sky-blue": "var(--primary)",
        "sky-blue-container": "var(--primary-tint)",
        "on-sky-blue-container": "var(--primary-text)",

        "alert-rose": "var(--danger)",
        "alert-rose-hover": "var(--danger)",
        "alert-rose-container": "var(--surface-2)",
        "on-alert-rose": "#FFFFFF",
        "on-alert-rose-container": "var(--danger)",

        error: "var(--danger)",
        "error-hover": "var(--danger)",
        "error-container": "var(--surface-2)",
        "on-error": "#FFFFFF",
        "on-error-container": "var(--danger)",
      },
      backgroundImage: {
        hero: "var(--hero)",
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
        DEFAULT: 'var(--shadow)',
        'elevation-1': 'var(--shadow)',
        'elevation-2': 'var(--shadow)',
        'elevation-3': 'var(--shadow)',
        'lifted': 'var(--shadow)',
        'lifted-hover': 'var(--shadow)',
      }
    },
  },
  plugins: [],
}
