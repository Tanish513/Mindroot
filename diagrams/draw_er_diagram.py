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
ROSE = "#DC2626"
BORDER = "#94A3B8"
LINE_COLOR = "#334155"

# Background
bg = patches.Rectangle((0, 0), 19.2, 8.17, facecolor=WHITE, edgecolor="none")
ax.add_patch(bg)

# Helper function to draw an entity table box
def draw_entity(ax, x, y, w, h, entity_name, attrs, header_col=NAVY):
    # Main outer box
    card = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.04,rounding_size=0.1",
                                 facecolor=LIGHT_BG, edgecolor=BORDER, linewidth=2, zorder=2)
    ax.add_patch(card)
    
    # Header bar
    h_height = 0.52
    h_bar = patches.FancyBboxPatch((x, y + h - h_height), w, h_height, boxstyle="round,pad=0.03,rounding_size=0.08",
                                  facecolor=header_col, edgecolor="none", zorder=3)
    ax.add_patch(h_bar)
    ax.text(x + w/2, y + h - h_height/2, entity_name, color=WHITE, fontsize=12.5, fontweight="bold",
            ha="center", va="center", zorder=4)

    # Attributes list
    curr_y = y + h - h_height - 0.28
    for item in attrs:
        key_type, name, data_type = item
        # Key badge
        if key_type == "PK":
            badge_col = DARK_EMERALD
            badge_txt = "PK"
        elif key_type == "FK":
            badge_col = BLUE
            badge_txt = "FK"
        else:
            badge_col = "#E2E8F0"
            badge_txt = "  "
            
        if key_type in ["PK", "FK"]:
            b_rect = patches.FancyBboxPatch((x + 0.15, curr_y - 0.12), 0.42, 0.24,
                                           boxstyle="round,pad=0.02,rounding_size=0.05",
                                           facecolor=badge_col, edgecolor="none", zorder=4)
            ax.add_patch(b_rect)
            ax.text(x + 0.36, curr_y, badge_txt, color=WHITE, fontsize=8.5, fontweight="bold",
                    ha="center", va="center", zorder=5)
        
        # Attribute name & type
        is_bold = key_type in ["PK", "FK"]
        ax.text(x + 0.65, curr_y, name, color=NAVY if is_bold else SLATE, fontsize=10.5,
                fontweight="bold" if is_bold else "normal", va="center", zorder=4)
        ax.text(x + w - 0.15, curr_y, data_type, color="#64748B", fontsize=9.5,
                ha="right", va="center", zorder=4)
        curr_y -= 0.28

# Helper function to draw relationship diamonds with cardinalities
def draw_relation(ax, x, y, name, w=1.5, h=0.6, col=DARK_EMERALD):
    pts = [[x, y + h/2], [x + w/2, y], [x, y - h/2], [x - w/2, y]]
    poly = patches.Polygon(pts, closed=True, facecolor=WHITE, edgecolor=col, linewidth=2, zorder=5)
    ax.add_patch(poly)
    ax.text(x, y, name, color=col, fontsize=10, fontweight="bold", ha="center", va="center", zorder=6)

def draw_connector(ax, p1, p2, card1, card2, rel_name=None, mid_pt=None):
    # Draw line through mid_pt or direct
    if mid_pt:
        ax.plot([p1[0], mid_pt[0]], [p1[1], mid_pt[1]], color=LINE_COLOR, linewidth=2, zorder=3)
        ax.plot([mid_pt[0], p2[0]], [mid_pt[1], p2[1]], color=LINE_COLOR, linewidth=2, zorder=3)
        if rel_name:
            draw_relation(ax, mid_pt[0], mid_pt[1], rel_name)
    else:
        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=LINE_COLOR, linewidth=2, zorder=3)
        if rel_name:
            mx, my = (p1[0] + p2[0])/2, (p1[1] + p2[1])/2
            draw_relation(ax, mx, my, rel_name)
            
    # Cardinality labels (1 or M)
    c1_pill = patches.Circle((p1[0], p1[1]), 0.15, facecolor=NAVY, edgecolor="none", zorder=6)
    ax.add_patch(c1_pill)
    ax.text(p1[0], p1[1], card1, color=WHITE, fontsize=9.5, fontweight="bold", ha="center", va="center", zorder=7)

    c2_pill = patches.Circle((p2[0], p2[1]), 0.15, facecolor=NAVY, edgecolor="none", zorder=6)
    ax.add_patch(c2_pill)
    ax.text(p2[0], p2[1], card2, color=WHITE, fontsize=9.5, fontweight="bold", ha="center", va="center", zorder=7)

# --- 1. ENTITY: USER (CENTER HUB) ---
user_attrs = [
    ("PK", "id", "UUID"),
    ("  ", "email", "VarChar(255)"),
    ("  ", "name", "VarChar(100)"),
    ("  ", "role", "Enum(role)"),
    ("  ", "hourlyRate", "Integer"),
    ("  ", "tokenBalance", "Integer"),
    ("  ", "trustScore", "Decimal(3,2)"),
    ("  ", "createdAt", "DateTime")
]
draw_entity(ax, 7.8, 4.3, 3.6, 3.1, "USER (Master Hub)", user_attrs, header_col=DARK_EMERALD)

# --- 2. ENTITY: USERSKILL (M:N JOIN TABLE) ---
userskill_attrs = [
    ("PK", "id", "UUID"),
    ("FK", "userId", "UUID -> User.id"),
    ("FK", "skillId", "UUID -> Skill.id"),
    ("  ", "type", "Enum(teach/learn)"),
    ("  ", "proficiency", "VarChar(50)")
]
draw_entity(ax, 1.0, 4.5, 3.4, 2.2, "USERSKILL (Join)", userskill_attrs, header_col=SLATE)

# --- 3. ENTITY: SKILL (TAXONOMY) ---
skill_attrs = [
    ("PK", "id", "UUID"),
    ("  ", "name", "VarChar(100)"),
    ("  ", "category", "VarChar(50)"),
    ("  ", "description", "Text")
]
draw_entity(ax, 1.0, 1.2, 3.4, 1.9, "SKILL (Catalog)", skill_attrs, header_col=NAVY)

# --- 4. ENTITY: SESSION (BOOKINGS & CLASSROOMS) ---
session_attrs = [
    ("PK", "id", "UUID"),
    ("FK", "studentId", "UUID -> User.id"),
    ("FK", "teacherId", "UUID -> User.id"),
    ("  ", "title", "VarChar(255)"),
    ("  ", "status", "Enum(status)"),
    ("  ", "scheduledAt", "DateTime"),
    ("  ", "durationMin", "Integer"),
    ("  ", "escrowHold", "Boolean")
]
draw_entity(ax, 14.8, 4.3, 3.6, 3.1, "SESSION (Classroom)", session_attrs, header_col=BLUE)

# --- 5. ENTITY: TRANSACTION (FINANCIAL LEDGER) ---
tx_attrs = [
    ("PK", "id", "UUID"),
    ("FK", "userId", "UUID -> User.id"),
    ("  ", "amount", "Integer (+1/-1)"),
    ("  ", "type", "VarChar(50)"),
    ("  ", "description", "VarChar(255)"),
    ("  ", "createdAt", "DateTime")
]
draw_entity(ax, 5.0, 0.9, 3.4, 2.4, "TRANSACTION (Ledger)", tx_attrs, header_col=DARK_EMERALD)

# --- 6. ENTITY: REVIEW (TRUST & FEEDBACK) ---
review_attrs = [
    ("PK", "id", "UUID"),
    ("FK", "sessionId", "UUID -> Session.id"),
    ("FK", "authorId", "UUID -> User.id"),
    ("FK", "targetId", "UUID -> User.id"),
    ("  ", "rating", "Integer (1-5)"),
    ("  ", "comment", "Text")
]
draw_entity(ax, 14.8, 0.9, 3.6, 2.4, "REVIEW (Trust)", review_attrs, header_col=AMBER)

# --- 7. ENTITY: MESSAGE (DIRECT PEER CHAT) ---
msg_attrs = [
    ("PK", "id", "UUID"),
    ("FK", "senderId", "UUID -> User.id"),
    ("FK", "receiverId", "UUID -> User.id"),
    ("  ", "content", "Text"),
    ("  ", "createdAt", "DateTime")
]
draw_entity(ax, 9.8, 0.9, 3.6, 2.2, "MESSAGE (Chat)", msg_attrs, header_col=SLATE)

# --- RELATIONSHIP CONNECTORS & CARDINALITIES ---
# 1. User (1) <-> (M) UserSkill
draw_connector(ax, (7.8, 5.8), (4.4, 5.8), "1", "M", "Has Profile")

# 2. Skill (1) <-> (M) UserSkill
draw_connector(ax, (2.7, 3.1), (2.7, 4.5), "1", "M", "Classifies")

# 3. User (1) <-> (M) Session [Teacher & Student]
draw_connector(ax, (11.4, 5.8), (14.8, 5.8), "1", "M", "Books / Teaches")

# 4. User (1) <-> (M) Transaction
draw_connector(ax, (8.5, 4.3), (6.7, 3.3), "1", "M", "Audits")

# 5. User (1) <-> (M) Message
draw_connector(ax, (9.6, 4.3), (11.0, 3.1), "1", "M", "Sends")

# 6. Session (1) <-> (M) Review
draw_connector(ax, (16.6, 4.3), (16.6, 3.3), "1", "M", "Evaluates")

# Legend Bar at Top
leg_box = patches.FancyBboxPatch((0.6, 7.62), 18.0, 0.45, boxstyle="round,pad=0.03,rounding_size=0.08",
                                facecolor=LIGHT_BG, edgecolor=BORDER, linewidth=1.2, zorder=2)
ax.add_patch(leg_box)
ax.text(1.0, 7.84, "E-R NOTATION LEGEND:", color=SLATE, fontsize=11, fontweight="bold", va="center", zorder=3)

legends = [
    ("Primary Key (PK)", DARK_EMERALD),
    ("Foreign Key (FK)", BLUE),
    ("Relationship Diamond (1:M)", DARK_EMERALD),
    ("Cardinality Indicators (1, M)", NAVY)
]
curr_lx = 4.6
for l_name, l_col in legends:
    dot = patches.Circle((curr_lx, 7.84), 0.09, facecolor=l_col, edgecolor="none", zorder=3)
    ax.add_patch(dot)
    ax.text(curr_lx + 0.2, 7.84, l_name, color=SLATE, fontsize=10.5, fontweight="semibold", va="center", zorder=3)
    curr_lx += 3.3

plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
plt.savefig("diagrams/er_diagram.png", dpi=200, bbox_inches="tight", pad_inches=0.05)
plt.close()
print("Saved diagrams/er_diagram.png")
