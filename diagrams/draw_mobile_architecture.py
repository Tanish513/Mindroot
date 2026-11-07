import matplotlib.pyplot as plt
import matplotlib.patches as patches
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

# High-resolution 3840x1634 canvas (aspect ratio ~2.35:1)
fig, ax = plt.subplots(figsize=(19.2, 8.17), dpi=200)
ax.set_xlim(0, 19.2)
ax.set_ylim(0, 8.17)
ax.axis('off')

# Design Token Colors
NAVY = "#0F172A"
SLATE = "#1E293B"
EMERALD = "#10B981"
DARK_EMERALD = "#065F46"
LIGHT_BG = "#F8FAFC"
WHITE = "#FFFFFF"
BLUE = "#2563EB"
AMBER = "#D97706"
BORDER = "#CBD5E1"
MUTED = "#64748B"
PURPLE = "#7C3AED"
CARD_BG = "#F1F5F9"
MINT_TINT = "#E3EEEA"

# Canvas background
bg = patches.Rectangle((0, 0), 19.2, 8.17, facecolor=WHITE, edgecolor="none")
ax.add_patch(bg)

# Title banner
title_box = patches.FancyBboxPatch((0.6, 7.25), 18.0, 0.75, boxstyle="round,pad=0.05,rounding_size=0.15",
                                   facecolor=NAVY, edgecolor="none", zorder=2)
ax.add_patch(title_box)
ax.text(0.9, 7.62, "MINDROOT: DUAL-MODE VIEWPORT & MOBILE NATIVE ARCHITECTURE (OPTION 1)", 
        color=WHITE, fontsize=15, fontweight="bold", va="center", zorder=3)
ax.text(18.3, 7.62, "Google Stitch • 35/35 Tests Passing • 0 Overflow", 
        color=EMERALD, fontsize=12, fontweight="bold", ha="right", va="center", zorder=3)

# Helper function to draw cards
def draw_card(ax, x, y, w, h, title, items, bg_col=LIGHT_BG, border_col=BORDER, header_col=SLATE, badge=None, badge_col=EMERALD):
    card = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.06,rounding_size=0.12",
                                  facecolor=bg_col, edgecolor=border_col, linewidth=1.5, zorder=2)
    ax.add_patch(card)
    # Header bar
    hbar = patches.FancyBboxPatch((x, y + h - 0.5), w, 0.5, boxstyle="round,pad=0.04,rounding_size=0.10",
                                  facecolor=header_col, edgecolor="none", zorder=3)
    ax.add_patch(hbar)
    ax.text(x + 0.2, y + h - 0.25, title, color=WHITE, fontsize=11, fontweight="bold", va="center", zorder=4)
    if badge:
        b_box = patches.FancyBboxPatch((x + w - 1.5, y + h - 0.40), 1.35, 0.30, boxstyle="round,pad=0.02,rounding_size=0.06",
                                      facecolor=badge_col, edgecolor="none", zorder=5)
        ax.add_patch(b_box)
        ax.text(x + w - 0.82, y + h - 0.25, badge, color=WHITE, fontsize=8.5, fontweight="bold", ha="center", va="center", zorder=6)
    
    curr_y = y + h - 0.80
    for it in items:
        if isinstance(it, tuple):
            prefix, text = it
            ax.text(x + 0.2, curr_y, prefix, color=DARK_EMERALD, fontsize=9.5, fontweight="bold", va="center", zorder=4)
            ax.text(x + 0.25 + len(prefix)*0.09, curr_y, text, color=SLATE, fontsize=9, va="center", zorder=4)
        else:
            ax.text(x + 0.2, curr_y, "• " + it, color=SLATE, fontsize=9, va="center", zorder=4)
        curr_y -= 0.32

# COLUMN 1: VIEWPORT ROUTING & SHELL ORCHESTRATION (x: 0.6 to 5.2)
draw_card(ax, 0.6, 3.8, 4.4, 3.2, "1. Responsive Breakpoint Gating", [
    ("Tailwind Breakpoint:", "md (768px) & lg (1024px)"),
    ("Mobile Mode:", "< 768px (md:hidden)"),
    ("Desktop Mode:", ">= 1024px (hidden md:block)"),
    ("Layout Isolation:", "0 Shared Desktop Style Overrides"),
    ("Overflow Guard:", "scrollWidth <= 390px (0 Overflow)"),
    ("AIAssistant Docking:", "bottom-20 md:bottom-6 clearance")
], bg_col=LIGHT_BG, border_col=BORDER, header_col=SLATE, badge="Viewport Gating", badge_col=BLUE)

draw_card(ax, 0.6, 0.4, 4.4, 3.1, "2. Shell Architecture (AppShell.tsx)", [
    ("TopBar Orchestration:", "Mobile Brand vs Desktop Spotlight"),
    ("Sidebar Positioning:", "Fixed Left [260px] Desktop Only"),
    ("Bottom Dock Stacking:", "Fixed Bottom-0 [h-16] Mobile Only"),
    ("Content Clearance:", "main pb-24 md:pb-8 padding safe"),
    ("State Engine:", "Zustand store (useAppStore.ts)"),
    ("Session Scope:", "Tab-isolated sessionStorage credentials")
], bg_col=LIGHT_BG, border_col=BORDER, header_col=SLATE, badge="Shell Engine", badge_col=NAVY)

# COLUMN 2: MOBILE NATIVE APP SUBSYSTEM (x: 5.3 to 11.2)
draw_card(ax, 5.3, 3.8, 5.7, 3.2, "3. Mobile Native TopBar & Bottom Dock", [
    ("TopBar Header (md:hidden):", "Mindroot Logo & Name on Left"),
    ("Header Actions:", "Search Overlay Toggle, Notifications, Avatar"),
    ("Deprecated Hamburger:", "Zero Mobile Sidebar Collision (Clean UX)"),
    ("Sole Primary Dock:", "MobileBottomNav.tsx (5 Fixed Thumb Tabs)"),
    ("Tab 1: Home (/dashboard):", "Time Greeting, Streak Badge, 2x2 Stats"),
    ("Tab 2: Find (/marketplace):", "Fast Topic Chips, Mentors, Slide Drawer"),
    ("Tab 3: Schedule (/schedule):", "7-Day Date Strip & Vertical Timeline Agenda"),
    ("Tab 4: Chat (/messages):", "Direct Threads, Study Proposals, Composer")
], bg_col=MINT_TINT, border_col=DARK_EMERALD, header_col=DARK_EMERALD, badge="Option 1 Native", badge_col=EMERALD)

draw_card(ax, 5.3, 0.4, 5.7, 3.1, "4. 1-Tap Platform Tools Hub (Profile.tsx)", [
    ("5th Tab Anchor:", "Profile tab links directly to User Account Hub"),
    ("Wallet & UPI:", "Direct P2P receipts, balance & token payouts"),
    ("Live Room Studio:", "Instant join classroom & peer studio session"),
    ("Study Notes:", "Class scratchpads & Markdown knowledge capture"),
    ("Peer Community:", "Discussion forum & academic barter threads"),
    ("Match Finder:", "AI barter reciprocity algorithm"),
    ("Rewards & Portal:", "Badge tracking, Teacher Portal & Admin Desk"),
    ("Preferences:", "Light/Dark theme toggle pill & 1-tap Sign Out")
], bg_col=WHITE, border_col=EMERALD, header_col=DARK_EMERALD, badge="1-Tap Tools Hub", badge_col=PURPLE)

# COLUMN 3: DESKTOP UNTOUCHED SUBSYSTEM & VERIFICATION (x: 11.3 to 18.6)
draw_card(ax, 11.3, 3.8, 7.3, 3.2, "5. Desktop Multi-Column Subsystem (1024px+)", [
    ("Sidebar (w-[260px] / w-[72px]):", "Pinned Brand Header, 7 Nav Links, Pin Button"),
    ("Spotlight Search:", "Full Search Bar with ⌘K Shortcut & Result Dropdown"),
    ("Demo Persona Suite:", "1-Click Student / Verified Mentor / Admin Switching"),
    ("Specs Architecture Modal:", "Academic syllabus specifications & grading rubric"),
    ("Dashboard Grid:", "3-Column balanced layout with stats & upcoming sessions"),
    ("Marketplace Directory:", "3-Column mentor grid with category filters & drawer"),
    ("Schedule System:", "Notion-style Day, Week, and Month calendar switcher")
], bg_col=LIGHT_BG, border_col=BORDER, header_col=NAVY, badge="100% Untouched", badge_col=BLUE)

draw_card(ax, 11.3, 0.4, 7.3, 3.1, "6. Verification & Zero-Regression Evidence", [
    ("Playwright Acceptance Suite:", "35 passed / 0 failed (100% Pass Rate in 1.5m)"),
    ("Vite Production Build:", "528 modules transformed, 0 errors (built in 2.36s)"),
    ("Backend TypeScript Check:", "0 errors across Express, Socket.io, & Prisma"),
    ("Live Room End & Kick Tests:", "9/9 unit tests passing (100% server authority)"),
    ("Mobile Horizontal Overflow:", "scrollWidth = 390px at 390px (0 Horizontal Overflow)"),
    ("Desktop Pixel Integrity:", "sidebarVisible: true, bottomNavHidden: true at 1280px"),
    ("Visual Evidence Vault:", "Screenshots saved across 360, 390, 768, and 1280px")
], bg_col=WHITE, border_col=EMERALD, header_col=DARK_EMERALD, badge="Verified PASS", badge_col=EMERALD)

# Connective Flow Arrows
ax.annotate("", xy=(5.3, 5.4), xytext=(5.0, 5.4),
            arrowprops=dict(arrowstyle="->", color=DARK_EMERALD, lw=2.5))
ax.annotate("", xy=(5.3, 1.95), xytext=(5.0, 1.95),
            arrowprops=dict(arrowstyle="->", color=DARK_EMERALD, lw=2.5))
ax.annotate("", xy=(11.3, 5.4), xytext=(11.0, 5.4),
            arrowprops=dict(arrowstyle="->", color=BLUE, lw=2.5))
ax.annotate("", xy=(11.3, 1.95), xytext=(11.0, 1.95),
            arrowprops=dict(arrowstyle="->", color=DARK_EMERALD, lw=2.5))

plt.tight_layout()
plt.savefig("diagrams/mobile_architecture_diagram.png", dpi=200, bbox_inches='tight', facecolor=WHITE)
print("Saved diagrams/mobile_architecture_diagram.png successfully!")
