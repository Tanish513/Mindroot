import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Ensure diagrams directory exists
os.makedirs("diagrams", exist_ok=True)

plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Arial', 'Segoe UI']

def draw_er_diagram():
    fig, ax = plt.subplots(figsize=(14, 9), dpi=200)
    ax.set_facecolor('#F8FAFC')
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 9)
    ax.axis('off')

    # Styles
    ENTITY_STYLE = dict(boxstyle="square,pad=0.3", fc="#0284C7", ec="#0369A1", lw=2)
    REL_STYLE = dict(boxstyle="darrow,pad=0.1", fc="#10B981", ec="#059669", lw=1.5) # Diamond
    ATTR_STYLE = dict(boxstyle="circle,pad=0.2", fc="#F1F5F9", ec="#64748B", lw=1.2)
    PK_ATTR_STYLE = dict(boxstyle="circle,pad=0.2", fc="#FEF3C7", ec="#D97706", lw=1.5)

    def draw_diamond(x, y, w, h, text):
        diamond = patches.Polygon([[x, y+h/2], [x+w/2, y+h], [x+w, y+h/2], [x+w/2, y]], 
                                  closed=True, fc="#10B981", ec="#047857", lw=1.5)
        ax.add_patch(diamond)
        ax.text(x+w/2, y+h/2, text, ha='center', va='center', fontsize=9, fontweight='bold', color='white')

    def draw_entity(x, y, w, h, text):
        rect = patches.Rectangle((x, y), w, h, fc="#0284C7", ec="#0369A1", lw=2)
        ax.add_patch(rect)
        ax.text(x+w/2, y+h/2, text, ha='center', va='center', fontsize=11, fontweight='bold', color='white')

    def draw_attribute(x, y, w, h, text, is_pk=False):
        ellipse = patches.Ellipse((x, y), w, h, fc="#FEF3C7" if is_pk else "#FFFFFF", 
                                  ec="#D97706" if is_pk else "#64748B", lw=1.5)
        ax.add_patch(ellipse)
        ax.text(x, y, text, ha='center', va='center', fontsize=8, 
                fontweight='bold' if is_pk else 'normal', color="#0F172A")

    # Connectors
    def connect(p1, p2, text=None, text_pos=None):
        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color='#64748B', lw=1.4, zorder=1)
        if text and text_pos:
            ax.text(text_pos[0], text_pos[1], text, fontsize=9, fontweight='bold', color='#DC2626')

    # Entities
    draw_entity(1.5, 5.0, 2.0, 1.0, "USER")
    draw_entity(6.0, 5.0, 2.0, 1.0, "SESSION")
    draw_entity(10.5, 5.0, 2.0, 1.0, "SKILL")
    draw_entity(1.5, 1.5, 2.0, 1.0, "TRANSACTION")
    draw_entity(6.0, 1.5, 2.0, 1.0, "REVIEW")

    # Relationship Diamonds
    draw_diamond(4.0, 5.2, 1.5, 0.6, "Attends")
    draw_diamond(8.5, 5.2, 1.5, 0.6, "Teaches")
    draw_diamond(1.75, 3.25, 1.5, 0.6, "Executes")
    draw_diamond(6.25, 3.25, 1.5, 0.6, "Has")

    # Lines between Entities & Relationships with Cardinalities
    connect((3.5, 5.5), (4.0, 5.5), "1", (3.7, 5.65))
    connect((5.5, 5.5), (6.0, 5.5), "M", (5.7, 5.65))

    connect((8.0, 5.5), (8.5, 5.5), "M", (8.2, 5.65))
    connect((10.0, 5.5), (10.5, 5.5), "1", (10.2, 5.65))

    connect((2.5, 5.0), (2.5, 3.85), "1", (2.65, 4.5))
    connect((2.5, 3.25), (2.5, 2.5), "M", (2.65, 2.8))

    connect((7.0, 5.0), (7.0, 3.85), "1", (7.15, 4.5))
    connect((7.0, 3.25), (7.0, 2.5), "1", (7.15, 2.8))

    # Attributes of USER
    u_attrs = [
        (0.6, 7.0, "id (PK)", True), (1.8, 7.3, "name", False), (3.0, 7.0, "email", False),
        (0.5, 5.5, "role", False), (0.6, 4.0, "tokenBal", False), (2.5, 7.6, "trustScore", False)
    ]
    for x, y, name, pk in u_attrs:
        draw_attribute(x, y, 1.1, 0.5, name, pk)
        connect((x, y), (2.5, 6.0))

    # Attributes of SESSION
    s_attrs = [
        (5.5, 7.2, "id (PK)", True), (7.0, 7.4, "title", False), (8.5, 7.2, "status", False),
        (6.0, 6.4, "scheduledAt", False), (8.0, 6.4, "duration", False)
    ]
    for x, y, name, pk in s_attrs:
        draw_attribute(x, y, 1.3, 0.5, name, pk)
        connect((x, y), (7.0, 6.0))

    # Attributes of SKILL
    sk_attrs = [
        (11.0, 7.2, "id (PK)", True), (12.5, 7.0, "name", False), (12.5, 5.5, "category", False)
    ]
    for x, y, name, pk in sk_attrs:
        draw_attribute(x, y, 1.2, 0.5, name, pk)
        connect((x, y), (11.5, 6.0))

    # Attributes of TRANSACTION
    t_attrs = [
        (0.6, 2.0, "id (PK)", True), (0.6, 1.0, "amount", False), (2.5, 0.6, "type", False), (3.5, 0.9, "createdAt", False)
    ]
    for x, y, name, pk in t_attrs:
        draw_attribute(x, y, 1.2, 0.5, name, pk)
        connect((x, y), (2.5, 1.5))

    # Attributes of REVIEW
    r_attrs = [
        (5.2, 0.6, "id (PK)", True), (7.0, 0.6, "rating", False), (8.8, 0.8, "comment", False)
    ]
    for x, y, name, pk in r_attrs:
        draw_attribute(x, y, 1.2, 0.5, name, pk)
        connect((x, y), (7.0, 1.5))

    # Legend / Title
    ax.text(7.0, 8.5, "ENTITY-RELATIONSHIP (E-R) DIAGRAM", ha='center', va='center', 
            fontsize=15, fontweight='bold', color='#0F172A')
    ax.text(7.0, 8.1, "Mindroot Peer-to-Peer Skill Exchange Platform", ha='center', va='center', 
            fontsize=10, color='#64748B')

    plt.tight_layout()
    plt.savefig("diagrams/er_diagram.png", bbox_inches='tight')
    plt.close()
    print("ER Diagram generated.")

def draw_system_flowchart():
    fig, ax = plt.subplots(figsize=(14, 8.5), dpi=200)
    ax.set_facecolor('#F8FAFC')
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8.5)
    ax.axis('off')

    def draw_oval(x, y, w, h, text, color="#059669"):
        oval = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.2,rounding_size=0.3", 
                                      fc=color, ec="#047857", lw=1.5)
        ax.add_patch(oval)
        ax.text(x+w/2, y+h/2, text, ha='center', va='center', fontsize=9, fontweight='bold', color='white')

    def draw_box(x, y, w, h, text, color="#0284C7"):
        rect = patches.Rectangle((x, y), w, h, fc=color, ec="#0369A1", lw=1.5)
        ax.add_patch(rect)
        ax.text(x+w/2, y+h/2, text, ha='center', va='center', fontsize=8.5, fontweight='bold', color='white')

    def draw_diamond(x, y, w, h, text, color="#F59E0B"):
        diamond = patches.Polygon([[x, y+h/2], [x+w/2, y+h], [x+w, y+h/2], [x+w/2, y]], 
                                  closed=True, fc=color, ec="#D97706", lw=1.5)
        ax.add_patch(diamond)
        ax.text(x+w/2, y+h/2, text, ha='center', va='center', fontsize=8, fontweight='bold', color='white')

    def draw_arrow(p1, p2, text=None):
        ax.annotate("", xy=p2, xytext=p1, arrowprops=dict(arrowstyle="->", color="#334155", lw=1.5))
        if text:
            mid = ((p1[0]+p2[0])/2, (p1[1]+p2[1])/2)
            ax.text(mid[0]+0.15, mid[1]+0.05, text, fontsize=8, fontweight='bold', color="#DC2626")

    # Start
    draw_oval(0.8, 7.4, 1.4, 0.6, "START")
    draw_box(0.6, 6.2, 1.8, 0.7, "Enter Username\n& Password")
    draw_arrow((1.5, 7.4), (1.5, 6.9))

    # Decisions Column 1
    draw_diamond(0.6, 4.8, 1.8, 0.9, "Is Admin?")
    draw_arrow((1.5, 6.2), (1.5, 5.7))

    draw_diamond(0.6, 3.4, 1.8, 0.9, "Is User?")
    draw_arrow((1.5, 4.8), (1.5, 4.3), "No")

    draw_diamond(0.6, 2.0, 1.8, 0.9, "Is Visitor?")
    draw_arrow((1.5, 3.4), (1.5, 2.9), "No")

    # Decisions Column 2
    draw_diamond(3.4, 4.8, 1.8, 0.9, "Is Valid?")
    draw_arrow((2.4, 5.25), (3.4, 5.25), "Yes")

    draw_diamond(3.4, 3.4, 1.8, 0.9, "Is Valid?")
    draw_arrow((2.4, 3.85), (3.4, 3.85), "Yes")

    draw_box(3.4, 2.1, 1.8, 0.7, "Explore Platform\n& Skill Catalog")
    draw_arrow((2.4, 2.45), (3.4, 2.45), "Yes")

    # Connectors A, B, C
    draw_oval(5.8, 5.0, 0.7, 0.5, "A", color="#6366F1")
    draw_arrow((5.2, 5.25), (5.8, 5.25), "Yes")

    draw_oval(5.8, 3.6, 0.7, 0.5, "B", color="#6366F1")
    draw_arrow((5.2, 3.85), (5.8, 3.85), "Yes")

    draw_oval(5.8, 2.2, 0.7, 0.5, "C", color="#6366F1")
    draw_arrow((5.2, 2.45), (5.8, 2.45))

    # Admin Module Operations (From A)
    draw_box(7.2, 6.4, 1.8, 0.6, "Manage Users")
    draw_box(7.2, 5.6, 1.8, 0.6, "Manage Skills")
    draw_box(7.2, 4.8, 1.8, 0.6, "Audit Tokens")

    # Student / Peer Module Operations (From B)
    draw_box(9.6, 6.4, 1.8, 0.6, "Profile & Skills")
    draw_box(9.6, 5.6, 1.8, 0.6, "Match & Book")
    draw_box(9.6, 4.8, 1.8, 0.6, "Live WebRTC Room")
    draw_box(9.6, 4.0, 1.8, 0.6, "Submit Review")

    # Connecting A & B to actions
    draw_arrow((6.5, 5.25), (7.2, 5.9))
    draw_arrow((6.5, 3.85), (9.6, 5.2))

    # End
    draw_box(11.8, 5.2, 1.5, 0.6, "Log Out")
    draw_oval(11.8, 3.8, 1.5, 0.6, "END", color="#DC2626")

    draw_arrow((9.0, 5.6), (11.8, 5.5))
    draw_arrow((11.4, 5.6), (11.8, 5.5))
    draw_arrow((12.55, 5.2), (12.55, 4.4))

    ax.text(7.0, 8.0, "MINDROOT SYSTEM FLOW CHART", ha='center', va='center', 
            fontsize=15, fontweight='bold', color='#0F172A')

    plt.tight_layout()
    plt.savefig("diagrams/system_flowchart.png", bbox_inches='tight')
    plt.close()
    print("System Flowchart generated.")

def draw_dfd_context():
    fig, ax = plt.subplots(figsize=(14, 8), dpi=200)
    ax.set_facecolor('#F8FAFC')
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8)
    ax.axis('off')

    # Central Bubble (Process 0.0)
    bubble = patches.Circle((7.0, 4.0), 1.8, fc="#10B981", ec="#047857", lw=2.5)
    ax.add_patch(bubble)
    ax.text(7.0, 4.3, "MINDROOT\nSYSTEM", ha='center', va='center', fontsize=12, fontweight='bold', color='white')
    ax.text(7.0, 3.4, "0.0", ha='center', va='center', fontsize=11, fontweight='bold', color='#FEF3C7')

    # External Entities
    def draw_entity_box(x, y, w, h, text):
        rect = patches.Rectangle((x, y), w, h, fc="#0284C7", ec="#0369A1", lw=2)
        ax.add_patch(rect)
        ax.text(x+w/2, y+h/2, text, ha='center', va='center', fontsize=11, fontweight='bold', color='white')

    draw_entity_box(0.8, 5.0, 2.2, 1.2, "STUDENT /\nLEARNER")
    draw_entity_box(0.8, 1.8, 2.2, 1.2, "TEACHER /\nMENTOR")
    draw_entity_box(11.0, 5.0, 2.2, 1.2, "ADMINISTRATOR")
    draw_entity_box(11.0, 1.8, 2.2, 1.2, "VISITOR")

    def draw_flow(p1, p2, label, offset_y=0.15):
        ax.annotate("", xy=p2, xytext=p1, arrowprops=dict(arrowstyle="->", color="#334155", lw=1.3))
        mid = ((p1[0]+p2[0])/2, (p1[1]+p2[1])/2 + offset_y)
        ax.text(mid[0], mid[1], label, ha='center', va='center', fontsize=7.5, color="#0F172A", 
                bbox=dict(boxstyle="square,pad=0.1", fc="#FFFFFF", ec="none", alpha=0.85))

    # Student flows
    draw_flow((3.0, 5.8), (5.5, 4.8), "Request: Match, Book Session, Escrow Token", 0.2)
    draw_flow((5.5, 4.5), (3.0, 5.4), "Response: Session Link, WebRTC Stream, .ics Calendar", -0.2)

    # Teacher flows
    draw_flow((3.0, 2.6), (5.5, 3.4), "Request: Register Skills, Confirm Session", 0.2)
    draw_flow((5.5, 3.1), (3.0, 2.2), "Response: Student Booking, Token Payout (+1)", -0.2)

    # Admin flows
    draw_flow((11.0, 5.8), (8.5, 4.8), "Request: Manage Users, Skills, Resolve Disputes", 0.2)
    draw_flow((8.5, 4.5), (11.0, 5.4), "Response: System Telemetry, Audit Logs", -0.2)

    # Visitor flows
    draw_flow((11.0, 2.6), (8.5, 3.4), "Request: Browse Public Skills & Tutor Profiles", 0.2)
    draw_flow((8.5, 3.1), (11.0, 2.2), "Response: Platform Catalog & Registration Prompt", -0.2)

    ax.text(7.0, 7.5, "DATA FLOW DIAGRAM — CONTEXT LEVEL (LEVEL 0)", ha='center', va='center', 
            fontsize=15, fontweight='bold', color='#0F172A')

    plt.tight_layout()
    plt.savefig("diagrams/dfd_level_0.png", bbox_inches='tight')
    plt.close()
    print("DFD Level 0 generated.")

def draw_dfd_user_level1():
    fig, ax = plt.subplots(figsize=(14, 8.5), dpi=200)
    ax.set_facecolor('#F8FAFC')
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8.5)
    ax.axis('off')

    # Top Entity
    rect = patches.Rectangle((5.8, 7.2), 2.4, 0.8, fc="#0284C7", ec="#0369A1", lw=2)
    ax.add_patch(rect)
    ax.text(7.0, 7.6, "USER (PEER)", ha='center', va='center', fontsize=11, fontweight='bold', color='white')

    # Processes (Circles)
    procs = [
        (1.5, 4.8, "1.0\nLogin & Auth"),
        (3.8, 4.8, "2.0\nManage Profile\n& Skills"),
        (6.1, 4.8, "3.0\nPeer Matching\n& Search"),
        (8.4, 4.8, "4.0\nBook Session\n& Escrow"),
        (10.7, 4.8, "5.0\nLive WebRTC\nClassroom"),
        (12.5, 4.8, "6.0\nSubmit\nReview")
    ]
    for x, y, title in procs:
        circle = patches.Circle((x, y), 0.75, fc="#10B981", ec="#047857", lw=1.8)
        ax.add_patch(circle)
        ax.text(x, y, title, ha='center', va='center', fontsize=7.5, fontweight='bold', color='white')
        # Arrow from User to Process
        ax.annotate("", xy=(x, y+0.75), xytext=(7.0, 7.2), 
                    arrowprops=dict(arrowstyle="->", color="#94A3B8", lw=1.1))

    # Data Stores (Open Rectangles)
    stores = [
        (1.5, 1.8, "User_Store"),
        (4.5, 1.8, "Skill_Store"),
        (7.5, 1.8, "Session_Store"),
        (10.5, 1.8, "Ledger_Store"),
        (12.5, 1.8, "Review_Store")
    ]
    for x, y, name in stores:
        # Open rectangle lines
        ax.plot([x-0.8, x+0.8], [y+0.3, y+0.3], color="#0F172A", lw=2)
        ax.plot([x-0.8, x+0.8], [y-0.3, y-0.3], color="#0F172A", lw=2)
        ax.plot([x-0.8, x-0.8], [y-0.3, y+0.3], color="#0F172A", lw=2)
        ax.text(x, y, name, ha='center', va='center', fontsize=8, fontweight='bold', color="#0F172A")

    # Connect Processes to Data Stores
    ax.annotate("", xy=(1.5, 2.1), xytext=(1.5, 4.05), arrowprops=dict(arrowstyle="<->", color="#334155", lw=1.3))
    ax.annotate("", xy=(4.5, 2.1), xytext=(3.8, 4.05), arrowprops=dict(arrowstyle="<->", color="#334155", lw=1.3))
    ax.annotate("", xy=(7.5, 2.1), xytext=(8.4, 4.05), arrowprops=dict(arrowstyle="<->", color="#334155", lw=1.3))
    ax.annotate("", xy=(10.5, 2.1), xytext=(8.4, 4.05), arrowprops=dict(arrowstyle="<->", color="#334155", lw=1.3))
    ax.annotate("", xy=(12.5, 2.1), xytext=(12.5, 4.05), arrowprops=dict(arrowstyle="<->", color="#334155", lw=1.3))

    ax.text(7.0, 8.2, "DATA FLOW DIAGRAM — LEVEL 1 (USER PERSPECTIVE)", ha='center', va='center', 
            fontsize=15, fontweight='bold', color='#0F172A')

    plt.tight_layout()
    plt.savefig("diagrams/dfd_user_level1.png", bbox_inches='tight')
    plt.close()
    print("DFD User Level 1 generated.")

def draw_dfd_admin_level1():
    fig, ax = plt.subplots(figsize=(14, 8.5), dpi=200)
    ax.set_facecolor('#F8FAFC')
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8.5)
    ax.axis('off')

    # Top Entity
    rect = patches.Rectangle((5.8, 7.2), 2.4, 0.8, fc="#0284C7", ec="#0369A1", lw=2)
    ax.add_patch(rect)
    ax.text(7.0, 7.6, "ADMINISTRATOR", ha='center', va='center', fontsize=11, fontweight='bold', color='white')

    # Processes (Circles)
    procs = [
        (1.8, 4.8, "1.0\nAdmin Auth"),
        (4.2, 4.8, "2.0\nManage Users\n& Moderation"),
        (6.6, 4.8, "3.0\nCurate Skill\nCategories"),
        (9.0, 4.8, "4.0\nDispute &\nEscrow Arbitration"),
        (11.4, 4.8, "5.0\nAudit System\nTelemetry")
    ]
    for x, y, title in procs:
        circle = patches.Circle((x, y), 0.85, fc="#0284C7", ec="#0369A1", lw=1.8)
        ax.add_patch(circle)
        ax.text(x, y, title, ha='center', va='center', fontsize=8, fontweight='bold', color='white')
        ax.annotate("", xy=(x, y+0.85), xytext=(7.0, 7.2), 
                    arrowprops=dict(arrowstyle="->", color="#94A3B8", lw=1.1))

    # Data Stores (Open Rectangles)
    stores = [
        (1.8, 1.8, "Admin_Auth"),
        (4.2, 1.8, "Users_Store"),
        (6.6, 1.8, "Skills_Store"),
        (9.0, 1.8, "Disputes_Store"),
        (11.4, 1.8, "Audit_Logs")
    ]
    for x, y, name in stores:
        ax.plot([x-0.8, x+0.8], [y+0.3, y+0.3], color="#0F172A", lw=2)
        ax.plot([x-0.8, x+0.8], [y-0.3, y-0.3], color="#0F172A", lw=2)
        ax.plot([x-0.8, x-0.8], [y-0.3, y+0.3], color="#0F172A", lw=2)
        ax.text(x, y, name, ha='center', va='center', fontsize=8, fontweight='bold', color="#0F172A")

    # Connect Processes to Data Stores
    for i in range(5):
        px = procs[i][0]
        sx = stores[i][0]
        ax.annotate("", xy=(sx, 2.1), xytext=(px, 3.95), arrowprops=dict(arrowstyle="<->", color="#334155", lw=1.3))

    ax.text(7.0, 8.2, "DATA FLOW DIAGRAM — LEVEL 1 (ADMIN PERSPECTIVE)", ha='center', va='center', 
            fontsize=15, fontweight='bold', color='#0F172A')

    plt.tight_layout()
    plt.savefig("diagrams/dfd_admin_level1.png", bbox_inches='tight')
    plt.close()
    print("DFD Admin Level 1 generated.")

def draw_analytics_graphs():
    # 2-panel graph: Skill Categories & Token Velocity
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6.5), dpi=200)
    fig.patch.set_facecolor('#F8FAFC')
    ax1.set_facecolor('#FFFFFF')
    ax2.set_facecolor('#FFFFFF')

    # Graph 1: Popular Skill Categories
    categories = ['Software & AI', 'UI/UX Design', 'Web Dev', 'Languages', 'Cloud & DevOps', 'Math & CS']
    counts = [42, 28, 38, 22, 19, 25]
    colors = ['#10B981', '#0EA5E9', '#6366F1', '#F59E0B', '#EC4899', '#8B5CF6']
    bars = ax1.bar(categories, counts, color=colors, edgecolor='#E2E8F0', lw=1.5, width=0.6)
    ax1.set_title("Skill Categories in Circulation", fontsize=12, fontweight='bold', color='#0F172A', pad=12)
    ax1.set_ylabel("Registered Modules", fontsize=10, fontweight='bold', color='#475569')
    ax1.tick_params(axis='x', rotation=30)
    for bar in bars:
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height + 0.8, f'{int(height)}',
                 ha='center', va='bottom', fontsize=9, fontweight='bold', color='#1E293B')

    # Graph 2: Token Circulation Distribution
    labels = ['Minted Bonus (40%)', 'Completed Sessions (35%)', 'In Active Escrow (15%)', 'Refunded (10%)']
    sizes = [40, 35, 15, 10]
    pie_colors = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444']
    wedges, texts, autotexts = ax2.pie(sizes, labels=labels, autopct='%1.0f%%', startangle=140, 
                                       colors=pie_colors, textprops=dict(color="#1E293B", fontsize=9))
    for at in autotexts:
        at.set_color('white')
        at.set_fontweight('bold')
    ax2.set_title("Skill Token Ledger Velocity", fontsize=12, fontweight='bold', color='#0F172A', pad=12)

    plt.tight_layout()
    plt.savefig("diagrams/analytics_graphs.png", bbox_inches='tight')
    plt.close()
    print("Analytics Graphs generated.")

def draw_dfd_symbols():
    fig, ax = plt.subplots(figsize=(14, 6.5), dpi=200)
    ax.set_facecolor('#F8FAFC')
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 6.5)
    ax.axis('off')

    # Title
    ax.text(7.0, 5.8, "SYMBOLS OF DATA FLOW DIAGRAM (DFD)", ha='center', va='center', 
            fontsize=15, fontweight='bold', color='#0F172A')

    # Symbol 1: Data Flow
    ax.text(1.8, 4.4, "1. Data Flow", ha='center', va='center', fontsize=11, fontweight='bold', color="#0F172A")
    ax.annotate("", xy=(2.7, 3.4), xytext=(0.9, 3.4), arrowprops=dict(arrowstyle="->", color="#0284C7", lw=3.0))
    ax.text(1.8, 2.5, "Indicates data packet\ntransmission between\nentities & processes", ha='center', va='center', fontsize=8.5, color="#475569")

    # Symbol 2: Process
    ax.text(5.2, 4.4, "2. Process", ha='center', va='center', fontsize=11, fontweight='bold', color="#0F172A")
    circle = patches.Circle((5.2, 3.4), 0.7, fc="#10B981", ec="#047857", lw=2)
    ax.add_patch(circle)
    ax.text(5.2, 3.4, "Process\n1.0", ha='center', va='center', fontsize=9, fontweight='bold', color="white")
    ax.text(5.2, 2.5, "Performs automated\ncomputations, escrow\n& transformations", ha='center', va='center', fontsize=8.5, color="#475569")

    # Symbol 3: Entity
    ax.text(8.8, 4.4, "3. External Entity", ha='center', va='center', fontsize=11, fontweight='bold', color="#0F172A")
    rect = patches.Rectangle((7.8, 2.9), 2.0, 1.0, fc="#0284C7", ec="#0369A1", lw=2)
    ax.add_patch(rect)
    ax.text(8.8, 3.4, "ENTITY", ha='center', va='center', fontsize=10, fontweight='bold', color="white")
    ax.text(8.8, 2.5, "External source or sink\n(User, Admin, Google SSO)", ha='center', va='center', fontsize=8.5, color="#475569")

    # Symbol 4: Data Store
    ax.text(12.2, 4.4, "4. Data Store", ha='center', va='center', fontsize=11, fontweight='bold', color="#0F172A")
    ax.plot([11.2, 13.2], [3.8, 3.8], color="#0F172A", lw=2.5)
    ax.plot([11.2, 13.2], [3.0, 3.0], color="#0F172A", lw=2.5)
    ax.plot([11.2, 11.2], [3.0, 3.8], color="#0F172A", lw=2.5)
    ax.text(12.2, 3.4, "Data_Store", ha='center', va='center', fontsize=9, fontweight='bold', color="#0F172A")
    ax.text(12.2, 2.5, "Persistent tables & repos\n(Users, Sessions, Ledger)", ha='center', va='center', fontsize=8.5, color="#475569")

    plt.tight_layout()
    plt.savefig("diagrams/dfd_symbols.png", bbox_inches='tight')
    plt.close()
    print("DFD Symbols generated.")

def draw_webrtc_diagram():
    fig, ax = plt.subplots(figsize=(14, 7), dpi=200)
    ax.set_facecolor('#F8FAFC')
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Student Peer
    s_rect = patches.FancyBboxPatch((0.8, 2.2), 2.6, 2.6, boxstyle="round,pad=0.2,rounding_size=0.2", fc="#0284C7", ec="#0369A1", lw=2)
    ax.add_patch(s_rect)
    ax.text(2.1, 4.0, "PEER A (STUDENT)", ha='center', va='center', fontsize=10, fontweight='bold', color='white')
    ax.text(2.1, 3.3, "• React 19 Client\n• WebRTC SimplePeer\n• Whiteboard Canvas\n• Live Code Editor", ha='center', va='center', fontsize=8, color='#E0F2FE')

    # Teacher Peer
    t_rect = patches.FancyBboxPatch((10.6, 2.2), 2.6, 2.6, boxstyle="round,pad=0.2,rounding_size=0.2", fc="#0284C7", ec="#0369A1", lw=2)
    ax.add_patch(t_rect)
    ax.text(11.9, 4.0, "PEER B (MENTOR)", ha='center', va='center', fontsize=10, fontweight='bold', color='white')
    ax.text(11.9, 3.3, "• React 19 Client\n• WebRTC SimplePeer\n• Whiteboard Canvas\n• Live Code Editor", ha='center', va='center', fontsize=8, color='#E0F2FE')

    # Signaling Server (Top)
    sig_rect = patches.FancyBboxPatch((5.0, 4.6), 4.0, 1.8, boxstyle="round,pad=0.2,rounding_size=0.2", fc="#10B981", ec="#047857", lw=2)
    ax.add_patch(sig_rect)
    ax.text(7.0, 5.8, "SIGNALING SERVER", ha='center', va='center', fontsize=11, fontweight='bold', color='white')
    ax.text(7.0, 5.1, "• Node.js Express + Socket.io\n• Relays SDP Offer & Answer\n• Scoped Rooms (session:<id>)", ha='center', va='center', fontsize=8.5, color='#DCFCE7')

    # STUN / TURN Server (Bottom)
    ice_rect = patches.FancyBboxPatch((5.0, 0.6), 4.0, 1.6, boxstyle="round,pad=0.2,rounding_size=0.2", fc="#6366F1", ec="#4F46E5", lw=2)
    ax.add_patch(ice_rect)
    ax.text(7.0, 1.6, "STUN / TURN NAT ENGINE", ha='center', va='center', fontsize=10, fontweight='bold', color='white')
    ax.text(7.0, 1.0, "• Google Public STUN Discovery\n• TURN Media Relay Fallback", ha='center', va='center', fontsize=8, color='#E0E7FF')

    # Arrows for Signaling
    ax.annotate("", xy=(5.0, 5.2), xytext=(3.4, 4.4), arrowprops=dict(arrowstyle="<->", color="#059669", lw=2, linestyle="dashed"))
    ax.text(4.0, 5.0, "SDP Offer / ICE", fontsize=7.5, fontweight='bold', color="#059669")

    ax.annotate("", xy=(9.0, 5.2), xytext=(10.6, 4.4), arrowprops=dict(arrowstyle="<->", color="#059669", lw=2, linestyle="dashed"))
    ax.text(9.3, 5.0, "SDP Answer / ICE", fontsize=7.5, fontweight='bold', color="#059669")

    # Direct P2P Media Stream (Center Horizontal)
    ax.annotate("", xy=(10.6, 3.2), xytext=(3.4, 3.2), arrowprops=dict(arrowstyle="<->", color="#DC2626", lw=3.5))
    ax.text(7.0, 3.6, "DIRECT ENCRYPTED P2P MEDIA (DTLS / SRTP)", ha='center', va='center', 
            fontsize=9.5, fontweight='bold', color="#DC2626", bbox=dict(boxstyle="round,pad=0.2", fc="#FEF2F2", ec="#F87171"))
    ax.text(7.0, 2.7, "Ultra-Low Latency Audio, 720p HD Video & Whiteboard DataChannel", ha='center', va='center', 
            fontsize=8, color="#475569")

    # STUN connections
    ax.annotate("", xy=(5.0, 1.5), xytext=(3.2, 2.2), arrowprops=dict(arrowstyle="->", color="#6366F1", lw=1.2, linestyle="dotted"))
    ax.annotate("", xy=(9.0, 1.5), xytext=(10.8, 2.2), arrowprops=dict(arrowstyle="->", color="#6366F1", lw=1.2, linestyle="dotted"))

    ax.text(7.0, 6.7, "WEBRTC REAL-TIME P2P SIGNALING & MEDIA FLOW ARCHITECTURE", ha='center', va='center', 
            fontsize=14, fontweight='bold', color='#0F172A')

    plt.tight_layout()
    plt.savefig("diagrams/webrtc_diagram.png", bbox_inches='tight')
    plt.close()
    print("WebRTC Diagram generated.")

def draw_architecture_diagram():
    fig, ax = plt.subplots(figsize=(14, 7.5), dpi=200)
    ax.set_facecolor('#F8FAFC')
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 7.5)
    ax.axis('off')

    # Container 1: Client Layer (Left)
    c_box = patches.FancyBboxPatch((0.6, 0.8), 3.8, 6.0, boxstyle="round,pad=0.2,rounding_size=0.2", 
                                  fc="#F0FDF4", ec="#10B981", lw=2)
    ax.add_patch(c_box)
    ax.text(2.5, 6.4, "TIER 1: CLIENT FRONTEND", ha='center', va='center', fontsize=11, fontweight='bold', color='#065F46')
    ax.text(2.5, 6.0, "(React 19 + TypeScript + Vite)", ha='center', va='center', fontsize=8.5, color='#047857')

    client_nodes = [
        (2.5, 5.2, "UI Pages & Router\n(Dashboard, LiveRoom, Schedule)"),
        (2.5, 4.0, "State & Env Auto-Detect\n(Zustand Stores, LAN Discovery)"),
        (2.5, 2.8, "API & Socket Client\n(REST API Client, Socket.io)"),
        (2.5, 1.6, "WebRTC Video Engine\n(SimplePeer, MediaStream APIs)")
    ]
    for x, y, label in client_nodes:
        n_box = patches.FancyBboxPatch((x-1.6, y-0.45), 3.2, 0.9, boxstyle="round,pad=0.1,rounding_size=0.15", 
                                       fc="#FFFFFF", ec="#10B981", lw=1.5)
        ax.add_patch(n_box)
        ax.text(x, y, label, ha='center', va='center', fontsize=8.5, fontweight='bold', color='#1E293B')

    # Container 2: Server Layer (Middle)
    s_box = patches.FancyBboxPatch((4.9, 0.8), 4.2, 6.0, boxstyle="round,pad=0.2,rounding_size=0.2", 
                                  fc="#EFF6FF", ec="#0284C7", lw=2)
    ax.add_patch(s_box)
    ax.text(7.0, 6.4, "TIER 2: API & SIGNALING SERVER", ha='center', va='center', fontsize=11, fontweight='bold', color='#075985')
    ax.text(7.0, 6.0, "(Node.js + Express.js + Socket.io)", ha='center', va='center', fontsize=8.5, color='#0369A1')

    server_nodes = [
        (7.0, 5.2, "JWT Auth Middleware\n(Stateless Tokens, Google SSO)"),
        (7.0, 4.0, "REST Controllers\n(/api/users, /api/sessions, /api/skills)"),
        (7.0, 2.8, "Socket.io Real-Time Engine\n(Scoped Rooms session:<id>)"),
        (7.0, 1.6, "STUN / TURN API\n(ICE Credentials & NAT Traversal)")
    ]
    for x, y, label in server_nodes:
        n_box = patches.FancyBboxPatch((x-1.8, y-0.45), 3.6, 0.9, boxstyle="round,pad=0.1,rounding_size=0.15", 
                                       fc="#FFFFFF", ec="#0284C7", lw=1.5)
        ax.add_patch(n_box)
        ax.text(x, y, label, ha='center', va='center', fontsize=8.5, fontweight='bold', color='#1E293B')

    # Container 3: Persistence Layer (Right)
    d_box = patches.FancyBboxPatch((9.6, 0.8), 3.8, 6.0, boxstyle="round,pad=0.2,rounding_size=0.2", 
                                  fc="#FAF5FF", ec="#8B5CF6", lw=2)
    ax.add_patch(d_box)
    ax.text(11.5, 6.4, "TIER 3: DATA PERSISTENCE", ha='center', va='center', fontsize=11, fontweight='bold', color='#5B21B6')
    ax.text(11.5, 6.0, "(Prisma ORM + PostgreSQL)", ha='center', va='center', fontsize=8.5, color='#6D28D9')

    data_nodes = [
        (11.5, 5.2, "Prisma ORM Layer\n(Type-Safe Schema & Migrations)"),
        (11.5, 3.8, "PostgreSQL Database\n(Users, Skills, Sessions, Ledger)"),
        (11.5, 2.0, "Multi-Laptop JSON Sync\n(inMemory Multi-Device Fallback)")
    ]
    for x, y, label in data_nodes:
        n_box = patches.FancyBboxPatch((x-1.6, y-0.5), 3.2, 1.0, boxstyle="round,pad=0.1,rounding_size=0.15", 
                                       fc="#FFFFFF", ec="#8B5CF6", lw=1.5)
        ax.add_patch(n_box)
        ax.text(x, y, label, ha='center', va='center', fontsize=8.5, fontweight='bold', color='#1E293B')

    # Inter-tier communication arrows
    ax.annotate("", xy=(5.2, 4.0), xytext=(4.1, 4.0), arrowprops=dict(arrowstyle="<->", color="#0284C7", lw=2.5))
    ax.text(4.65, 4.3, "HTTP REST", ha='center', va='center', fontsize=7.5, fontweight='bold', color='#0284C7')

    ax.annotate("", xy=(5.2, 2.8), xytext=(4.1, 2.8), arrowprops=dict(arrowstyle="<->", color="#10B981", lw=2.5))
    ax.text(4.65, 3.1, "WebSocket", ha='center', va='center', fontsize=7.5, fontweight='bold', color='#10B981')

    ax.annotate("", xy=(9.9, 4.5), xytext=(8.8, 4.5), arrowprops=dict(arrowstyle="<->", color="#8B5CF6", lw=2.5))
    ax.text(9.35, 4.8, "Prisma ORM", ha='center', va='center', fontsize=7.5, fontweight='bold', color='#8B5CF6')

    ax.text(7.0, 7.1, "MINDROOT 3-TIER MULTI-LAYER SYSTEM ARCHITECTURE", ha='center', va='center', 
            fontsize=14, fontweight='bold', color='#0F172A')

    plt.tight_layout()
    plt.savefig("diagrams/architecture_diagram.png", bbox_inches='tight')
    plt.close()
    print("Architecture Diagram generated.")

def draw_ui_mockups():
    # 1. UI Landing Page Mockup
    fig, ax = plt.subplots(figsize=(14, 7.5), dpi=200)
    ax.set_facecolor('#0F172A')
    fig.patch.set_facecolor('#0F172A')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 7.5)
    ax.axis('off')

    # Browser Bar
    b_bar = patches.Rectangle((0.5, 6.8), 13.0, 0.5, fc="#1E293B", ec="#334155")
    ax.add_patch(b_bar)
    for i, c in enumerate(["#EF4444", "#F59E0B", "#10B981"]):
        ax.add_patch(patches.Circle((0.8 + i*0.25, 7.05), 0.08, fc=c, ec="none"))
    url_bar = patches.FancyBboxPatch((2.0, 6.88), 9.0, 0.34, boxstyle="round,pad=0.05,rounding_size=0.1", fc="#0F172A", ec="#475569")
    ax.add_patch(url_bar)
    ax.text(6.5, 7.05, "https://mindroot.local:5173/explore", ha='center', va='center', fontsize=8, color="#94A3B8")

    # Navbar
    nav = patches.Rectangle((0.5, 6.0), 13.0, 0.8, fc="#1E293B", ec="#334155")
    ax.add_patch(nav)
    ax.text(1.2, 6.4, "MINDROOT", fontsize=14, fontweight='bold', color="#10B981", va='center')
    nav_links = ["Explore", "My Sessions", "Messages", "Classroom", "Token Wallet: 4 Tokens"]
    for idx, nl in enumerate(nav_links):
        ax.text(4.5 + idx*1.8, 6.4, nl, fontsize=9.5, color="#F8FAFC" if idx==0 else "#94A3B8", va='center', fontweight='bold' if idx==4 else 'normal')

    # Hero Banner
    hero = patches.FancyBboxPatch((0.8, 3.4), 12.4, 2.3, boxstyle="round,pad=0.2,rounding_size=0.2", fc="#1E293B", ec="#10B981", lw=1.5)
    ax.add_patch(hero)
    ax.text(7.0, 5.0, "Trade Knowledge, Not Money", ha='center', va='center', fontsize=20, fontweight='bold', color="#FFFFFF")
    ax.text(7.0, 4.4, "A Peer-to-Peer Micro-Economy for University Students", ha='center', va='center', fontsize=12, color="#0EA5E9")
    
    # CTA Buttons
    btn1 = patches.FancyBboxPatch((4.5, 3.7), 2.2, 0.5, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#10B981", ec="none")
    ax.add_patch(btn1)
    ax.text(5.6, 3.95, "Find a Mentor", ha='center', va='center', fontsize=9.5, fontweight='bold', color="white")

    btn2 = patches.FancyBboxPatch((7.3, 3.7), 2.2, 0.5, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#334155", ec="#64748B")
    ax.add_patch(btn2)
    ax.text(8.4, 3.95, "Start Teaching", ha='center', va='center', fontsize=9.5, fontweight='bold', color="white")

    # Stat Cards
    stats = [("Active Students", "1,248+"), ("Sessions Completed", "3,890 hrs"), ("Skill Categories", "48 Topics"), ("Avg Trust Rating", "4.92 / 5.0 ★")]
    for idx, (st_t, st_v) in enumerate(stats):
        sc = patches.FancyBboxPatch((0.8 + idx*3.15, 1.2), 2.9, 1.8, boxstyle="round,pad=0.15,rounding_size=0.15", fc="#1E293B", ec="#334155")
        ax.add_patch(sc)
        ax.text(2.25 + idx*3.15, 2.3, st_v, ha='center', va='center', fontsize=16, fontweight='bold', color="#10B981" if idx!=3 else "#F59E0B")
        ax.text(2.25 + idx*3.15, 1.7, st_t, ha='center', va='center', fontsize=9.5, color="#94A3B8")

    plt.tight_layout()
    plt.savefig("diagrams/ui_landing.png", bbox_inches='tight')
    plt.close()

    # 2. UI Peer Discovery & Matchmaker Mockup
    fig, ax = plt.subplots(figsize=(14, 7.5), dpi=200)
    ax.set_facecolor('#0F172A')
    fig.patch.set_facecolor('#0F172A')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 7.5)
    ax.axis('off')

    # Top search bar
    sb = patches.FancyBboxPatch((0.8, 6.2), 12.4, 0.8, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#1E293B", ec="#334155")
    ax.add_patch(sb)
    ax.text(1.2, 6.6, "Search skills, tutors, or topics (e.g., React, Python, Data Structures)...", fontsize=10, color="#94A3B8", va='center')
    
    # 3 Peer Cards
    peers = [
        ("Aarav Sharma", "Computer Science, Year 3", "Rating: 4.95 (34 reviews)", ["React", "TypeScript", "Node.js"], ["Python ML", "Docker"], "#10B981"),
        ("Priya Patel", "Information Technology, Year 4", "Rating: 4.88 (28 reviews)", ["Python", "DSA", "SQL"], ["Figma", "UI/UX"], "#0EA5E9"),
        ("Rohan Verma", "Software Engineering, Year 2", "Rating: 5.00 (19 reviews)", ["C++", "Algorithms", "System Design"], ["WebRTC", "Socket.io"], "#8B5CF6")
    ]
    for idx, (p_name, p_dept, p_rate, teaches, wants, p_col) in enumerate(peers):
        pc = patches.FancyBboxPatch((0.8 + idx*4.2, 1.0), 3.9, 4.8, boxstyle="round,pad=0.2,rounding_size=0.2", fc="#1E293B", ec=p_col, lw=2)
        ax.add_patch(pc)

        # Avatar placeholder
        av = patches.Circle((1.5 + idx*4.2, 5.0), 0.45, fc=p_col, ec="none")
        ax.add_patch(av)
        ax.text(1.5 + idx*4.2, 5.0, p_name[0], ha='center', va='center', fontsize=14, fontweight='bold', color="white")

        ax.text(2.1 + idx*4.2, 5.15, p_name, fontsize=11, fontweight='bold', color="white")
        ax.text(2.1 + idx*4.2, 4.8, p_dept, fontsize=7.5, color="#94A3B8")
        ax.text(2.1 + idx*4.2, 4.5, p_rate, fontsize=8, fontweight='bold', color="#F59E0B")

        # Teaches
        ax.text(1.2 + idx*4.2, 3.9, "TEACHES:", fontsize=8, fontweight='bold', color="#10B981")
        for ti, t_skill in enumerate(teaches):
            pill = patches.FancyBboxPatch((1.2 + idx*4.2 + ti*1.2, 3.4), 1.1, 0.35, boxstyle="round,pad=0.05,rounding_size=0.1", fc="#064E3B", ec="#10B981")
            ax.add_patch(pill)
            ax.text(1.75 + idx*4.2 + ti*1.2, 3.57, t_skill, ha='center', va='center', fontsize=7, color="#A7F3D0")

        # Wants to Learn
        ax.text(1.2 + idx*4.2, 2.9, "WANTS TO LEARN:", fontsize=8, fontweight='bold', color="#0EA5E9")
        for wi, w_skill in enumerate(wants):
            pill = patches.FancyBboxPatch((1.2 + idx*4.2 + wi*1.3, 2.4), 1.2, 0.35, boxstyle="round,pad=0.05,rounding_size=0.1", fc="#0C4A6E", ec="#0EA5E9")
            ax.add_patch(pill)
            ax.text(1.8 + idx*4.2 + wi*1.3, 2.57, w_skill, ha='center', va='center', fontsize=7, color="#BAE6FD")

        # Book Button
        b_btn = patches.FancyBboxPatch((1.2 + idx*4.2, 1.4), 3.1, 0.6, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#10B981", ec="none")
        ax.add_patch(b_btn)
        ax.text(2.75 + idx*4.2, 1.7, "Book Session (1 Token)", ha='center', va='center', fontsize=9, fontweight='bold', color="white")

    plt.tight_layout()
    plt.savefig("diagrams/ui_matchmaker.png", bbox_inches='tight')
    plt.close()

    # 3. UI Live Virtual Classroom Mockup
    fig, ax = plt.subplots(figsize=(14, 7.5), dpi=200)
    ax.set_facecolor('#0F172A')
    fig.patch.set_facecolor('#0F172A')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 7.5)
    ax.axis('off')

    # Classroom Header
    ch = patches.Rectangle((0.5, 6.7), 13.0, 0.6, fc="#1E293B", ec="#334155")
    ax.add_patch(ch)
    ax.text(0.9, 7.0, "[LIVE CLASSROOM] React Component Lifecycle & Hooks", fontsize=10, fontweight='bold', color="white", va='center')
    ax.text(10.8, 7.0, "Time: 42:15 Left | 1 Token Escrowed", fontsize=9, fontweight='bold', color="#F59E0B", va='center')

    # Video Feed 1: Teacher (Main)
    v1 = patches.FancyBboxPatch((0.8, 2.0), 6.0, 4.4, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#1E293B", ec="#10B981", lw=2)
    ax.add_patch(v1)
    ax.text(3.8, 4.4, "Mentor Video Stream (HD 720p)", ha='center', va='center', fontsize=12, fontweight='bold', color="#A7F3D0")
    ax.text(3.8, 3.8, "Peer-to-Peer WebRTC | Latency: 42ms | DTLS-SRTP Encrypted", ha='center', va='center', fontsize=8.5, color="#94A3B8")
    ax.text(1.2, 2.3, "Mentor: Aarav Sharma", fontsize=9, fontweight='bold', color="white")

    # Video Feed 2: Student (Corner Picture-in-Picture)
    v2 = patches.FancyBboxPatch((7.1, 4.4), 2.8, 2.0, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#0F172A", ec="#0EA5E9", lw=1.5)
    ax.add_patch(v2)
    ax.text(8.5, 5.5, "Student Video", ha='center', va='center', fontsize=9.5, fontweight='bold', color="#BAE6FD")
    ax.text(7.3, 4.7, "Learner: You", fontsize=8, color="white")

    # In-room Chat Sidebar
    chat_box = patches.FancyBboxPatch((10.2, 1.0), 3.0, 5.4, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#1E293B", ec="#334155")
    ax.add_patch(chat_box)
    ax.text(11.7, 6.1, "In-Room Chat", ha='center', va='center', fontsize=10, fontweight='bold', color="white")
    chat_msgs = [
        ("Aarav", "Let's review useEffect cleanup first."),
        ("You", "Sure, I had a memory leak with timers."),
        ("Aarav", "Look at lines 15-22 on the live code runner."),
        ("System", "Whiteboard synchronized.")
    ]
    for mi, (sender, text) in enumerate(chat_msgs):
        ax.text(10.5, 5.4 - mi*0.9, f"{sender}:", fontsize=7.5, fontweight='bold', color="#10B981" if sender=="Aarav" else "#0EA5E9")
        ax.text(10.5, 5.1 - mi*0.9, text, fontsize=7.5, color="#E2E8F0")

    # Collaborative Whiteboard & Code Tab (Below)
    tools_box = patches.FancyBboxPatch((7.1, 1.0), 2.8, 3.1, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#1E293B", ec="#8B5CF6", lw=1.5)
    ax.add_patch(tools_box)
    ax.text(8.5, 3.6, "Interactive Tools", ha='center', va='center', fontsize=10, fontweight='bold', color="white")
    ax.text(8.5, 3.0, "Shared Whiteboard Canvas", ha='center', va='center', fontsize=8.5, color="#DDD6FE")
    ax.text(8.5, 2.4, "Synchronized Code Runner", ha='center', va='center', fontsize=8.5, color="#DDD6FE")
    ax.text(8.5, 1.8, "Export Session Notes", ha='center', va='center', fontsize=8.5, color="#DDD6FE")

    # Controls Bar
    ctrl = patches.FancyBboxPatch((0.8, 1.0), 6.0, 0.8, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#1E293B", ec="#334155")
    ax.add_patch(ctrl)
    ctrls = ["Mute Audio", "Stop Video", "Share Screen", "End & Settle"]
    for ci, ct in enumerate(ctrls):
        c_btn = patches.FancyBboxPatch((1.0 + ci*1.45, 1.15), 1.35, 0.5, boxstyle="round,pad=0.05,rounding_size=0.1", 
                                      fc="#EF4444" if ci==3 else "#334155", ec="none")
        ax.add_patch(c_btn)
        ax.text(1.67 + ci*1.45, 1.4, ct, ha='center', va='center', fontsize=7.5, fontweight='bold', color="white")

    plt.tight_layout()
    plt.savefig("diagrams/ui_classroom.png", bbox_inches='tight')
    plt.close()
    # 4. UI Auth Mockup (Screen 2)
    fig, ax = plt.subplots(figsize=(14, 7.5), dpi=200)
    ax.set_facecolor('#0F172A')
    fig.patch.set_facecolor('#0F172A')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 7.5)
    ax.axis('off')

    # Card
    auth_card = patches.FancyBboxPatch((3.8, 1.2), 6.4, 5.2, boxstyle="round,pad=0.2,rounding_size=0.2", fc="#1E293B", ec="#A02B93", lw=2)
    ax.add_patch(auth_card)
    ax.text(7.0, 5.8, "Welcome to Mindroot", ha='center', va='center', fontsize=18, fontweight='bold', color="white")
    ax.text(7.0, 5.3, "Sign in to connect with student peers", ha='center', va='center', fontsize=10, color="#94A3B8")

    # Google SSO Button
    g_btn = patches.FancyBboxPatch((4.5, 4.3), 5.0, 0.65, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#FFFFFF", ec="#E2E8F0")
    ax.add_patch(g_btn)
    ax.text(7.0, 4.62, "Continue with Google (OAuth 2.0)", ha='center', va='center', fontsize=10, fontweight='bold', color="#1E293B")

    ax.text(7.0, 3.85, "-------- or sign in with email --------", ha='center', va='center', fontsize=8.5, color="#64748B")

    # Email & Password Inputs
    e_box = patches.FancyBboxPatch((4.5, 3.0), 5.0, 0.55, boxstyle="round,pad=0.08,rounding_size=0.1", fc="#0F172A", ec="#475569")
    ax.add_patch(e_box)
    ax.text(4.7, 3.27, "student@university.edu", fontsize=9, color="#94A3B8", va='center')

    p_box = patches.FancyBboxPatch((4.5, 2.2), 5.0, 0.55, boxstyle="round,pad=0.08,rounding_size=0.1", fc="#0F172A", ec="#475569")
    ax.add_patch(p_box)
    ax.text(4.7, 2.47, "••••••••••••", fontsize=9, color="#94A3B8", va='center')

    # Sign In Button
    s_btn = patches.FancyBboxPatch((4.5, 1.4), 5.0, 0.55, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#A02B93", ec="none")
    ax.add_patch(s_btn)
    ax.text(7.0, 1.67, "Sign In to Account", ha='center', va='center', fontsize=10, fontweight='bold', color="white")

    plt.tight_layout()
    plt.savefig("diagrams/ui_auth.png", bbox_inches='tight')
    plt.close()

    # 5. UI Booking Mockup (Screen 4)
    fig, ax = plt.subplots(figsize=(14, 7.5), dpi=200)
    ax.set_facecolor('#0F172A')
    fig.patch.set_facecolor('#0F172A')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 7.5)
    ax.axis('off')

    b_modal = patches.FancyBboxPatch((3.0, 1.0), 8.0, 5.5, boxstyle="round,pad=0.2,rounding_size=0.2", fc="#1E293B", ec="#A02B93", lw=2)
    ax.add_patch(b_modal)
    ax.text(7.0, 6.0, "Schedule Peer Learning Session", ha='center', va='center', fontsize=16, fontweight='bold', color="white")
    ax.text(7.0, 5.5, "Mentor: Aarav Sharma | Topic: React ↔ Python Swap", ha='center', va='center', fontsize=10, color="#A7F3D0")

    # Date & Slot pickers
    ax.text(3.6, 4.8, "Select Date: Tuesday, Nov 12, 2026", fontsize=9.5, fontweight='bold', color="#E2E8F0")
    slots = ["10:00 AM", "02:00 PM (Selected)", "04:30 PM", "07:00 PM"]
    for si, st in enumerate(slots):
        s_pill = patches.FancyBboxPatch((3.6 + (si%2)*3.6, 3.8 - (si//2)*0.6), 3.2, 0.45, 
                                        boxstyle="round,pad=0.05,rounding_size=0.1", 
                                        fc="#A02B93" if si==1 else "#334155", ec="none")
        ax.add_patch(s_pill)
        ax.text(5.2 + (si%2)*3.6, 4.02 - (si//2)*0.6, st, ha='center', va='center', fontsize=8.5, fontweight='bold' if si==1 else 'normal', color="white")

    # Escrow notice
    esc_box = patches.FancyBboxPatch((3.6, 2.1), 6.8, 0.7, boxstyle="round,pad=0.08,rounding_size=0.1", fc="#0F172A", ec="#F59E0B")
    ax.add_patch(esc_box)
    ax.text(7.0, 2.45, "Token Notice: 1 Skill Token will be held in secure escrow until session completion.", ha='center', va='center', fontsize=8, color="#FDE68A")

    # Confirm & Calendar export button
    conf_btn = patches.FancyBboxPatch((3.6, 1.3), 3.2, 0.55, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#10B981", ec="none")
    ax.add_patch(conf_btn)
    ax.text(5.2, 1.57, "Confirm Booking", ha='center', va='center', fontsize=9.5, fontweight='bold', color="white")

    cal_btn = patches.FancyBboxPatch((7.2, 1.3), 3.2, 0.55, boxstyle="round,pad=0.1,rounding_size=0.15", fc="#0284C7", ec="none")
    ax.add_patch(cal_btn)
    ax.text(8.8, 1.57, "Download .ics Calendar", ha='center', va='center', fontsize=9.5, fontweight='bold', color="white")

    plt.tight_layout()
    plt.savefig("diagrams/ui_booking.png", bbox_inches='tight')
    plt.close()

    # 6. UI Whiteboard Mockup (Screen 6)
    fig, ax = plt.subplots(figsize=(14, 7.5), dpi=200)
    ax.set_facecolor('#0F172A')
    fig.patch.set_facecolor('#0F172A')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 7.5)
    ax.axis('off')

    wb_frame = patches.FancyBboxPatch((0.8, 1.0), 12.4, 5.5, boxstyle="round,pad=0.2,rounding_size=0.2", fc="#FFFFFF", ec="#A02B93", lw=2)
    ax.add_patch(wb_frame)

    # Tool bar on top of whiteboard
    tb_rect = patches.Rectangle((0.8, 5.9), 12.4, 0.6, fc="#F1F5F9", ec="#CBD5E1")
    ax.add_patch(tb_rect)
    ax.text(1.2, 6.2, "Tools: [Pen] [Highlighter] [Rectangle] [Circle] [Arrow] [Text] [Eraser] | Color: [Purple] [Green] [Blue] | Stroke: 3px", fontsize=9, color="#334155", va='center')

    # Whiteboard Canvas drawing
    box_a = patches.Rectangle((2.0, 3.2), 2.5, 1.5, fc="#E0F2FE", ec="#0284C7", lw=2)
    ax.add_patch(box_a)
    ax.text(3.25, 3.95, "Client Component\n<SearchFilter />", ha='center', va='center', fontsize=9, fontweight='bold', color="#0369A1")

    box_b = patches.Rectangle((7.0, 3.2), 2.5, 1.5, fc="#DCFCE7", ec="#16A34A", lw=2)
    ax.add_patch(box_b)
    ax.text(8.25, 3.95, "Server Controller\n/api/peers/match", ha='center', va='center', fontsize=9, fontweight='bold', color="#15803D")

    ax.annotate("", xy=(7.0, 3.95), xytext=(4.5, 3.95), arrowprops=dict(arrowstyle="->", color="#A02B93", lw=2.5))
    ax.text(5.75, 4.3, "Async Fetch (REST)", ha='center', va='center', fontsize=8.5, fontweight='bold', color="#A02B93")

    ax.text(7.0, 1.5, "[Real-Time Whiteboard & Live Pair Programming Canvas - Synchronized via Socket.io / WebRTC DataChannel]", ha='center', va='center', fontsize=9.5, color="#64748B")

    plt.tight_layout()
    plt.savefig("diagrams/ui_whiteboard.png", bbox_inches='tight')
    plt.close()
    print("UI Mockups generated.")

if __name__ == "__main__":
    draw_architecture_diagram()
    draw_er_diagram()
    draw_system_flowchart()
    draw_dfd_context()
    draw_dfd_user_level1()
    draw_dfd_admin_level1()
    draw_analytics_graphs()
    draw_dfd_symbols()
    draw_webrtc_diagram()
    draw_ui_mockups()

