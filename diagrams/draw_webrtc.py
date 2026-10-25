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
LIFELINE_COLOR = "#94A3B8"
LINE_COLOR = "#334155"

bg = patches.Rectangle((0, 0), 19.2, 8.17, facecolor=WHITE, edgecolor="none")
ax.add_patch(bg)

# 4 Lifelines / Columns
actors = [
    ("PEER A: LEARNER\n(React 19 Client)", 2.4, BLUE),
    ("SIGNALING SERVER\n(Node.js / Socket.io)", 7.2, DARK_EMERALD),
    ("STUN / TURN RELAY\n(Google ICE Server)", 12.0, AMBER),
    ("PEER B: MENTOR\n(React 19 Client)", 16.8, SLATE)
]

# Draw Actor Header Boxes and Vertical Lifelines
y_top = 7.1
y_bot = 0.8

for name, x, col in actors:
    # Lifeline dashed vertical line
    ax.plot([x, x], [y_bot, y_top - 0.4], color=LIFELINE_COLOR, linewidth=1.8, linestyle="--", zorder=2)
    
    # Actor Box
    box = patches.FancyBboxPatch((x - 1.6, y_top - 0.4), 3.2, 0.75,
                                boxstyle="round,pad=0.04,rounding_size=0.1",
                                facecolor=col, edgecolor="none", zorder=4)
    ax.add_patch(box)
    ax.text(x, y_top - 0.03, name, color=WHITE, fontsize=11, fontweight="bold", ha="center", va="center", zorder=5)

# Helper function to draw sequence arrows with step numbers
def seq_step(ax, y, x1, x2, step_num, msg, payload=None, col=LINE_COLOR, dashed=False):
    style = "-|>"
    ax.annotate("", xy=(x2, y), xytext=(x1, y),
                arrowprops=dict(arrowstyle=style, color=col, linewidth=2, linestyle="--" if dashed else "-", mutation_scale=14),
                zorder=5)
    
    mid_x = (x1 + x2) / 2
    # Step badge
    circ = patches.Circle((mid_x - len(msg)*0.055 - 0.22, y + 0.16), 0.15, facecolor=col, edgecolor="none", zorder=6)
    ax.add_patch(circ)
    ax.text(mid_x - len(msg)*0.055 - 0.22, y + 0.16, str(step_num), color=WHITE, fontsize=8.5, fontweight="bold", ha="center", va="center", zorder=7)
    
    # Message text
    ax.text(mid_x, y + 0.16, msg, color=NAVY, fontsize=10, fontweight="bold", ha="center", va="center", zorder=6)
    if payload:
        ax.text(mid_x, y - 0.16, payload, color="#64748B", fontsize=8.5, ha="center", va="center", zorder=6)

# --- SEQUENCE STEPS ---
# 1. Join Room
seq_step(ax, 6.1, 2.4, 7.2, 1, "join-room (sessionId, authJwt)", "Student enters scheduled classroom", BLUE)

# 2. Peer B Joins Room
seq_step(ax, 5.6, 16.8, 7.2, 2, "join-room (sessionId, authJwt)", "Mentor enters classroom & connects", SLATE)

# 3. Query STUN/TURN
seq_step(ax, 5.1, 2.4, 12.0, 3, "STUN Binding Request (UDP 19302)", "Discover public reflexive NAT address", AMBER)
seq_step(ax, 4.6, 12.0, 2.4, 4, "STUN Binding Success Response", "Public IP:Port mapped for Peer A", AMBER, dashed=True)

# 5. Peer A generates SDP Offer -> Signaling Server
seq_step(ax, 4.1, 2.4, 7.2, 5, "sdp-offer (Local Codecs / SRTP)", "Relayed via WebSocket Signaling", DARK_EMERALD)

# 6. Signaling Server forwards SDP Offer -> Peer B
seq_step(ax, 3.6, 7.2, 16.8, 6, "sdp-offer relayed to Mentor", "Set remote description & initialize audio/video", DARK_EMERALD)

# 7. Peer B creates SDP Answer -> Signaling Server
seq_step(ax, 3.1, 16.8, 7.2, 7, "sdp-answer (Compatible Codecs)", "Mentor acknowledges session capabilities", SLATE)

# 8. Signaling Server forwards SDP Answer -> Peer A
seq_step(ax, 2.6, 7.2, 2.4, 8, "sdp-answer relayed to Student", "Set remote description on Peer A", DARK_EMERALD)

# 9. Trickle ICE Exchange
seq_step(ax, 2.1, 2.4, 16.8, 9, "trickle-ice-candidates (Bi-directional)", "P2P Network Candidate Connectivity Checks", AMBER, dashed=True)

# 10. Direct P2P Media Connection Box (DTLS / SRTP)
p2p_box = patches.FancyBboxPatch((2.2, 1.15), 14.8, 0.45, boxstyle="round,pad=0.03,rounding_size=0.1",
                                facecolor="#ECFDF5", edgecolor=DARK_EMERALD, linewidth=2.5, zorder=6)
ax.add_patch(p2p_box)
ax.text(9.6, 1.37, "10. DIRECT P2P MEDIA CONNECTION ESTABLISHED (WebRTC DTLS / SRTP Audio & Video Channels)",
        color=DARK_EMERALD, fontsize=11, fontweight="bold", ha="center", va="center", zorder=7)

# 11. RTCDataChannel Box (Whiteboard & Code)
dc_box = patches.FancyBboxPatch((2.2, 0.6), 14.8, 0.45, boxstyle="round,pad=0.03,rounding_size=0.1",
                               facecolor="#EFF6FF", edgecolor=BLUE, linewidth=2.5, zorder=6)
ax.add_patch(dc_box)
ax.text(9.6, 0.82, "11. SUB-SECOND RTCDataChannel SYNCHRONIZATION (Real-Time Collaborative Whiteboard & Code Editor)",
        color=BLUE, fontsize=11, fontweight="bold", ha="center", va="center", zorder=7)

# Legend Bar at Top
leg_box = patches.FancyBboxPatch((0.6, 7.62), 18.0, 0.45, boxstyle="round,pad=0.03,rounding_size=0.08",
                                facecolor=LIGHT_BG, edgecolor=BORDER, linewidth=1.2, zorder=2)
ax.add_patch(leg_box)
ax.text(1.0, 7.84, "WEBRTC SEQUENCE LEGEND:", color=SLATE, fontsize=11, fontweight="bold", va="center", zorder=3)

legends = [
    ("WebSocket Signaling Message", DARK_EMERALD),
    ("STUN / NAT Traversal Query", AMBER),
    ("Direct P2P Media Stream (SRTP)", DARK_EMERALD),
    ("RTCDataChannel Workspace Sync", BLUE)
]
curr_lx = 4.8
for l_name, l_col in legends:
    dot = patches.Circle((curr_lx, 7.84), 0.09, facecolor=l_col, edgecolor="none", zorder=3)
    ax.add_patch(dot)
    ax.text(curr_lx + 0.2, 7.84, l_name, color=SLATE, fontsize=10.5, fontweight="semibold", va="center", zorder=3)
    curr_lx += 3.3

plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
plt.savefig("diagrams/webrtc_diagram.png", dpi=200, bbox_inches="tight", pad_inches=0.05)
plt.close()
print("Saved diagrams/webrtc_diagram.png")
