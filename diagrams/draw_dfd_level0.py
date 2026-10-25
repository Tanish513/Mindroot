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
BORDER = "#94A3B8"
LINE_COLOR = "#334155"

bg = patches.Rectangle((0, 0), 19.2, 8.17, facecolor=WHITE, edgecolor="none")
ax.add_patch(bg)

# Central Bubble: 0.0 Mindroot Platform
cx, cy = 9.6, 4.08
bubble = patches.Circle((cx, cy), 1.9, facecolor="#ECFDF5", edgecolor=DARK_EMERALD, linewidth=3.5, zorder=5)
ax.add_patch(bubble)

ax.text(cx, cy + 0.9, "0.0", color=DARK_EMERALD, fontsize=20, fontweight="bold", ha="center", va="center", zorder=6)
ax.text(cx, cy + 0.35, "MINDROOT PEER", color=NAVY, fontsize=14, fontweight="bold", ha="center", va="center", zorder=6)
ax.text(cx, cy - 0.05, "EXCHANGE PLATFORM", color=NAVY, fontsize=14, fontweight="bold", ha="center", va="center", zorder=6)
ax.text(cx, cy - 0.65, "(Context Level Engine)", color=SLATE, fontsize=11, fontweight="semibold", ha="center", va="center", zorder=6)

# Outer External Entities
entities = [
    ("STUDENT / LEARNER", 1.8, 4.9, 3.2, 1.8, BLUE, [
        ("In: Registration, Search Query, Session Bookings, Token Escrow", "->"),
        ("Out: Match Results, Video Stream, Session Confirmations", "<-")
    ]),
    ("TEACHER / MENTOR", 14.2, 4.9, 3.2, 1.8, DARK_EMERALD, [
        ("In: Teaching Availability, Slot Approvals, Whiteboard State", "->"),
        ("Out: Booking Alerts, Earned Token Credits, Peer Reviews", "<-")
    ]),
    ("ADMINISTRATOR", 9.6, 0.45, 3.4, 1.5, SLATE, [
        ("In: User Moderation, Dispute Arbitration, Policy Config", "->"),
        ("Out: Financial Audit Ledger, Platform Telemetry, Health Metrics", "<-")
    ]),
    ("GOOGLE OAUTH 2.0", 1.8, 1.2, 3.2, 1.5, AMBER, [
        ("In: Client Auth Request, OAuth 2.0 Credential", "->"),
        ("Out: Verified JWT Profile, Email Verification ID Token", "<-")
    ]),
    ("CALENDAR APPS", 9.6, 6.4, 3.4, 1.4, DARK_EMERALD, [
        ("Out: Standard .ics VCALENDAR / VEVENT Sync File", "<-"),
        ("Features: Apple iCal, Google Calendar, MS Outlook", "info")
    ]),
    ("STUN / TURN SERVERS", 14.2, 1.2, 3.2, 1.5, BLUE, [
        ("In: ICE Candidate Binding Requests (UDP 19302)", "->"),
        ("Out: Public IP / Port Mappings & TURN Relay Allocation", "<-")
    ])
]

# Helper to draw external entity box
def draw_entity_box(ax, title, x, y, w, h, col):
    box = patches.Rectangle((x, y), w, h, facecolor=LIGHT_BG, edgecolor=col, linewidth=2.5, zorder=3)
    ax.add_patch(box)
    h_bar = patches.Rectangle((x, y + h - 0.45), w, 0.45, facecolor=col, edgecolor="none", zorder=4)
    ax.add_patch(h_bar)
    ax.text(x + w/2, y + h - 0.22, title, color=WHITE, fontsize=11.5, fontweight="bold", ha="center", va="center", zorder=5)

for title, ex, ey, ew, eh, col, _ in entities:
    draw_entity_box(ax, title, ex, ey, ew, eh, col)

# Helper for bidirectional flow arrows
def draw_flow(ax, p1, p2, label_in, label_out, curved=False):
    # Arrow 1: p1 -> p2 (Inbound)
    arc1 = patches.FancyArrowPatch(p1, p2,
                                  connectionstyle="arc3,rad=-0.1" if curved else "arc3,rad=-0.08",
                                  arrowstyle="-|>",
                                  color=DARK_EMERALD,
                                  linewidth=2.2,
                                  mutation_scale=14,
                                  zorder=4)
    ax.add_patch(arc1)
    
    # Arrow 2: p2 -> p1 (Outbound)
    arc2 = patches.FancyArrowPatch(p2, p1,
                                  connectionstyle="arc3,rad=-0.1" if curved else "arc3,rad=-0.08",
                                  arrowstyle="-|>",
                                  color=BLUE,
                                  linewidth=2.2,
                                  mutation_scale=14,
                                  zorder=4)
    ax.add_patch(arc2)

# 1. Student <-> Mindroot
draw_flow(ax, (5.0, 5.9), (7.8, 4.6), "Requests & Bookings", "Matches & Streams")
ax.text(6.4, 5.65, "In: Bookings, Search, Tokens", color=DARK_EMERALD, fontsize=10, fontweight="bold", ha="center", zorder=7)
ax.text(6.4, 5.0, "Out: Matches, Confirmed Session", color=BLUE, fontsize=10, fontweight="bold", ha="center", zorder=7)

# 2. Teacher <-> Mindroot
draw_flow(ax, (14.2, 5.9), (11.4, 4.6), "Approvals & Whiteboard", "Alerts & Token Credits")
ax.text(12.8, 5.65, "In: Approvals, Whiteboard", color=DARK_EMERALD, fontsize=10, fontweight="bold", ha="center", zorder=7)
ax.text(12.8, 5.0, "Out: Booking Alerts, Credits", color=BLUE, fontsize=10, fontweight="bold", ha="center", zorder=7)

# 3. Calendar Sync (Top)
arr_cal = patches.FancyArrowPatch((9.6, 5.98), (9.6, 6.4),
                                  arrowstyle="-|>", color=DARK_EMERALD, linewidth=2.5, mutation_scale=14, zorder=4)
ax.add_patch(arr_cal)
ax.text(10.1, 6.18, "Export .ics File", color=DARK_EMERALD, fontsize=10.5, fontweight="bold", va="center", zorder=7)

# 4. Admin <-> Mindroot (Bottom)
draw_flow(ax, (9.6, 1.95), (9.6, 2.18), "Moderation", "Audit Logs")
ax.text(8.3, 2.05, "In: Dispute Arbitration", color=DARK_EMERALD, fontsize=10, fontweight="bold", ha="right", zorder=7)
ax.text(10.9, 2.05, "Out: Telemetry & Ledgers", color=BLUE, fontsize=10, fontweight="bold", ha="left", zorder=7)

# 5. Google OAuth <-> Mindroot
draw_flow(ax, (5.0, 2.0), (8.0, 3.2), "Auth Request", "ID Token")
ax.text(6.3, 2.9, "In: OAuth Token Exchange", color=DARK_EMERALD, fontsize=10, fontweight="bold", ha="center", zorder=7)
ax.text(6.3, 2.3, "Out: Verified Profile Data", color=BLUE, fontsize=10, fontweight="bold", ha="center", zorder=7)

# 6. STUN/TURN <-> Mindroot
draw_flow(ax, (14.2, 2.0), (11.2, 3.2), "Binding Request", "ICE Candidates")
ax.text(12.9, 2.9, "In: NAT Traversal Requests", color=DARK_EMERALD, fontsize=10, fontweight="bold", ha="center", zorder=7)
ax.text(12.9, 2.3, "Out: Public Mappings / Relays", color=BLUE, fontsize=10, fontweight="bold", ha="center", zorder=7)

# Legend Bar at Top
leg_box = patches.FancyBboxPatch((0.6, 7.62), 18.0, 0.45, boxstyle="round,pad=0.03,rounding_size=0.08",
                                facecolor=LIGHT_BG, edgecolor=BORDER, linewidth=1.2, zorder=2)
ax.add_patch(leg_box)
ax.text(1.0, 7.84, "CONTEXT DFD LEGEND:", color=SLATE, fontsize=11, fontweight="bold", va="center", zorder=3)

legends = [
    ("0.0 Central System Process", DARK_EMERALD),
    ("External Entity Boundary", BLUE),
    ("Inbound Data Flow Pipeline", DARK_EMERALD),
    ("Outbound Response Pipeline", BLUE)
]
curr_lx = 4.8
for l_name, l_col in legends:
    dot = patches.Circle((curr_lx, 7.84), 0.09, facecolor=l_col, edgecolor="none", zorder=3)
    ax.add_patch(dot)
    ax.text(curr_lx + 0.2, 7.84, l_name, color=SLATE, fontsize=10.5, fontweight="semibold", va="center", zorder=3)
    curr_lx += 3.2

plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
plt.savefig("diagrams/dfd_level_0.png", dpi=200, bbox_inches="tight", pad_inches=0.05)
plt.close()
print("Saved diagrams/dfd_level_0.png")
