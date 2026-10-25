import matplotlib.pyplot as plt
import matplotlib.patches as patches
import sys

sys.stdout.reconfigure(encoding='utf-8')

# High-resolution 3840x1634 canvas (aspect ratio ~2.35:1)
fig, ax = plt.subplots(figsize=(19.2, 8.17), dpi=200)
ax.set_xlim(0, 19.2)
ax.set_ylim(0, 8.17)
ax.axis('off')

# Color Palette
NAVY = "#0F172A"
SLATE = "#1E293B"
EMERALD = "#10B981"
DARK_EMERALD = "#065F46"
LIGHT_BG = "#F8FAFC"
WHITE = "#FFFFFF"
BLUE = "#2563EB"
AMBER = "#D97706"
ROSE = "#EF4444"
BORDER = "#CBD5E1"
LANE_BORDER = "#94A3B8"
LINE_COLOR = "#334155"

# Background
bg = patches.Rectangle((0, 0), 19.2, 8.17, facecolor=WHITE, edgecolor="none")
ax.add_patch(bg)

# Draw 5 Swim-lanes horizontally
lanes = [
    ("VISITOR", 6.8, 1.0, "#F1F5F9"),
    ("STUDENT / LEARNER", 5.2, 1.6, "#F8FAFC"),
    ("TEACHER / MENTOR", 3.6, 1.6, "#F1F5F9"),
    ("SYSTEM / ESCROW", 2.0, 1.6, "#F8FAFC"),
    ("ADMINISTRATOR", 0.7, 1.3, "#F1F5F9")
]

for name, y_bot, h, bg_c in lanes:
    # Lane background
    lane_rect = patches.Rectangle((0.6, y_bot), 18.0, h, facecolor=bg_c, edgecolor=LANE_BORDER, linewidth=1.2, zorder=1)
    ax.add_patch(lane_rect)
    # Lane header label box
    lbl_box = patches.Rectangle((0.6, y_bot), 2.2, h, facecolor=NAVY, edgecolor=LANE_BORDER, linewidth=1.2, zorder=2)
    ax.add_patch(lbl_box)
    ax.text(1.7, y_bot + h/2, name, color=WHITE, fontsize=11, fontweight="bold", ha="center", va="center", rotation=0, zorder=3)

# Helper shapes
def draw_terminator(ax, x, y, w, h, text, color=DARK_EMERALD):
    box = patches.FancyBboxPatch((x - w/2, y - h/2), w, h, boxstyle="round,pad=0.05,rounding_size=0.25",
                                facecolor=color, edgecolor="none", zorder=4)
    ax.add_patch(box)
    ax.text(x, y, text, color=WHITE, fontsize=11, fontweight="bold", ha="center", va="center", zorder=5)

def draw_proc(ax, x, y, w, h, step_num, title, subtitle=None, color=WHITE, border_col=SLATE):
    box = patches.FancyBboxPatch((x - w/2, y - h/2), w, h, boxstyle="round,pad=0.04,rounding_size=0.1",
                                facecolor=color, edgecolor=border_col, linewidth=1.8, zorder=4)
    ax.add_patch(box)
    badge = patches.Circle((x - w/2 + 0.22, y + h/2 - 0.2), 0.16, facecolor=border_col, edgecolor="none", zorder=5)
    ax.add_patch(badge)
    ax.text(x - w/2 + 0.22, y + h/2 - 0.2, str(step_num), color=WHITE, fontsize=9.5, fontweight="bold", ha="center", va="center", zorder=6)
    
    if subtitle:
        ax.text(x + 0.1, y + 0.12, title, color=NAVY, fontsize=11, fontweight="bold", ha="center", va="center", zorder=5)
        ax.text(x + 0.1, y - 0.16, subtitle, color=SLATE, fontsize=9.5, ha="center", va="center", zorder=5)
    else:
        ax.text(x + 0.1, y, title, color=NAVY, fontsize=11, fontweight="bold", ha="center", va="center", zorder=5)

def draw_decision(ax, x, y, w, h, step_num, question):
    pts = [[x, y + h/2], [x + w/2, y], [x, y - h/2], [x - w/2, y]]
    poly = patches.Polygon(pts, closed=True, facecolor="#FEF3C7", edgecolor=AMBER, linewidth=2, zorder=4)
    ax.add_patch(poly)
    ax.text(x, y + 0.08, f"#{step_num}", color=AMBER, fontsize=9.5, fontweight="bold", ha="center", va="center", zorder=5)
    ax.text(x, y - 0.12, question, color=NAVY, fontsize=10, fontweight="bold", ha="center", va="center", zorder=5)

def connect(ax, x1, y1, x2, y2, label=None, label_side="top", color=LINE_COLOR):
    arrow = patches.FancyArrowPatch((x1, y1), (x2, y2),
                                   arrowstyle="-|>",
                                   color=color,
                                   linewidth=2,
                                   mutation_scale=12,
                                   zorder=6)
    ax.add_patch(arrow)
    if label:
        mx, my = (x1 + x2)/2, (y1 + y2)/2
        dy = 0.16 if label_side == "top" else -0.16
        dx = 0.2 if label_side == "right" else 0
        ax.text(mx + dx, my + dy, label, color=DARK_EMERALD if label=="Yes" else (ROSE if label=="No" else SLATE),
                fontsize=10, fontweight="bold", ha="center", va="center", zorder=7)

# --- WORKFLOW NODES ---
# 1. Start (Visitor lane)
draw_terminator(ax, 3.5, 7.3, 1.2, 0.45, "START", DARK_EMERALD)

# 2. Decision: Registered?
draw_decision(ax, 5.2, 7.3, 1.8, 0.7, 1, "Registered?")
connect(ax, 4.1, 7.3, 4.3, 7.3)

# 3. Registration Proc (Visitor lane)
draw_proc(ax, 7.4, 7.3, 1.9, 0.55, 2, "Sign Up / Register", "Profile & Skills Setup", WHITE, BLUE)
connect(ax, 6.1, 7.3, 6.45, 7.3, "No")

# 4. Login Proc (Student lane)
draw_proc(ax, 5.2, 6.0, 1.9, 0.55, 3, "Authenticate", "Google OAuth or JWT", WHITE, DARK_EMERALD)
connect(ax, 5.2, 6.95, 5.2, 6.3, "Yes")
connect(ax, 7.4, 7.0, 6.2, 6.0)

# 5. Search & Matchmaking (Student lane)
draw_proc(ax, 7.8, 6.0, 2.0, 0.55, 4, "Matchfinder Hub", "Browse Compatible Peers", WHITE, BLUE)
connect(ax, 6.15, 6.0, 6.8, 6.0)

# 6. Decision: Tokens >= 1?
draw_decision(ax, 10.3, 6.0, 2.0, 0.75, 5, "Tokens >= 1?")
connect(ax, 8.8, 6.0, 9.3, 6.0)

# 7. Escrow Lock Proc (System lane)
draw_proc(ax, 10.3, 2.8, 2.1, 0.55, 6, "Escrow Hold", "Lock 1 Skill Token", WHITE, DARK_EMERALD)
connect(ax, 10.3, 5.62, 10.3, 3.1, "Yes")

# Buy/Earn Tokens Proc (Student lane)
draw_proc(ax, 10.3, 4.4, 1.8, 0.5, 7, "Earn / Buy Tokens", "Teach Peer or Top-up", WHITE, AMBER)
connect(ax, 10.3, 5.62, 10.3, 4.65, "No", "right")
connect(ax, 10.3, 4.15, 10.3, 3.1)

# 8. Booking Request Sent (Teacher lane)
draw_proc(ax, 12.8, 4.4, 2.0, 0.55, 8, "Booking Notification", "Session Invitation Sent", WHITE, BLUE)
connect(ax, 11.35, 2.8, 12.0, 4.4)

# 9. Decision: Mentor Accepts?
draw_decision(ax, 12.8, 3.6, 2.0, 0.75, 9, "Mentor Accepts?")
connect(ax, 12.8, 4.1, 12.8, 3.98)

# 10. Refund on Decline (System lane)
draw_proc(ax, 12.8, 2.8, 1.8, 0.5, 10, "Auto-Refund", "Release Escrow Hold", WHITE, ROSE)
connect(ax, 12.8, 3.22, 12.8, 3.05, "No", "right")

# 11. Schedule Confirmed & ICS Sync (System lane)
draw_proc(ax, 15.1, 2.8, 2.0, 0.55, 11, "Session Confirmed", ".ics Calendar Export", WHITE, DARK_EMERALD)
connect(ax, 13.8, 3.6, 14.5, 3.1, "Yes")

# 12. Live WebRTC Classroom (System / All lanes)
draw_proc(ax, 15.1, 4.4, 2.1, 0.55, 12, "Live Virtual Room", "Video, Code & Board", WHITE, BLUE)
connect(ax, 15.1, 3.1, 15.1, 4.1)

# 13. Decision: Completed? (Teacher / Student)
draw_decision(ax, 15.1, 6.0, 1.9, 0.75, 13, "Completed?")
connect(ax, 15.1, 4.7, 15.1, 5.62)

# Dispute Proc (Admin lane)
draw_proc(ax, 15.1, 1.35, 1.9, 0.55, 14, "Dispute Review", "Admin Mediation", WHITE, ROSE)
connect(ax, 16.05, 6.0, 17.5, 6.0, "No")
connect(ax, 17.5, 6.0, 17.5, 1.35)
connect(ax, 17.5, 1.35, 16.1, 1.35)

# 15. Settle Ledger & Trust Score (System lane)
draw_proc(ax, 17.2, 2.8, 2.0, 0.55, 15, "Settle Ledger", "Credit Mentor + Review", WHITE, DARK_EMERALD)
connect(ax, 15.1, 6.38, 17.2, 6.38, "Yes")
connect(ax, 17.2, 6.38, 17.2, 3.1)

# 16. End Terminator
draw_terminator(ax, 18.5, 2.8, 1.0, 0.45, "END", NAVY)
connect(ax, 18.2, 2.8, 18.0, 2.8)

# Legend Bar at Top
leg_box = patches.FancyBboxPatch((0.6, 7.82), 18.0, 0.32, boxstyle="round,pad=0.02,rounding_size=0.06",
                                facecolor=WHITE, edgecolor=BORDER, linewidth=1, zorder=2)
ax.add_patch(leg_box)
ax.text(0.9, 7.98, "FLOWCHART SYMBOLS:", color=SLATE, fontsize=10, fontweight="bold", va="center", zorder=3)

syms = [
    ("Terminator (Start / End)", DARK_EMERALD),
    ("Process Action", BLUE),
    ("Decision Point", AMBER),
    ("Escrow & Ledger Settlement", DARK_EMERALD),
    ("Refund / Dispute Path", ROSE)
]
lx = 3.6
for s_name, s_col in syms:
    circ = patches.Circle((lx, 7.98), 0.08, facecolor=s_col, edgecolor="none", zorder=3)
    ax.add_patch(circ)
    ax.text(lx + 0.18, 7.98, s_name, color=SLATE, fontsize=9.5, fontweight="semibold", va="center", zorder=3)
    lx += 2.9

plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
plt.savefig("diagrams/system_flowchart.png", dpi=200, bbox_inches="tight", pad_inches=0.05)
plt.close()
print("Saved diagrams/system_flowchart.png")
