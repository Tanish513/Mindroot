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
ROSE = "#DC2626"
BORDER = "#CBD5E1"
LINE_COLOR = "#334155"

bg = patches.Rectangle((0, 0), 19.2, 8.17, facecolor=WHITE, edgecolor="none")
ax.add_patch(bg)

# Helper function for DFD process bubble
def draw_process(ax, x, y, num, title, subtitle=None, color=DARK_EMERALD):
    bubble = patches.Circle((x, y), 1.15, facecolor="#ECFDF5", edgecolor=color, linewidth=2.5, zorder=4)
    ax.add_patch(bubble)
    
    ax.plot([x - 1.0, x + 1.0], [y + 0.4, y + 0.4], color=color, linewidth=1.5, zorder=5)
    ax.text(x, y + 0.72, num, color=color, fontsize=13.5, fontweight="bold", ha="center", va="center", zorder=6)
    
    if subtitle:
        ax.text(x, y + 0.05, title, color=NAVY, fontsize=10.5, fontweight="bold", ha="center", va="center", zorder=6)
        ax.text(x, y - 0.38, subtitle, color=SLATE, fontsize=9.2, ha="center", va="center", zorder=6)
    else:
        ax.text(x, y - 0.12, title, color=NAVY, fontsize=10.5, fontweight="bold", ha="center", va="center", zorder=6)

# Helper function for Data Store
def draw_store(ax, x, y, w, h, store_id, name):
    ax.plot([x, x + w], [y + h/2, y + h/2], color=SLATE, linewidth=2.2, zorder=4)
    ax.plot([x, x + w], [y - h/2, y - h/2], color=SLATE, linewidth=2.2, zorder=4)
    ax.plot([x, x], [y - h/2, y + h/2], color=SLATE, linewidth=2.2, zorder=4)
    ax.plot([x + 0.6, x + 0.6], [y - h/2, y + h/2], color=SLATE, linewidth=1.2, linestyle="--", zorder=4)
    
    fill = patches.Rectangle((x, y - h/2), w, h, facecolor="#F1F5F9", edgecolor="none", zorder=3)
    ax.add_patch(fill)
    
    ax.text(x + 0.3, y, store_id, color=DARK_EMERALD, fontsize=11, fontweight="bold", ha="center", va="center", zorder=5)
    ax.text(x + 0.8, y, name, color=NAVY, fontsize=10, fontweight="bold", va="center", zorder=5)

# Helper function for External Entity
def draw_entity(ax, x, y, w, h, name, col=BLUE):
    box = patches.Rectangle((x - w/2, y - h/2), w, h, facecolor="#EFF6FF", edgecolor=col, linewidth=2.2, zorder=4)
    ax.add_patch(box)
    ax.text(x, y, name, color=NAVY, fontsize=11.5, fontweight="bold", ha="center", va="center", zorder=5)

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
draw_entity(ax, 2.0, 4.2, 2.8, 1.4, "PLATFORM\nADMINISTRATOR", SLATE)
draw_entity(ax, 17.2, 4.2, 2.8, 1.4, "DISPUTE PARTIES\n(Student / Mentor)", ROSE)

# --- PROCESSES ---
draw_process(ax, 6.4, 6.0, "6.0", "User Governance &", "Verification Gates", DARK_EMERALD)
draw_process(ax, 12.8, 6.0, "7.0", "Dispute Arbitration", "& Moderation", ROSE)
draw_process(ax, 6.4, 2.4, "8.0", "Ledger Audit &", "Escrow Reconcile", DARK_EMERALD)
draw_process(ax, 12.8, 2.4, "9.0", "Platform Telemetry", "& System Analytics", BLUE)

# --- DATA STORES ---
draw_store(ax, 8.4, 6.0, 2.8, 0.7, "D1", "User Accounts & Roles")
draw_store(ax, 14.8, 6.0, 2.8, 0.7, "D3", "Sessions & Escrow")
draw_store(ax, 8.4, 2.4, 2.8, 0.7, "D4", "Financial Ledger (Txs)")
draw_store(ax, 14.8, 2.4, 2.8, 0.7, "D5", "Reviews & Complaints")
draw_store(ax, 8.4, 4.2, 2.8, 0.7, "D6", "Audit & Security Logs")

# --- DATA FLOWS ---
# 1. Admin to Process 6.0
flow(ax, (3.4, 4.6), (5.3, 5.7), "Role Updates & Verifications", "top")
flow(ax, (7.55, 6.0), (8.4, 6.0), "Update User Record", "top")

# 2. Admin to Process 7.0 (Dispute Arbitration)
flow(ax, (3.4, 4.4), (11.7, 5.9), "Arbitration Decisions", "top", ROSE)
flow(ax, (15.8, 4.6), (13.9, 5.8), "Filed Dispute / Complaint", "top", ROSE)
flow(ax, (13.95, 6.0), (14.8, 6.0), "Hold / Release Escrow", "top")

# 3. Admin to Process 8.0 (Financial Ledger Audit)
flow(ax, (3.4, 3.8), (5.3, 2.7), "Reconcile Request", "bottom")
flow(ax, (7.55, 2.4), (8.4, 2.4), "Audit Transactions", "bottom")
flow(ax, (8.4, 2.4), (7.55, 2.4), "Ledger Balances", "top")

# 4. Admin to Process 9.0 (Telemetry & Analytics)
flow(ax, (3.4, 3.6), (11.7, 2.5), "Telemetry Dashboard Query", "bottom", BLUE)
flow(ax, (12.8, 3.55), (9.8, 3.85), "Log Event Traces", "bottom")
flow(ax, (12.8, 2.4), (3.4, 4.0), "Real-Time Health Metrics", "top", DARK_EMERALD)

# Legend Bar at Top
leg_box = patches.FancyBboxPatch((0.6, 7.62), 18.0, 0.45, boxstyle="round,pad=0.03,rounding_size=0.08",
                                facecolor=LIGHT_BG, edgecolor=BORDER, linewidth=1.2, zorder=2)
ax.add_patch(leg_box)
ax.text(1.0, 7.84, "DFD LEVEL 1 (ADMIN) LEGEND:", color=SLATE, fontsize=11, fontweight="bold", va="center", zorder=3)

legends = [
    ("Governance Processes (6.0 - 9.0)", DARK_EMERALD),
    ("Dispute Arbitration & Moderation", ROSE),
    ("Relational Data Stores (D1, D3, D4, D5, D6)", SLATE),
    ("Telemetry & Metrics Pipeline", BLUE)
]
curr_lx = 4.8
for l_name, l_col in legends:
    dot = patches.Circle((curr_lx, 7.84), 0.09, facecolor=l_col, edgecolor="none", zorder=3)
    ax.add_patch(dot)
    ax.text(curr_lx + 0.2, 7.84, l_name, color=SLATE, fontsize=10.5, fontweight="semibold", va="center", zorder=3)
    curr_lx += 3.3

plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
plt.savefig("diagrams/dfd_admin_level1.png", dpi=200, bbox_inches="tight", pad_inches=0.05)
plt.close()
print("Saved diagrams/dfd_admin_level1.png")
