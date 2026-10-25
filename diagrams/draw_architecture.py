import matplotlib.pyplot as plt
import matplotlib.patches as patches

# High-resolution 3840x1634 canvas (aspect ratio ~2.35:1)
fig, ax = plt.subplots(figsize=(19.2, 8.17), dpi=200)
ax.set_xlim(0, 19.2)
ax.set_ylim(0, 8.17)
ax.axis('off')

# Color Palette (Preserving deck design)
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

# Background canvas
bg = patches.Rectangle((0, 0), 19.2, 8.17, facecolor=WHITE, edgecolor="none")
ax.add_patch(bg)

# Helper function to draw rounded boxes with text
def draw_card(ax, x, y, w, h, title, items, bg_col=LIGHT_BG, border_col=BORDER, header_col=NAVY, badge_text=None, badge_col=EMERALD):
    card = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.08,rounding_size=0.15",
                                 facecolor=bg_col, edgecolor=border_col, linewidth=2, zorder=2)
    ax.add_patch(card)
    
    # Header bar
    h_bar = patches.FancyBboxPatch((x, y + h - 0.55), w, 0.55, boxstyle="round,pad=0.05,rounding_size=0.12",
                                  facecolor=header_col, edgecolor="none", zorder=3)
    ax.add_patch(h_bar)
    ax.text(x + 0.25, y + h - 0.28, title, color=WHITE, fontsize=14, fontweight="bold", va="center", zorder=4)
    
    if badge_text:
        b_box = patches.FancyBboxPatch((x + w - 1.8, y + h - 0.45), 1.6, 0.35, boxstyle="round,pad=0.03,rounding_size=0.08",
                                      facecolor=badge_col, edgecolor="none", zorder=5)
        ax.add_patch(b_box)
        ax.text(x + w - 1.0, y + h - 0.28, badge_text, color=WHITE, fontsize=10, fontweight="bold", ha="center", va="center", zorder=6)

    # Content text
    curr_y = y + h - 0.95
    for item in items:
        if isinstance(item, tuple):
            prefix, text = item
            ax.text(x + 0.25, curr_y, prefix, color=DARK_EMERALD, fontsize=12, fontweight="bold", va="center", zorder=4)
            ax.text(x + 0.3 + len(prefix)*0.14, curr_y, text, color=SLATE, fontsize=12, va="center", zorder=4)
        else:
            ax.text(x + 0.25, curr_y, f"• {item}", color=SLATE, fontsize=12, va="center", zorder=4)
        curr_y -= 0.36

# TIER 1: CLIENT PRESENTATION LAYER (LEFT COLUMN)
tier1_items = [
    ("Pages: ", "Dashboard, MatchFinder, LiveRoom, Admin"),
    ("State Store: ", "Zustand (useAppStore: tokens, role, user)"),
    ("Real-Time Hook: ", "useWebRTC (RTCPeerConnection, streams)"),
    ("Signaling: ", "Socket.io Client (globalSocket & broadcast)"),
    ("Styling & UI: ", "Tailwind CSS & Framer Motion transitions"),
    ("Google SSO: ", "@react-oauth/google ID Token flow")
]
draw_card(ax, 0.6, 1.2, 5.2, 6.2, "TIER 1: CLIENT LAYER", tier1_items, header_col=DARK_EMERALD, badge_text="REACT 19 SPA", badge_col=EMERALD)

# TIER 2: APPLICATION & REAL-TIME GATEWAY (MIDDLE COLUMN)
tier2_items = [
    ("REST API: ", "Express.js 5.x routing engine"),
    ("Auth & Security: ", "JWT tokens (7d), rate limiter, bcrypt"),
    ("Session Engine: ", "Booking guards, schedule validation"),
    ("Token Service: ", "Mutex locks, atomic deductions & escrow"),
    ("Signaling Server: ", "Socket.io (rooms, SDP/ICE relay, chat)"),
    ("Calendar Sync: ", ".ics RFC 5545 calendar invitation generator"),
    ("Notification Svc: ", "SMTP / Nodemailer & Resend gateway")
]
draw_card(ax, 6.8, 1.2, 5.4, 6.2, "TIER 2: BACKEND & SIGNALING", tier2_items, header_col=SLATE, badge_text="NODE / EXPRESS", badge_col=BLUE)

# TIER 3: PERSISTENCE & EXTERNAL SERVICES (RIGHT COLUMN)
tier3_items = [
    ("ORM Layer: ", "Prisma ORM (@prisma/client, typesafe)"),
    ("Primary DB: ", "PostgreSQL on Supabase (Pooler 6543)"),
    ("Sync Fallback: ", "JSON In-Memory atomic state (defaultSeed)"),
    ("Google OAuth: ", "Google Auth Library (verifyIdToken)"),
    ("ICE Traversal: ", "STUN / TURN (stun.l.google.com:19302)"),
    ("Media Streams: ", "P2P WebRTC Direct DTLS / SRTP Channel")
]
draw_card(ax, 13.2, 1.2, 5.4, 6.2, "TIER 3: PERSISTENCE & CLOUD", tier3_items, header_col=NAVY, badge_text="POSTGRESQL & CLOUD", badge_col=AMBER)

# CONNECTORS & PROTOCOL LABELS (THICK ARROWS)
def draw_arrow(ax, x1, y1, x2, y2, label, protocol_color=DARK_EMERALD, curved=False):
    style = "Simple,tail_width=2,head_width=8,head_length=8"
    connectionstyle = "arc3,rad=-0.1" if curved else "arc3,rad=0"
    arrow = patches.FancyArrowPatch((x1, y1), (x2, y2),
                                   connectionstyle=connectionstyle,
                                   arrowstyle="<|-|>",
                                   color=LINE_COLOR,
                                   linewidth=2.5,
                                   zorder=10)
    ax.add_patch(arrow)
    mid_x = (x1 + x2) / 2
    mid_y = (y1 + y2) / 2 + (0.2 if curved else 0.15)
    
    # Label pill
    txt_len = len(label) * 0.11
    pill = patches.FancyBboxPatch((mid_x - txt_len/2, mid_y - 0.16), txt_len, 0.32,
                                 boxstyle="round,pad=0.03,rounding_size=0.08",
                                 facecolor=WHITE, edgecolor=protocol_color, linewidth=1.5, zorder=11)
    ax.add_patch(pill)
    ax.text(mid_x, mid_y, label, color=protocol_color, fontsize=10.5, fontweight="bold", ha="center", va="center", zorder=12)

# Connector Tier 1 <-> Tier 2 (Top: REST/HTTPS, Mid: WebSocket)
draw_arrow(ax, 5.8, 5.8, 6.8, 5.8, "HTTPS / REST (JSON)", DARK_EMERALD)
draw_arrow(ax, 5.8, 3.8, 6.8, 3.8, "WebSocket (Socket.io)", BLUE)
draw_arrow(ax, 5.8, 2.2, 6.8, 2.2, "Room Events & Signaling", SLATE)

# Connector Tier 2 <-> Tier 3 (Prisma SQL, Google Auth, STUN)
draw_arrow(ax, 12.2, 5.8, 13.2, 5.8, "SQL (TCP 5432 / 6543)", DARK_EMERALD)
draw_arrow(ax, 12.2, 3.8, 13.2, 3.8, "HTTPS / OAuth 2.0 API", BLUE)
draw_arrow(ax, 12.2, 2.2, 13.2, 2.2, "STUN / UDP 19302 Relay", AMBER)

# Direct P2P Media Connection Arc (Client to Client / Cloud ICE)
arc = patches.FancyArrowPatch((3.2, 1.2), (15.8, 1.2),
                             connectionstyle="arc3,rad=-0.15",
                             arrowstyle="<|-|>",
                             color=EMERALD,
                             linewidth=3,
                             linestyle="--",
                             zorder=10)
ax.add_patch(arc)
p2p_pill = patches.FancyBboxPatch((9.5 - 2.5, 0.25), 5.0, 0.42,
                                 boxstyle="round,pad=0.04,rounding_size=0.1",
                                 facecolor=DARK_EMERALD, edgecolor="none", zorder=11)
ax.add_patch(p2p_pill)
ax.text(9.5, 0.46, "DIRECT P2P MEDIA CHANNEL (WebRTC DTLS / SRTP Audio & Video)",
        color=WHITE, fontsize=11, fontweight="bold", ha="center", va="center", zorder=12)

# Legend Bar at Top
legend_bg = patches.FancyBboxPatch((0.6, 7.55), 18.0, 0.45, boxstyle="round,pad=0.03,rounding_size=0.08",
                                  facecolor=LIGHT_BG, edgecolor=BORDER, linewidth=1.2, zorder=2)
ax.add_patch(legend_bg)
ax.text(1.0, 7.78, "PROTOCOL LEGEND:", color=SLATE, fontsize=11, fontweight="bold", va="center", zorder=3)

protocols = [
    ("HTTPS / REST (JSON)", DARK_EMERALD),
    ("WebSocket (Socket.io)", BLUE),
    ("SQL (PostgreSQL Pooler)", NAVY),
    ("STUN / UDP Binding", AMBER),
    ("P2P Media Channel (WebRTC)", EMERALD)
]
curr_lx = 4.2
for name, col in protocols:
    dot = patches.Circle((curr_lx, 7.78), 0.09, facecolor=col, edgecolor="none", zorder=3)
    ax.add_patch(dot)
    ax.text(curr_lx + 0.2, 7.78, name, color=SLATE, fontsize=10.5, fontweight="semibold", va="center", zorder=3)
    curr_lx += 2.8

plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
plt.savefig("diagrams/architecture_diagram.png", dpi=200, bbox_inches="tight", pad_inches=0.05)
plt.close()
print("✓ Saved diagrams/architecture_diagram.png")
