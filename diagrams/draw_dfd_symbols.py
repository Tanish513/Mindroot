import matplotlib.pyplot as plt
import matplotlib.patches as patches
import sys

sys.stdout.reconfigure(encoding='utf-8')

fig, ax = plt.subplots(figsize=(19.2, 8.17), dpi=200)
ax.set_xlim(0, 19.2)
ax.set_ylim(0, 8.17)
ax.axis('off')

# Palette
NAVY = "#0F172A"
SLATE = "#1E293B"
EMERALD = "#10B981"
DARK_EMERALD = "#065F46"
LIGHT_BG = "#F8FAFC"
WHITE = "#FFFFFF"
BLUE = "#2563EB"
AMBER = "#D97706"
BORDER = "#CBD5E1"

bg = patches.Rectangle((0, 0), 19.2, 8.17, facecolor=WHITE, edgecolor="none")
ax.add_patch(bg)

# Draw 4 large, balanced cards side-by-side
cards = [
    {
        "title": "PROCESS",
        "badge": "01",
        "color": DARK_EMERALD,
        "desc": "An automated algorithmic or logical transformation of incoming data into outgoing information.",
        "example": "Process 3.0: Token Escrow & Booking Engine",
        "draw_symbol": lambda ax, cx, cy: (
            ax.add_patch(patches.FancyBboxPatch((cx - 1.5, cy - 0.75), 3.0, 1.5,
                                               boxstyle="round,pad=0.08,rounding_size=0.45",
                                               facecolor="#ECFDF5", edgecolor=DARK_EMERALD, linewidth=2.5, zorder=5)),
            ax.text(cx, cy + 0.25, "1.0", color=DARK_EMERALD, fontsize=13, fontweight="bold", ha="center", va="center", zorder=6),
            ax.text(cx, cy - 0.15, "Authenticate &\nIssue Token", color=NAVY, fontsize=11.5, fontweight="bold", ha="center", va="center", zorder=6)
        )
    },
    {
        "title": "EXTERNAL ENTITY",
        "badge": "02",
        "color": BLUE,
        "desc": "An external human actor, third-party gateway, or external system that originates or receives platform data.",
        "example": "Student / Peer Mentor / Google OAuth 2.0",
        "draw_symbol": lambda ax, cx, cy: (
            ax.add_patch(patches.Rectangle((cx - 1.5, cy - 0.75), 3.0, 1.5,
                                          facecolor="#EFF6FF", edgecolor=BLUE, linewidth=2.5, zorder=5)),
            ax.text(cx, cy, "STUDENT / LEARNER\n(External User)", color=NAVY, fontsize=12, fontweight="bold", ha="center", va="center", zorder=6)
        )
    },
    {
        "title": "DATA STORE",
        "badge": "03",
        "color": SLATE,
        "desc": "A persistent relational repository, database table, or cache preserving state across user sessions.",
        "example": "D1: User Accounts & D4: Financial Ledger",
        "draw_symbol": lambda ax, cx, cy: (
            # Open-ended box (top and bottom lines with left vertical line)
            ax.plot([cx - 1.6, cx + 1.6], [cy + 0.75, cy + 0.75], color=SLATE, linewidth=3, zorder=5),
            ax.plot([cx - 1.6, cx + 1.6], [cy - 0.75, cy - 0.75], color=SLATE, linewidth=3, zorder=5),
            ax.plot([cx - 1.6, cx - 1.6], [cy - 0.75, cy + 0.75], color=SLATE, linewidth=3, zorder=5),
            ax.plot([cx - 0.7, cx - 0.7], [cy - 0.75, cy + 0.75], color=SLATE, linewidth=1.5, linestyle="--", zorder=5),
            ax.text(cx - 1.15, cy, "D1", color=SLATE, fontsize=14, fontweight="bold", ha="center", va="center", zorder=6),
            ax.text(cx + 0.45, cy, "User Store &\nToken Balances", color=NAVY, fontsize=11.5, fontweight="bold", ha="center", va="center", zorder=6)
        )
    },
    {
        "title": "DATA FLOW",
        "badge": "04",
        "color": AMBER,
        "desc": "A directed pipeline or network message conveying structured data packets between processes, entities, and stores.",
        "example": "Signed JWT Payload, WebRTC SDP Offer",
        "draw_symbol": lambda ax, cx, cy: (
            ax.add_patch(patches.FancyArrowPatch((cx - 1.6, cy), (cx + 1.6, cy),
                                                arrowstyle="-|>",
                                                color=AMBER,
                                                linewidth=3.5,
                                                mutation_scale=20,
                                                zorder=5)),
            ax.add_patch(patches.FancyBboxPatch((cx - 1.3, cy + 0.25), 2.6, 0.45,
                                               boxstyle="round,pad=0.03,rounding_size=0.1",
                                               facecolor=WHITE, edgecolor=AMBER, linewidth=1.5, zorder=6)),
            ax.text(cx, cy + 0.47, "Auth Token & Session ID", color=NAVY, fontsize=11, fontweight="bold", ha="center", va="center", zorder=7)
        )
    }
]

card_w = 4.2
gap = 0.35
start_x = 0.65

for idx, c in enumerate(cards):
    x = start_x + idx * (card_w + gap)
    y = 0.8
    h = 6.8
    
    # Outer card
    box = patches.FancyBboxPatch((x, y), card_w, h, boxstyle="round,pad=0.06,rounding_size=0.15",
                                facecolor=LIGHT_BG, edgecolor=BORDER, linewidth=2, zorder=2)
    ax.add_patch(box)
    
    # Header
    h_bar = patches.FancyBboxPatch((x, y + h - 0.7), card_w, 0.7, boxstyle="round,pad=0.04,rounding_size=0.1",
                                  facecolor=c["color"], edgecolor="none", zorder=3)
    ax.add_patch(h_bar)
    ax.text(x + 0.35, y + h - 0.35, c["title"], color=WHITE, fontsize=13.5, fontweight="bold", va="center", zorder=4)
    
    # Badge
    b_circle = patches.Circle((x + card_w - 0.5, y + h - 0.35), 0.22, facecolor=WHITE, edgecolor="none", zorder=4)
    ax.add_patch(b_circle)
    ax.text(x + card_w - 0.5, y + h - 0.35, c["badge"], color=c["color"], fontsize=11, fontweight="bold", ha="center", va="center", zorder=5)

    # Symbol Canvas Zone
    sym_bg = patches.FancyBboxPatch((x + 0.3, y + 3.8), card_w - 0.6, 2.0, boxstyle="round,pad=0.04,rounding_size=0.1",
                                   facecolor=WHITE, edgecolor="#E2E8F0", linewidth=1.5, zorder=3)
    ax.add_patch(sym_bg)
    c["draw_symbol"](ax, x + card_w/2, y + 4.8)

    # Label: "Standard Gane & Sarson / Yourdon Notation"
    ax.text(x + card_w/2, y + 3.45, "NOTATION STANDARD", color="#64748B", fontsize=9.5, fontweight="bold", ha="center", va="center", zorder=4)

    # Description section
    ax.text(x + 0.35, y + 2.8, "Functional Definition:", color=NAVY, fontsize=11.5, fontweight="bold", zorder=4)
    
    # Wrap text cleanly
    words = c["desc"].split()
    line1, line2, line3 = "", "", ""
    for w in words:
        if len(line1) + len(w) < 32:
            line1 += w + " "
        elif len(line2) + len(w) < 32:
            line2 += w + " "
        else:
            line3 += w + " "
            
    ax.text(x + 0.35, y + 2.45, line1.strip(), color=SLATE, fontsize=10.5, zorder=4)
    ax.text(x + 0.35, y + 2.15, line2.strip(), color=SLATE, fontsize=10.5, zorder=4)
    if line3:
        ax.text(x + 0.35, y + 1.85, line3.strip(), color=SLATE, fontsize=10.5, zorder=4)

    # Example Pill Box
    ex_box = patches.FancyBboxPatch((x + 0.3, y + 0.35), card_w - 0.6, 0.95, boxstyle="round,pad=0.03,rounding_size=0.08",
                                   facecolor=WHITE, edgecolor=c["color"], linewidth=1.5, zorder=3)
    ax.add_patch(ex_box)
    ax.text(x + 0.5, y + 1.0, "Platform Example:", color=c["color"], fontsize=10, fontweight="bold", zorder=4)
    ax.text(x + 0.5, y + 0.65, c["example"], color=NAVY, fontsize=9.5, fontweight="semibold", zorder=4)

plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
plt.savefig("diagrams/dfd_symbols.png", dpi=200, bbox_inches="tight", pad_inches=0.05)
plt.close()
print("Saved diagrams/dfd_symbols.png")
