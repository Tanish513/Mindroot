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
LINE_COLOR = "#334155"

bg = patches.Rectangle((0, 0), 19.2, 8.17, facecolor=WHITE, edgecolor="none")
ax.add_patch(bg)

# Helper function to draw a DFD process bubble
def draw_process(ax, x, y, num, title, subtitle=None, color=DARK_EMERALD):
    bubble = patches.Circle((x, y), 1.05, facecolor="#ECFDF5", edgecolor=color, linewidth=2.5, zorder=4)
    ax.add_patch(bubble)
    
    # Process number line
    ax.plot([x - 0.9, x + 0.9], [y + 0.35, y + 0.35], color=color, linewidth=1.5, zorder=5)
    ax.text(x, y + 0.65, num, color=color, fontsize=13, fontweight="bold", ha="center", va="center", zorder=6)
    
    if subtitle:
        ax.text(x, y, title, color=NAVY, fontsize=10.5, fontweight="bold", ha="center", va="center", zorder=6)
        ax.text(x, y - 0.38, subtitle, color=SLATE, fontsize=9, ha="center", va="center", zorder=6)
    else:
        ax.text(x, y - 0.15, title, color=NAVY, fontsize=10.5, fontweight="bold", ha="center", va="center", zorder=6)

# Helper function to draw a DFD Data Store
def draw_store(ax, x, y, w, h, store_id, name):
    # Top and bottom horizontal lines, left line
    ax.plot([x, x + w], [y + h/2, y + h/2], color=SLATE, linewidth=2.2, zorder=4)
    ax.plot([x, x + w], [y - h/2, y - h/2], color=SLATE, linewidth=2.2, zorder=4)
    ax.plot([x, x], [y - h/2, y + h/2], color=SLATE, linewidth=2.2, zorder=4)
    ax.plot([x + 0.6, x + 0.6], [y - h/2, y + h/2], color=SLATE, linewidth=1.2, linestyle="--", zorder=4)
    
    fill = patches.Rectangle((x, y - h/2), w, h, facecolor="#F1F5F9", edgecolor="none", zorder=3)
    ax.add_patch(fill)
    
    ax.text(x + 0.3, y, store_id, color=DARK_EMERALD, fontsize=11, fontweight="bold", ha="center", va="center", zorder=5)
    ax.text(x + 0.8, y, name, color=NAVY, fontsize=10, fontweight="bold", va="center", zorder=5)

# Helper function to draw an external entity
def draw_entity(ax, x, y, w, h, name, col=BLUE):
    box = patches.Rectangle((x - w/2, y - h/2), w, h, facecolor="#EFF6FF", edgecolor=col, linewidth=2.2, zorder=4)
    ax.add_patch(box)
    ax.text(x, y, name, color=NAVY, fontsize=11, fontweight="bold", ha="center", va="center", zorder=5)

def flow(ax, p1, p2, label=None, label_pos="top", col=LINE_COLOR):
    arr = patches.FancyArrowPatch(p1, p2,
                                 arrowstyle="-|>",
                                 color=col,
                                 linewidth=1.8,
                                 mutation_scale=12,
                                 zorder=5)
    ax.add_patch(arr)
    if label:
        mx, my = (p1[0] + p2[0])/2, (p1[1] + p2[1])/2
        dy = 0.16 if label_pos=="top" else -0.16
        ax.text(mx, my + dy, label, color=DARK_EMERALD, fontsize=9.5, fontweight="bold", ha="center", va="center", zorder=6)

# --- EXTERNAL ENTITIES ---
draw_entity(ax, 1.8, 6.2, 2.4, 1.1, "STUDENT /\nLEARNER", BLUE)
draw_entity(ax, 1.8, 2.2, 2.4, 1.1, "GOOGLE\nOAUTH 2.0", AMBER)
draw_entity(ax, 17.4, 4.2, 2.4, 1.1, "TEACHER /\nMENTOR", DARK_EMERALD)

# --- PROCESSES ---
draw_process(ax, 5.0, 6.2, "1.0", "Authentication &", "Identity Gate")
draw_process(ax, 8.8, 6.2, "2.0", "Peer Matching &", "Compatibility")
draw_process(ax, 12.6, 6.2, "3.0", "Session Booking", "& Escrow Lock")
draw_process(ax, 12.6, 2.2, "4.0", "Live Classroom &", "WebRTC Relay")
draw_process(ax, 8.8, 2.2, "5.0", "Mutual Review &", "Trust Scoring")

# --- DATA STORES ---
draw_store(ax, 4.0, 4.2, 2.8, 0.7, "D1", "User Accounts & Tokens")
draw_store(ax, 7.8, 4.2, 2.6, 0.7, "D2", "Skills & Taxonomies")
draw_store(ax, 11.4, 4.2, 2.8, 0.7, "D3", "Sessions & Bookings")
draw_store(ax, 15.0, 6.2, 2.8, 0.7, "D4", "Financial Ledger (Txs)")
draw_store(ax, 15.0, 2.2, 2.8, 0.7, "D5", "Reviews & Ratings")

# --- DATA FLOWS ---
# 1. Auth flow
flow(ax, (3.0, 6.4), (3.95, 6.4), "Credentials", "top")
flow(ax, (3.95, 6.0), (3.0, 6.0), "JWT Token", "bottom")
flow(ax, (1.8, 2.75), (4.2, 5.4), "Google ID Token", "top", AMBER)
flow(ax, (5.0, 5.15), (5.0, 4.55), "Verify User", "right")

# 2. Matching flow
flow(ax, (6.05, 6.2), (7.75, 6.2), "Search Query", "top")
flow(ax, (8.8, 5.15), (8.8, 4.55), "Query Skills", "right")
flow(ax, (7.8, 4.2), (5.8, 4.5), "Skill Catalog", "bottom")

# 3. Booking & Escrow (Process 3.0)
flow(ax, (9.85, 6.2), (11.55, 6.2), "Match Selection", "top")
flow(ax, (12.6, 5.15), (12.6, 4.55), "Create Session", "right")
flow(ax, (13.65, 6.2), (15.0, 6.2), "Lock Escrow", "top", DARK_EMERALD)

# 4. Teacher interaction
flow(ax, (16.2, 4.5), (13.65, 6.0), "Slot Approval", "bottom")
flow(ax, (12.6, 3.25), (16.2, 4.0), "Join Classroom", "top")

# 5. Live Classroom & Signaling
flow(ax, (12.6, 3.85), (12.6, 3.25), "Fetch Room ID", "right")
flow(ax, (3.0, 5.8), (11.6, 2.5), "WebRTC Media Stream", "bottom", BLUE)

# 6. Reviews & Trust score
flow(ax, (11.55, 2.2), (9.85, 2.2), "Completed Session", "bottom")
flow(ax, (8.8, 2.2), (5.4, 3.85), "Update Trust Score", "bottom", DARK_EMERALD)
flow(ax, (9.85, 2.0), (15.0, 2.0), "Store Rating", "bottom")

# Legend Bar at Top
leg_box = patches.FancyBboxPatch((0.6, 7.62), 18.0, 0.45, boxstyle="round,pad=0.03,rounding_size=0.08",
                                facecolor=LIGHT_BG, edgecolor=BORDER, linewidth=1.2, zorder=2)
ax.add_patch(leg_box)
ax.text(1.0, 7.84, "DFD LEVEL 1 (USER) LEGEND:", color=SLATE, fontsize=11, fontweight="bold", va="center", zorder=3)

legends = [
    ("Numbered Process (1.0 - 5.0)", DARK_EMERALD),
    ("Relational Data Store (D1 - D5)", SLATE),
    ("External Actor Boundary", BLUE),
    ("Escrow & Settlement Pipeline", DARK_EMERALD)
]
curr_lx = 5.2
for l_name, l_col in legends:
    dot = patches.Circle((curr_lx, 7.84), 0.09, facecolor=l_col, edgecolor="none", zorder=3)
    ax.add_patch(dot)
    ax.text(curr_lx + 0.2, 7.84, l_name, color=SLATE, fontsize=10.5, fontweight="semibold", va="center", zorder=3)
    curr_lx += 3.2

plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
plt.savefig("diagrams/dfd_user_level1.png", dpi=200, bbox_inches="tight", pad_inches=0.05)
plt.close()
print("Saved diagrams/dfd_user_level1.png")
