import sys
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6] # blank

    # Color Palette - Modern Academic & Tech Theme (Emerald & Deep Navy)
    PRIMARY = RGBColor(16, 185, 129)       # Vibrant Emerald Green #10B981
    PRIMARY_DARK = RGBColor(6, 95, 70)     # Dark Forest Green #065F46
    SECONDARY = RGBColor(14, 165, 233)     # Ocean Blue #0EA5E9
    DARK_BG = RGBColor(15, 23, 42)         # Deep Slate #0F172A
    CARD_BG = RGBColor(248, 250, 252)      # Soft White #F8FAFC
    CARD_BORDER = RGBColor(226, 232, 240)  # Border Gray #E2E8F0
    TEXT_MAIN = RGBColor(30, 41, 59)       # Charcoal #1E293B
    TEXT_MUTED = RGBColor(100, 116, 139)   # Slate Muted #64748B
    WHITE = RGBColor(255, 255, 255)
    ACCENT_RED = RGBColor(239, 68, 68)     # Coral Red #EF4444
    ACCENT_AMBER = RGBColor(245, 158, 11)  # Warm Amber #F59E0B

    def set_font(run, size=14, bold=False, color=TEXT_MAIN, name="Segoe UI"):
        run.font.name = name
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color

    def add_header(slide, title, category="MINDROOT — PEER SKILL EXCHANGE PLATFORM"):
        # Top banner line
        top_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.12))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = PRIMARY
        top_bar.line.fill.background()

        # Category Tracker
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.35), Inches(11.7), Inches(0.3))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        tf_cat.margin_left = tf_cat.margin_right = tf_cat.margin_top = tf_cat.margin_bottom = 0
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category.upper()
        set_font(p_cat.runs[0], size=10, bold=True, color=PRIMARY_DARK)

        # Slide Main Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.65), Inches(11.7), Inches(0.6))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        tf_title.margin_left = tf_title.margin_right = tf_title.margin_top = tf_title.margin_bottom = 0
        p_title = tf_title.paragraphs[0]
        p_title.text = title
        set_font(p_title.runs[0], size=22, bold=True, color=DARK_BG)

        # Underline accent
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.3), Inches(1.8), Inches(0.04))
        line.fill.solid()
        line.fill.fore_color.rgb = PRIMARY
        line.line.fill.background()

    def add_footer(slide, slide_num, total_slides=42):
        foot_box = slide.shapes.add_textbox(Inches(0.8), Inches(7.0), Inches(11.7), Inches(0.35))
        tf = foot_box.text_frame
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        run1 = p.add_run()
        run1.text = "MINDROOT (STUDENT TO STUDENT)  |  ACADEMIC PROJECT REPORT PRESENTATION"
        set_font(run1, size=9, bold=False, color=TEXT_MUTED)
        
        run2 = p.add_run()
        run2.text = f"        PAGE {slide_num} OF {total_slides}"
        set_font(run2, size=9, bold=True, color=PRIMARY_DARK)

    def add_card(slide, left, top, width, height, title, items, bg_color=CARD_BG, border_color=CARD_BORDER, header_color=DARK_BG):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        card.line.color.rgb = border_color
        card.line.width = Pt(1.4)

        tb = slide.shapes.add_textbox(left + Inches(0.25), top + Inches(0.22), width - Inches(0.5), height - Inches(0.44))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        
        if title:
            p_t = tf.paragraphs[0]
            p_t.text = title
            set_font(p_t.runs[0], size=15, bold=True, color=header_color)
            p_t.space_after = Pt(12)
            first_item = True
        else:
            first_item = False

        for item in items:
            p = tf.add_paragraph() if (title or not first_item) else tf.paragraphs[0]
            first_item = False
            p.space_after = Pt(10)
            if isinstance(item, tuple):
                bold_txt, regular_txt = item
                r_b = p.add_run()
                r_b.text = "• " + bold_txt + ": "
                set_font(r_b, size=12, bold=True, color=DARK_BG)
                r_r = p.add_run()
                r_r.text = regular_txt
                set_font(r_r, size=12, bold=False, color=TEXT_MAIN)
            else:
                r = p.add_run()
                r.text = ("• " if title else "") + str(item)
                set_font(r, size=12, bold=False, color=TEXT_MAIN)

    def add_table(slide, left, top, width, height, headers, rows, col_widths=None):
        num_rows = len(rows) + 1
        num_cols = len(headers)
        table_shape = slide.shapes.add_table(num_rows, num_cols, left, top, width, height)
        table = table_shape.table

        if col_widths and len(col_widths) == num_cols:
            for idx, w in enumerate(col_widths):
                table.columns[idx].width = w

        # Header Row
        for col_idx, h_text in enumerate(headers):
            cell = table.cell(0, col_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = PRIMARY_DARK
            tf = cell.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT
            r = p.add_run()
            r.text = h_text
            set_font(r, size=12, bold=True, color=WHITE)

        # Data Rows
        for row_idx, row_data in enumerate(rows):
            bg = CARD_BG if row_idx % 2 == 0 else WHITE
            for col_idx, val in enumerate(row_data):
                cell = table.cell(row_idx + 1, col_idx)
                cell.fill.solid()
                cell.fill.fore_color.rgb = bg
                tf = cell.text_frame
                tf.word_wrap = True
                p = tf.paragraphs[0]
                p.alignment = PP_ALIGN.LEFT
                r = p.add_run()
                r.text = str(val)
                is_first_col = (col_idx == 0)
                set_font(r, size=11, bold=is_first_col, color=DARK_BG if is_first_col else TEXT_MAIN)

    print("Building slides...")

    # -------------------------------------------------------------
    # SLIDE 1: Title & Cover Slide
    # -------------------------------------------------------------
    s1 = prs.slides.add_slide(blank_layout)
    bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = DARK_BG
    bg1.line.fill.background()

    # Top accent bar
    bar1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.2))
    bar1.fill.solid()
    bar1.fill.fore_color.rgb = PRIMARY
    bar1.line.fill.background()

    # Title box
    tb = s1.shapes.add_textbox(Inches(1.2), Inches(1.3), Inches(10.9), Inches(2.2))
    tf = tb.text_frame
    tf.word_wrap = True
    p1 = tf.paragraphs[0]
    p1.text = "A PROJECT REPORT ON"
    set_font(p1.runs[0], size=14, bold=True, color=PRIMARY)
    p1.space_after = Pt(10)

    p2 = tf.add_paragraph()
    p2.text = "MINDROOT — PEER SKILL EXCHANGE PLATFORM"
    set_font(p2.runs[0], size=28, bold=True, color=WHITE)
    p2.space_after = Pt(6)

    p3 = tf.add_paragraph()
    p3.text = "(STUDENT-TO-STUDENT COLLABORATIVE LEARNING & TOKEN ECONOMY SYSTEM)"
    set_font(p3.runs[0], size=13, bold=False, color=SECONDARY)

    # Info container card
    info_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(3.8), Inches(10.9), Inches(2.7))
    info_card.fill.solid()
    info_card.fill.fore_color.rgb = RGBColor(30, 41, 59)
    info_card.line.color.rgb = RGBColor(51, 65, 85)
    info_card.line.width = Pt(1)

    # 3 Column layout inside Info Card
    # Col 1: Submitted To
    tb_c1 = s1.shapes.add_textbox(Inches(1.5), Inches(4.0), Inches(3.4), Inches(2.3))
    tf_c1 = tb_c1.text_frame
    tf_c1.word_wrap = True
    p = tf_c1.paragraphs[0]
    p.text = "-: SUBMITTED TO :-"
    set_font(p.runs[0], size=11, bold=True, color=PRIMARY)
    p.space_after = Pt(8)
    items_sub = ["[College / Institute Name]", "Department of Computer Applications", "H.N.G.U. / University Campus"]
    for it in items_sub:
        p_sub = tf_c1.add_paragraph()
        p_sub.text = it
        set_font(p_sub.runs[0], size=10, bold=False, color=WHITE)

    # Col 2: Internal Guidance
    tb_c2 = s1.shapes.add_textbox(Inches(5.2), Inches(4.0), Inches(3.4), Inches(2.3))
    tf_c2 = tb_c2.text_frame
    tf_c2.word_wrap = True
    p = tf_c2.paragraphs[0]
    p.text = "-: INTERNAL GUIDANCE :-"
    set_font(p.runs[0], size=11, bold=True, color=PRIMARY)
    p.space_after = Pt(8)
    items_gui = ["[Guide Name]", "(Assistant Professor)", "Dept. of Computer Science & IT"]
    for it in items_gui:
        p_gui = tf_c2.add_paragraph()
        p_gui.text = it
        set_font(p_gui.runs[0], size=10, bold=False, color=WHITE)

    # Col 3: Presented By
    tb_c3 = s1.shapes.add_textbox(Inches(8.8), Inches(4.0), Inches(3.1), Inches(2.3))
    tf_c3 = tb_c3.text_frame
    tf_c3.word_wrap = True
    p = tf_c3.paragraphs[0]
    p.text = "-: PRESENTED BY :-"
    set_font(p.runs[0], size=11, bold=True, color=PRIMARY)
    p.space_after = Pt(8)
    items_pre = ["[Student Name 1]", "[Roll No. / Enrollment]", "[Student Name 2]", "[Roll No. / Enrollment]"]
    for it in items_pre:
        p_pre = tf_c3.add_paragraph()
        p_pre.text = it
        set_font(p_pre.runs[0], size=10, bold=False, color=WHITE)

    # -------------------------------------------------------------
    # SLIDE 2: Project Profile
    # -------------------------------------------------------------
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "Project Profile & Metadata")
    add_footer(s2, 2)

    headers2 = ["Parameter", "Project Specification Details"]
    rows2 = [
        ["Project Title", "Mindroot — Peer-to-Peer Skill Exchange Platform ('Student to Student')"],
        ["Organization / College", "Department of Computer Science & Engineering / BCA Institute"],
        ["Internal Project Guide", "[Guide Name / Assistant Professor]"],
        ["Group Size & Members", "Group of 2 Members: [Student Name 1], [Student Name 2]"],
        ["Project Duration", "120 Hours (Academic Semester Project Lifecycle)"],
        ["Frontend Technologies", "React 19, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion"],
        ["Backend Technologies", "Node.js, Express.js, Socket.io Real-Time Signaling Server"],
        ["Database & ORM", "PostgreSQL Database, Prisma ORM (with inMemory multi-laptop sync fallback)"],
        ["Real-Time Audio / Video", "WebRTC Peer-to-Peer Engine (SimplePeer, MediaStream APIs, STUN/TURN)"],
        ["Development Tools Used", "Visual Studio Code, Git, GitHub, Postman, Docker, Vite CLI"]
    ]
    add_table(s2, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.0), headers2, rows2, [Inches(3.2), Inches(8.533)])

    # -------------------------------------------------------------
    # SLIDE 3: Table of Contents / Presentation Outline
    # -------------------------------------------------------------
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "Table of Contents & Presentation Outline")
    add_footer(s3, 3)

    agenda_cards = [
        ("01. Foundation & Analysis", [
            ("Existing System", "Current learning limitations"),
            ("Need For System", "Democratizing education"),
            ("Objectives", "Core goals & milestones"),
            ("Hardware & Software", "System specifications")
        ]),
        ("02. Architecture & Design", [
            ("High-Level Arch", "3-Tier modular design"),
            ("System Flowcharts", "User, Teacher & Admin"),
            ("E-R Diagram", "Relational entities"),
            ("DFD Levels 0 & 1", "Detailed data workflows")
        ]),
        ("03. Data & Technology", [
            ("Token Time-Banking", "Ledger & escrow math"),
            ("WebRTC Engine", "P2P audio/video & signaling"),
            ("Data Dictionary", "User, Session & Transaction"),
            ("Security & Trust", "JWT, OAuth 2.0 & ratings")
        ]),
        ("04. Implementation & Future", [
            ("UI Walkthrough", "7 Core platform screens"),
            ("Real-Time Features", "Whiteboard & Code editor"),
            ("Future Scope", "AI matching & mobile apps"),
            ("Conclusion", "Summary & Bibliography")
        ])
    ]
    for idx, (c_title, c_items) in enumerate(agenda_cards):
        left = Inches(0.8 + idx * 3.0)
        add_card(s3, left, Inches(1.8), Inches(2.8), Inches(4.8), c_title, c_items, header_color=PRIMARY_DARK)

    # -------------------------------------------------------------
    # SLIDE 4: Project Introduction & Background
    # -------------------------------------------------------------
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "Project Introduction & Background")
    add_footer(s4, 4)

    add_card(s4, Inches(0.8), Inches(1.6), Inches(11.733), Inches(2.4), "Background & Student Learning Landscape", [
        ("The Academic Skill Gap", "In university education, students frequently possess specialized competencies in specific fields (e.g., React development, Python ML, 3D modeling, French) while urgently needing support in others (Data Structures, Cloud, UI Design)."),
        ("The Traditional Tutoring Dilemma", "Commercial platforms charge high hourly rates ($25-$80/hr) which are financially prohibitive for full-time college students."),
        ("The Barter Solution", "Mindroot introduces a bilateral peer-to-peer knowledge exchange model where time and knowledge are the primary currency, enabling students to teach what they master in exchange for what they need.")
    ])

    add_card(s4, Inches(0.8), Inches(4.3), Inches(11.733), Inches(2.4), "What is Mindroot ('Student to Student')?", [
        ("Equalized Knowledge Economy", "Built on a Time-Banking philosophy where 1 hour of teaching earns 1 Skill Token, usable for 1 hour of learning any other discipline."),
        ("Zero-Install Virtual Classroom", "Integrates peer-to-peer video, audio, interactive drawing whiteboard, synchronized live coding editor, and text chat in a unified browser room."),
        ("Automated Trust & Reputation", "Features transparent peer review algorithms, dynamic trust scores (1.0 - 5.0), and calendar export (.ics) for seamless session management.")
    ])

    # -------------------------------------------------------------
    # SLIDE 5: Existing System
    # -------------------------------------------------------------
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "Existing System & Current Practices")
    add_footer(s5, 5)

    add_card(s5, Inches(0.8), Inches(1.6), Inches(5.7), Inches(2.5), "Current Process", [
        ("Ad-Hoc Peer Finding", "Students search for study partners via fragmented WhatsApp groups, college noticeboards, or Discord servers."),
        ("One-Way Paid Tutoring", "Services like Chegg or private tutors operate strictly as one-sided monetary transactions, locking out economically disadvantaged students."),
        ("No Matching Standard", "No systematic mechanism to assess if a study partner's complementary skills align with mutual needs.")
    ])

    add_card(s5, Inches(6.8), Inches(1.6), Inches(5.7), Inches(2.5), "User Management & Verification", [
        ("No Verified Profiles", "Informal study groups offer zero proof of competency or academic credibility before scheduling sessions."),
        ("High Ghosting Rates", "Sessions booked informally frequently suffer from unpunctuality or last-minute cancellations without accountability."),
        ("Scattered Records", "Previous tutoring notes, feedback, and study materials are easily lost across personal chat histories.")
    ])

    add_card(s5, Inches(0.8), Inches(4.4), Inches(5.7), Inches(2.4), "Tool Fragmentation & Friction", [
        ("Multi-App Overhead", "Students must switch between Google Meet (video), Google Docs (notes), Replit (coding), and WhatsApp (scheduling)."),
        ("Software Fatigue", "Managing separate subscriptions and install requirements interrupts the learning flow and creates technical roadblocks.")
    ])

    add_card(s5, Inches(6.8), Inches(4.4), Inches(5.7), Inches(2.4), "Monetary & Scheduling Barriers", [
        ("Financial Burden", "Paying for separate subjects rapidly escalates into prohibitive educational debt."),
        ("Time Zone & Calendar Conflicts", "Manual scheduling leads to forgotten sessions due to lack of automated calendar invitations (.ics).")
    ])

    # -------------------------------------------------------------
    # SLIDE 6: Disadvantages & Limitations of Existing System
    # -------------------------------------------------------------
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "Disadvantages & Limitations of Existing System")
    add_footer(s6, 6)

    limitations = [
        ("Financial Exclusivity", "Commercial tutoring models favor students with disposable income, preventing talented but financially constrained students from receiving mentorship."),
        ("Lack of Reciprocity", "Traditional platforms fail to recognize that a learner can also be an expert instructor in another domain."),
        ("Severe Free-Riding Problem", "In informal student study groups, one student often does all the teaching while others contribute nothing, leading to group burnout."),
        ("Zero Centralized Record Keeping", "No persistent ledger of hours taught or learned, making it impossible to showcase peer mentoring on resumes or portfolios."),
        ("Absence of Integrated Collaboration", "Standard video calling tools lack built-in compilers, code execution environments, or interactive engineering whiteboards.")
    ]
    for idx, (title_lim, desc_lim) in enumerate(limitations):
        top_lim = Inches(1.6 + idx * 1.05)
        add_card(s6, Inches(0.8), top_lim, Inches(11.733), Inches(0.95), "", [(title_lim, desc_lim)])

    # -------------------------------------------------------------
    # SLIDE 7: Proposed System Overview
    # -------------------------------------------------------------
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "Proposed System Overview — The Mindroot Solution")
    add_footer(s7, 7)

    pillars = [
        ("Dual Role Model", [
            ("Unified Account", "Every student acts as both a Teacher and a Learner with zero role-switching friction."),
            ("Skill Taxonomy", "Tag specific skills you can mentor in vs skills you wish to learn.")
        ]),
        ("Time-Bank Economy", [
            ("1 Hour = 1 Token", "Teaching 1 hour mints 1 Skill Token. Spending 1 token unlocks 1 hour of learning."),
            ("Escrow Protection", "Tokens are securely escrowed upon booking and only released on completion.")
        ]),
        ("P2P WebRTC Classroom", [
            ("HD Audio / Video", "Zero latency browser video powered by WebRTC and Socket.io signaling."),
            ("Shared Whiteboard", "Interactive canvas for drawing system architectures and formulas."),
            ("Live Code Runner", "In-room collaborative code editor with instant syntax highlighting.")
        ]),
        ("Automated Scheduling", [
            ("Smart Calendar", "Instant timezone-aware booking with automated .ics calendar export."),
            ("Trust & Safety", "Reputation score (1.0 to 5.0) generated from verified peer feedback.")
        ])
    ]
    for idx, (p_title, p_items) in enumerate(pillars):
        col = idx % 2
        row = idx // 2
        left = Inches(0.8 + col * 6.0)
        top = Inches(1.6 + row * 2.65)
        add_card(s7, left, top, Inches(5.7), Inches(2.45), p_title, p_items, header_color=PRIMARY_DARK)

    # -------------------------------------------------------------
    # SLIDE 8: Need For The System
    # -------------------------------------------------------------
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "Need For The System")
    add_footer(s8, 8)

    needs = [
        ("System Overview", "A complete web-based peer skill exchange platform built to replace unstructured, fee-heavy, and disjointed study methods with an automated, equitable digital ecosystem."),
        ("Democratized Accessibility", "Ensures every student has equal access to high-caliber personal tutoring regardless of financial background, converting individual knowledge into an actionable currency."),
        ("Friction-Free Remote Collaboration", "Consolidates video conferencing, screen sharing, architectural whiteboarding, and code pairing into a single tab without third-party downloads."),
        ("Disciplined Session Fulfillment", "The Skill Token escrow mechanism eliminates attendance ghosting by holding tokens in smart escrow until both peers complete the classroom hour."),
        ("Verified Community Safety", "Google OAuth 2.0 single sign-on combined with institutional email verification and trust scoring ensures high academic decorum.")
    ]
    for idx, (n_title, n_desc) in enumerate(needs):
        top_n = Inches(1.6 + idx * 1.05)
        add_card(s8, Inches(0.8), top_n, Inches(11.733), Inches(0.95), "", [(n_title, n_desc)])

    # -------------------------------------------------------------
    # SLIDE 9: Project Objectives
    # -------------------------------------------------------------
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "Project Objectives")
    add_footer(s9, 9)

    objs = [
        ("1. Eliminate Financial Barriers", "Build a cashless peer-learning environment where student time and expertise serve as the exclusive medium of exchange."),
        ("2. Algorithmic Peer Matchmaking", "Develop an automated compatibility search engine that pairs users whose teaching offerings directly fulfill each other's learning goals."),
        ("3. High-Fidelity P2P Interaction", "Implement sub-second peer-to-peer WebRTC video/audio alongside multi-user synchronized whiteboarding and live coding."),
        ("4. Trust & Accountability System", "Maintain a dynamic trust algorithm (1.0 - 5.0) based on peer evaluations, verified attendance, and prompt session delivery."),
        ("5. Effortless Calendar Sync", "Automate schedule confirmations and calendar synchronization via downloadable .ics files compatible with Google Calendar, Outlook, and Apple iCal.")
    ]
    for idx, (o_title, o_desc) in enumerate(objs):
        top_o = Inches(1.6 + idx * 1.05)
        add_card(s9, Inches(0.8), top_o, Inches(11.733), Inches(0.95), "", [(o_title, o_desc)], bg_color=WHITE, border_color=PRIMARY)

    # -------------------------------------------------------------
    # SLIDE 10: High-Level Architecture
    # -------------------------------------------------------------
    s10 = prs.slides.add_slide(blank_layout)
    add_header(s10, "High-Level System Architecture & Multi-Tier Topology")
    add_footer(s10, 10)

    arch_img = os.path.abspath("diagrams/architecture_diagram.png")
    if os.path.exists(arch_img):
        s10.shapes.add_picture(arch_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        tiers = [
            ("Tier 1: Client Application Layer (Frontend)", [
                ("Core Framework", "React 19 with Vite bundler for rapid rendering and sub-millisecond HMR."),
                ("State & Styling", "Zustand global stores, Tailwind CSS responsive utility grid, Framer Motion."),
                ("Media Engine", "WebRTC SimplePeer client, MediaStream APIs, HTML5 Canvas Whiteboard."),
                ("LAN Auto-Detect", "Dynamic server discovery supporting multi-laptop and Wi-Fi LAN access.")
            ]),
            ("Tier 2: Real-Time & API Layer (Backend)", [
                ("REST Controller", "Node.js with Express.js routing for Authentication, Users, Sessions, and Stats."),
                ("Real-Time Signaling", "Socket.io engine handling room joins, WebRTC SDP Offer/Answer relay & chat."),
                ("Security Middleware", "JWT token verification, Google OAuth 2.0 ID token authentication."),
                ("ICE Management", "Integrated STUN/TURN credential negotiation for reliable NAT traversal.")
            ]),
            ("Tier 3: Data Persistence Layer (Database)", [
                ("Object-Relational Mapping", "Prisma ORM enforcing strict type-safety, schema validations, and relations."),
                ("Relational Database", "PostgreSQL housing relational models for Users, Skills, Sessions, and Ledger."),
                ("Multi-Laptop Sync Store", "Instant file-backed JSON synchronization fallback for local LAN testbeds.")
            ])
        ]
        for idx, (t_title, t_items) in enumerate(tiers):
            left = Inches(0.8 + idx * 4.0)
            add_card(s10, left, Inches(1.6), Inches(3.733), Inches(5.1), t_title, t_items, header_color=PRIMARY_DARK)

    # -------------------------------------------------------------
    # SLIDE 11: Hardware & Software Requirements
    # -------------------------------------------------------------
    s11 = prs.slides.add_slide(blank_layout)
    add_header(s11, "Hardware & Software Requirements")
    add_footer(s11, 11)

    headers11 = ["Environment", "Component", "Minimum Requirement", "Recommended Specification"]
    rows11 = [
        ["Client (User Machine)", "Processor", "Intel Core i3 8th Gen / AMD Ryzen 3", "Intel Core i5 / AMD Ryzen 5 or higher"],
        ["Client (User Machine)", "RAM", "4 GB RAM", "8 GB DDR4 RAM or higher"],
        ["Client (User Machine)", "Peripherals", "Standard Webcam & Integrated Mic", "720p HD Webcam & Noise-cancelling Headset"],
        ["Client (User Machine)", "Web Browser", "Chrome 90+ / Firefox 88+ / Edge", "Latest Google Chrome or Microsoft Edge"],
        ["Client (User Machine)", "Network Bandwidth", "1.5 Mbps broadband connection", "10+ Mbps high-speed Wi-Fi / Ethernet"],
        ["Server (Host Machine)", "Runtime Environment", "Node.js v18.0.0 or higher", "Node.js v20 LTS / v22 Current"],
        ["Server (Host Machine)", "Database Engine", "PostgreSQL 14+ or SQLite dev", "PostgreSQL 16 with Connection Pooling"],
        ["Server (Host Machine)", "Development Tools", "VS Code, Git 2.30+, npm 9+", "VS Code, Docker Desktop, Postman"]
    ]
    add_table(s11, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.0), headers11, rows11, [Inches(2.4), Inches(2.3), Inches(3.5), Inches(3.533)])

    # -------------------------------------------------------------
    # SLIDE 12: System Flowchart
    # -------------------------------------------------------------
    s12 = prs.slides.add_slide(blank_layout)
    add_header(s12, "System Flow Chart — Multi-Role Platform Journey")
    add_footer(s12, 12)

    chart_img = os.path.abspath("diagrams/system_flowchart.png")
    if os.path.exists(chart_img):
        s12.shapes.add_picture(chart_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        student_steps = [
            ("Step 1: Onboarding", "User registers or logs in via Google OAuth SSO / Email-Password credentials."),
            ("Step 2: Profile & Skill Setup", "User defines 'Skills I Want to Learn' and 'Skills I Can Teach'."),
            ("Step 3: Peer Match & Discovery", "Browses reciprocal matches or searches by skill domain & trust rating."),
            ("Step 4: Booking & Escrow", "Selects time slot; 1 Skill Token is locked in secure platform escrow."),
            ("Step 5: Calendar Sync", "Downloads .ics calendar invite or adds session to personal schedule."),
            ("Step 6: Live Classroom Entry", "Joins WebRTC virtual room (video, whiteboard, code editor, chat)."),
            ("Step 7: Feedback & Settlement", "Session concludes; token released to mentor; student submits rating & review.")
        ]
        for idx, (st_t, st_d) in enumerate(student_steps):
            top_st = Inches(1.55 + idx * 0.76)
            add_card(s12, Inches(0.8), top_st, Inches(11.733), Inches(0.68), "", [(st_t, st_d)], bg_color=CARD_BG, border_color=PRIMARY)

    # -------------------------------------------------------------
    # SLIDE 13: System Flowchart — Teacher / Mentor Workflow
    # -------------------------------------------------------------
    s13 = prs.slides.add_slide(blank_layout)
    add_header(s13, "System Flowchart — Teacher & Mentor Workflow")
    add_footer(s13, 13)

    teacher_steps = [
        ("Step 1: Skill Verification", "Mentor lists topics of expertise, bio, and weekly availability schedule."),
        ("Step 2: Request Notification", "Receives real-time notification of pending session booking from peer."),
        ("Step 3: Acceptance & Confirmation", "Reviews student learning agenda and confirms scheduled session time."),
        ("Step 4: Room Preparation", "Enters classroom; whiteboard canvas and code editor initialize automatically."),
        ("Step 5: Live Mentorship Delivery", "Instructs via P2P video, live coding exercises, and whiteboard diagrams."),
        ("Step 6: Session Conclusion", "Marks session as completed; both parties sign off from the room."),
        ("Step 7: Token Reward & Trust Update", "1 Skill Token is deposited into mentor's balance; trust score recalculates.")
    ]
    for idx, (te_t, te_d) in enumerate(teacher_steps):
        top_te = Inches(1.55 + idx * 0.76)
        add_card(s13, Inches(0.8), top_te, Inches(11.733), Inches(0.68), "", [(te_t, te_d)], bg_color=CARD_BG, border_color=SECONDARY)

    # -------------------------------------------------------------
    # SLIDE 14: System Flowchart — Admin Workflow
    # -------------------------------------------------------------
    s14 = prs.slides.add_slide(blank_layout)
    add_header(s14, "System Flowchart — Administrator Management Workflow")
    add_footer(s14, 14)

    admin_steps = [
        ("Step 1: Admin Authentication", "Administrator logs in through protected portal with elevated role permissions."),
        ("Step 2: Platform Analytics Review", "Inspects total active users, completed sessions, token velocity & ratings."),
        ("Step 3: User Moderation", "Audits user accounts, handles community reports, and suspends malicious actors."),
        ("Step 4: Skill Taxonomy Governance", "Approves new subject categories, merges duplicates, and curates topics."),
        ("Step 5: Dispute & Escrow Resolution", "Resolves unfulfilled sessions or connection disputes and executes token refunds."),
        ("Step 6: System Health Monitoring", "Verifies Socket.io signaling stability, WebRTC TURN usage, and DB metrics.")
    ]
    for idx, (ad_t, ad_d) in enumerate(admin_steps):
        top_ad = Inches(1.6 + idx * 0.88)
        add_card(s14, Inches(0.8), top_ad, Inches(11.733), Inches(0.78), "", [(ad_t, ad_d)], bg_color=CARD_BG, border_color=DARK_BG)

    # -------------------------------------------------------------
    # SLIDE 15: Entity-Relationship (E-R) Diagram
    # -------------------------------------------------------------
    s15 = prs.slides.add_slide(blank_layout)
    add_header(s15, "Entity-Relationship (E-R) Diagram")
    add_footer(s15, 15)

    er_img = os.path.abspath("diagrams/er_diagram.png")
    if os.path.exists(er_img):
        s15.shapes.add_picture(er_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        er_entities = [
            ("USER Entity", [
                ("Primary Key", "id (UUID)"),
                ("Attributes", "name, email, role, tokenBalance, trustScore, avatarUrl"),
                ("Relations", "Teaches Sessions (1:M), Learns Sessions (1:M), Transactions (1:M), Reviews (1:M)")
            ]),
            ("SKILL Entity", [
                ("Primary Key", "id (UUID)"),
                ("Attributes", "name, category, description"),
                ("Relations", "UserSkill Join (1:M), Associated Sessions (1:M)")
            ]),
            ("USERSKILL Entity", [
                ("Primary Key", "id (UUID)"),
                ("Foreign Keys", "userId (FK -> User), skillId (FK -> Skill)"),
                ("Attributes", "type ('teaches' | 'wants_to_learn')")
            ]),
            ("SESSION Entity", [
                ("Primary Key", "id (UUID)"),
                ("Foreign Keys", "teacherId (FK -> User), studentId (FK -> User), skillId (FK)"),
                ("Attributes", "title, status, scheduledAt, durationMin")
            ]),
            ("TRANSACTION Entity", [
                ("Primary Key", "id (UUID)"),
                ("Foreign Keys", "userId (FK -> User)"),
                ("Attributes", "amount, type (earned | spent | refund), description, createdAt")
            ]),
            ("REVIEW Entity", [
                ("Primary Key", "id (UUID)"),
                ("Foreign Keys", "sessionId (FK), reviewerId (FK), revieweeId (FK)"),
                ("Attributes", "rating (1 to 5), comment, createdAt")
            ])
        ]
        for idx, (e_name, e_details) in enumerate(er_entities):
            col = idx % 3
            row = idx // 3
            left = Inches(0.8 + col * 4.0)
            top = Inches(1.6 + row * 2.65)
            add_card(s15, left, top, Inches(3.733), Inches(2.45), e_name, e_details, header_color=PRIMARY_DARK)

    # -------------------------------------------------------------
    # SLIDE 16: E-R Diagram Entities & Cardinalities
    # -------------------------------------------------------------
    s16 = prs.slides.add_slide(blank_layout)
    add_header(s16, "E-R Diagram Cardinalities & Structural Constraints")
    add_footer(s16, 16)

    headers16 = ["Primary Entity", "Related Entity", "Cardinality", "Relationship Description", "Integrity Rule"]
    rows16 = [
        ["User", "Session (as Teacher)", "1 : M (One-to-Many)", "One user can mentor multiple sessions over time", "ON DELETE RESTRICT"],
        ["User", "Session (as Student)", "1 : M (One-to-Many)", "One user can enroll in multiple learning sessions", "ON DELETE RESTRICT"],
        ["User", "UserSkill", "1 : M (One-to-Many)", "One user can possess multiple skills taught or wanted", "ON DELETE CASCADE"],
        ["Skill", "UserSkill", "1 : M (One-to-Many)", "One skill can be referenced by many student profiles", "ON DELETE RESTRICT"],
        ["User", "Transaction", "1 : M (One-to-Many)", "One user account owns multiple token ledger entries", "ON DELETE CASCADE"],
        ["Session", "Review", "1 : 1 (One-to-One)", "Each completed session generates exactly one verified review", "ON DELETE CASCADE"],
        ["User", "Message", "1 : M (One-to-Many)", "One user sends/receives multiple direct chat messages", "ON DELETE CASCADE"]
    ]
    add_table(s16, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.0), headers16, rows16, [Inches(1.8), Inches(2.2), Inches(1.8), Inches(3.933), Inches(2.0)])

    # -------------------------------------------------------------
    # SLIDE 17: Symbols of Data Flow Diagram (DFD)
    # -------------------------------------------------------------
    s17 = prs.slides.add_slide(blank_layout)
    add_header(s17, "Symbols of Data Flow Diagram (DFD)")
    add_footer(s17, 17)

    symbols_img = os.path.abspath("diagrams/dfd_symbols.png")
    if os.path.exists(symbols_img):
        s17.shapes.add_picture(symbols_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        headers17 = ["Sr No.", "Symbol Name", "Diagrammatic Representation", "Function & Usage in Mindroot DFD"]
        rows17 = [
            ["1", "Data Flow", "Directed Arrow (----->)", "Represents transmission of information (e.g. login credentials, WebRTC SDP tokens, session requests)"],
            ["2", "Process", "Circle / Rounded Rectangle", "Represents an automated transformation or algorithm (e.g. 1.0 Matchmaking, 2.0 Token Escrow, 3.0 Calculate Trust Score)"],
            ["3", "External Entity", "Solid Rectangle [  ]", "Represents an external originator or recipient of data (e.g. Student, Mentor, Administrator, Google OAuth Service)"],
            ["4", "Data Store", "Open-Ended Rectangle [=]", "Represents a persistent storage repository (e.g. Users Table, Sessions Table, Token Ledger, Skills Store)"]
        ]
        add_table(s17, Inches(0.8), Inches(1.6), Inches(11.733), Inches(4.8), headers17, rows17, [Inches(1.0), Inches(2.3), Inches(3.2), Inches(5.233)])

    # -------------------------------------------------------------
    # SLIDE 18: Context Level DFD (Level 0)
    # -------------------------------------------------------------
    s18 = prs.slides.add_slide(blank_layout)
    add_header(s18, "Data Flow Diagram — Context Level (Level 0)")
    add_footer(s18, 18)

    dfd0_img = os.path.abspath("diagrams/dfd_level_0.png")
    if os.path.exists(dfd0_img):
        s18.shapes.add_picture(dfd0_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        add_card(s18, Inches(0.8), Inches(1.6), Inches(3.6), Inches(5.0), "External Entity: Student / Learner", [
            ("Inputs to System", "Registration data, learning skill preferences, mentor search queries, booking requests, WebRTC offer/answer, session ratings."),
            ("Outputs from System", "Matched peer profiles, booking confirmations, .ics calendar invitations, live audio/video feeds, whiteboard updates, token balance status.")
        ], header_color=PRIMARY_DARK)

        add_card(s18, Inches(4.866), Inches(1.6), Inches(3.6), Inches(5.0), "Central Process: 0.0 Mindroot", [
            ("Core Function", "Acts as the central coordination engine mediating peer matchmaking, token time-banking, WebRTC signaling, and session lifecycles."),
            ("Data Stores Accessed", "User DB, Skills Registry, Session Schedules, Token Ledger, Review Archives."),
            ("Security Boundary", "Enforces JWT verification, escrow locking, and role-based permissions.")
        ], bg_color=WHITE, border_color=PRIMARY, header_color=PRIMARY_DARK)

        add_card(s18, Inches(8.933), Inches(1.6), Inches(3.6), Inches(5.0), "External Entity: Teacher & Admin", [
            ("Mentor Data Flows", "Teaching competencies, schedule availability, session confirmations, live instruction streams, token payouts."),
            ("Admin Data Flows", "System health queries, user moderation actions, skill taxonomy curations, dispute arbitration, financial and token velocity audits.")
        ], header_color=DARK_BG)

    # -------------------------------------------------------------
    # SLIDE 19: DFD Level 1 — User Perspective
    # -------------------------------------------------------------
    s19 = prs.slides.add_slide(blank_layout)
    add_header(s19, "Data Flow Diagram — Level 1 (User Perspective)")
    add_footer(s19, 19)

    dfd_u_img = os.path.abspath("diagrams/dfd_user_level1.png")
    if os.path.exists(dfd_u_img):
        s19.shapes.add_picture(dfd_u_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        dfd_auth = [
            ("Process 1.1: Registration & Google SSO", "Receives raw email/password or Google ID token; validates cryptographic signature; provisions new User record with initial 4 Skill Tokens."),
            ("Process 1.2: Skill Preference Assignment", "User tags competencies into 'teaches' and 'wants_to_learn'; writes join records to `UserSkill` store."),
            ("Process 1.3: Token Balance & Wallet Init", "Initializes ledger entry in `Transaction` table recording welcome bonus tokens."),
            ("Process 1.4: Dynamic Trust Score Calculation", "Queries `Review` store; runs weighted mean algorithm to generate live public rating (1.0 to 5.0).")
        ]
        for idx, (p_t, p_d) in enumerate(dfd_auth):
            top_p = Inches(1.6 + idx * 1.3)
            add_card(s19, Inches(0.8), top_p, Inches(11.733), Inches(1.15), "", [(p_t, p_d)])

    # -------------------------------------------------------------
    # SLIDE 20: DFD Level 1 — Admin Perspective
    # -------------------------------------------------------------
    s20 = prs.slides.add_slide(blank_layout)
    add_header(s20, "Data Flow Diagram — Level 1 (Admin Perspective)")
    add_footer(s20, 20)

    dfd_a_img = os.path.abspath("diagrams/dfd_admin_level1.png")
    if os.path.exists(dfd_a_img):
        s20.shapes.add_picture(dfd_a_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        dfd_match = [
            ("Process 2.1: Skill Index Query", "Student enters target topic; query engine indexes `Skill` and `UserSkill` stores for verified mentors."),
            ("Process 2.2: Compatibility Matrix Matcher", "Calculates bidirectional match score: checks if Mentor's desired learning skills intersect with Student's teaching repertoire."),
            ("Process 2.3: Mentor Availability Filter", "Correlates mentor active status and avoids conflicting sessions in `Session` table."),
            ("Process 2.4: Peer Profile & Review Aggregation", "Streams enriched candidate cards showing bio, trust score, past student reviews, and token rate.")
        ]
        for idx, (p_t, p_d) in enumerate(dfd_match):
            top_p = Inches(1.6 + idx * 1.3)
            add_card(s20, Inches(0.8), top_p, Inches(11.733), Inches(1.15), "", [(p_t, p_d)])

    # -------------------------------------------------------------
    # SLIDE 21: DFD Level 1 — Booking, Escrow & Scheduling
    # -------------------------------------------------------------
    s21 = prs.slides.add_slide(blank_layout)
    add_header(s21, "DFD Level 1 — Booking, Escrow & Scheduling (Process 3.0)")
    add_footer(s21, 21)

    dfd_book = [
        ("Process 3.1: Session Request Handler", "Learner submits proposed time slot; system verifies both peers' calendar availability."),
        ("Process 3.2: Atomic Token Escrow Lock", "Verifies Student has >= 1 token; decrements visible balance and holds 1 token in pending escrow state."),
        ("Process 3.3: Socket Notification Dispatch", "Pushes real-time WebSocket invite to Mentor; updates session status to 'confirmed' upon acceptance."),
        ("Process 3.4: iCalendar (.ics) Generator", "Formats standard RFC 5545 calendar file; allows one-click import into Google Calendar, Outlook, and Apple iCal.")
    ]
    for idx, (p_t, p_d) in enumerate(dfd_book):
        top_p = Inches(1.6 + idx * 1.3)
        add_card(s21, Inches(0.8), top_p, Inches(11.733), Inches(1.15), "", [(p_t, p_d)])

    # -------------------------------------------------------------
    # SLIDE 22: WebRTC P2P Signaling & Virtual Classroom
    # -------------------------------------------------------------
    s22 = prs.slides.add_slide(blank_layout)
    add_header(s22, "Real-Time WebRTC P2P Signaling & Media Flow Architecture")
    add_footer(s22, 22)

    webrtc_img = os.path.abspath("diagrams/webrtc_diagram.png")
    if os.path.exists(webrtc_img):
        s22.shapes.add_picture(webrtc_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        webrtc_cards = [
            ("1. Signaling Channel (Socket.io)", [
                ("Room Scoping", "Peers join dedicated session room `session:<id>`."),
                ("SDP Exchange", "Exchanges Session Description Protocol (SDP) Offer & Answer payloads."),
                ("Zero Media Overhead", "Server only handles tiny signaling text packets, never heavy video.")
            ]),
            ("2. NAT & Firewall Traversal", [
                ("ICE Gathering", "Interactive Connectivity Establishment resolves local/public IP endpoints."),
                ("STUN / TURN", "Google STUN servers discover public IPs; TURN relays fallback packets across symmetric corporate NATs.")
            ]),
            ("3. Direct P2P Media Streaming", [
                ("Ultra-Low Latency", "Direct browser-to-browser UDP stream with sub-150ms roundtrip delay."),
                ("DTLS / SRTP", "Military-grade end-to-end encryption for all audio, video, and screen sharing.")
            ]),
            ("4. DataChannel Collaboration", [
                ("Whiteboard Canvas", "Real-time vector synchronization of pen strokes, colors, and shapes."),
                ("Live Code Editor", "Synchronized keystroke streaming and syntax highlighting.")
            ])
        ]
        for idx, (w_t, w_items) in enumerate(webrtc_cards):
            col = idx % 2
            row = idx // 2
            left = Inches(0.8 + col * 6.0)
            top = Inches(1.6 + row * 2.65)
            add_card(s22, left, top, Inches(5.7), Inches(2.45), w_t, w_items, header_color=PRIMARY_DARK)

    # -------------------------------------------------------------
    # SLIDE 23: Data Dictionary Overview
    # -------------------------------------------------------------
    s23 = prs.slides.add_slide(blank_layout)
    add_header(s23, "Data Dictionary — Relational Schema Architecture")
    add_footer(s23, 23)

    add_card(s23, Inches(0.8), Inches(1.6), Inches(11.733), Inches(2.4), "Data Dictionary Design Principles", [
        ("Type-Safe Integrity via Prisma", "All models are declared declaratively in `server/prisma/schema.prisma` with strict PostgreSQL data types, non-nullable constraints, and default generators."),
        ("Referential Integrity & Cascading", "Foreign keys enforce relationship consistency: deleting a user cascades to join skills and transaction logs while restricting deletion of active sessions."),
        ("Auditability & Scalability", "Every financial token movement and peer review is permanently timestamped with UTC precision.")
    ])

    add_card(s23, Inches(0.8), Inches(4.3), Inches(11.733), Inches(2.4), "Summary of Relational Tables", [
        ("1. User Table (`User`)", "Stores user identities, authentication hashes, token wallets, and trust scores."),
        ("2. Skill & UserSkill Tables", "Normalizes skill taxonomies and maps M:N peer competence associations."),
        ("3. Session Table (`Session`)", "Tracks booking states, timestamps, duration, and assigned virtual rooms."),
        ("4. Transaction Table (`Transaction`)", "Provides an immutable financial audit ledger of Skill Token velocity."),
        ("5. Review & Message Tables", "Stores post-session peer ratings and in-platform messaging threads.")
    ])

    # -------------------------------------------------------------
    # SLIDE 24: Data Dictionary — User Table
    # -------------------------------------------------------------
    s24 = prs.slides.add_slide(blank_layout)
    add_header(s24, "Data Dictionary — User Table (`User`)")
    add_footer(s24, 24)

    headers24 = ["Field Name", "Data Type", "Constraint", "Default Value", "Description & Field Purpose"]
    rows24 = [
        ["id", "String (UUID)", "Primary Key", "uuid()", "Unique system identifier for the registered user"],
        ["name", "VarChar(100)", "NOT NULL", "None", "Full legal or display name of the student"],
        ["email", "VarChar(150)", "Unique, NOT NULL", "None", "Verified institutional or personal email address"],
        ["password", "VarChar(255)", "NULLABLE", "None", "Bcrypt encrypted password hash (null for Google SSO)"],
        ["role", "VarChar(20)", "NOT NULL", "'student'", "Access role: 'student', 'teacher', 'both', or 'admin'"],
        ["tokenBalance", "Integer", "NOT NULL", "4", "Current balance of Skill Tokens (initial 4 bonus tokens)"],
        ["trustScore", "Float", "NOT NULL", "5.0", "Dynamic trust rating derived from peer reviews (1.0 to 5.0)"],
        ["avatarUrl", "Text", "NULLABLE", "None", "URL path to hosted user profile photo"],
        ["createdAt", "DateTime", "NOT NULL", "now()", "Timestamp when the user account was provisioned"]
    ]
    add_table(s24, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.0), headers24, rows24, [Inches(1.8), Inches(1.8), Inches(2.0), Inches(1.5), Inches(4.633)])

    # -------------------------------------------------------------
    # SLIDE 25: Data Dictionary — Skill & UserSkill Tables
    # -------------------------------------------------------------
    s25 = prs.slides.add_slide(blank_layout)
    add_header(s25, "Data Dictionary — Skill & UserSkill Join Tables")
    add_footer(s25, 25)

    headers25 = ["Field Name", "Data Type", "Constraint", "Description & Field Purpose"]
    rows25_1 = [
        ["id", "String (UUID)", "Primary Key", "Unique identifier for the skill entity"],
        ["name", "VarChar(100)", "Unique, NOT NULL", "Human-readable skill title (e.g., Python, React, UI Design)"],
        ["category", "VarChar(100)", "NOT NULL", "Domain category (e.g., 'Software & AI', 'Design', 'Languages')"]
    ]
    rows25_2 = [
        ["id", "String (UUID)", "Primary Key", "Unique identifier for the join association"],
        ["userId", "String (UUID)", "Foreign Key -> User.id", "References the associated user (ON DELETE CASCADE)"],
        ["skillId", "String (UUID)", "Foreign Key -> Skill.id", "References the associated skill (ON DELETE RESTRICT)"],
        ["type", "VarChar(20)", "NOT NULL", "Specifies capability: 'teaches' OR 'wants_to_learn'"]
    ]
    add_card(s25, Inches(0.8), Inches(1.5), Inches(11.733), Inches(0.4), "Table 1: `Skill` Master Table", [])
    add_table(s25, Inches(0.8), Inches(2.0), Inches(11.733), Inches(1.8), headers25, rows25_1, [Inches(1.8), Inches(2.2), Inches(2.5), Inches(5.233)])

    add_card(s25, Inches(0.8), Inches(4.1), Inches(11.733), Inches(0.4), "Table 2: `UserSkill` Relational Join Table", [])
    add_table(s25, Inches(0.8), Inches(4.6), Inches(11.733), Inches(2.2), headers25, rows25_2, [Inches(1.8), Inches(2.2), Inches(2.5), Inches(5.233)])

    # -------------------------------------------------------------
    # SLIDE 26: Data Dictionary — Session Table
    # -------------------------------------------------------------
    s26 = prs.slides.add_slide(blank_layout)
    add_header(s26, "Data Dictionary — Session Table (`Session`)")
    add_footer(s26, 26)

    headers26 = ["Field Name", "Data Type", "Constraint", "Default", "Description & Field Purpose"]
    rows26 = [
        ["id", "String (UUID)", "Primary Key", "uuid()", "Unique identifier for the booked classroom session"],
        ["title", "VarChar(150)", "NOT NULL", "None", "Session topic summary (e.g. 'React ↔ Python Skill Swap')"],
        ["teacherId", "String (UUID)", "Foreign Key -> User.id", "None", "User ID of the mentor conducting the session"],
        ["studentId", "String (UUID)", "Foreign Key -> User.id", "None", "User ID of the learner attending the session"],
        ["skillId", "String (UUID)", "Foreign Key -> Skill.id", "None", "Optional specific skill being taught"],
        ["status", "VarChar(20)", "NOT NULL", "'pending'", "State: 'pending', 'confirmed', 'live', 'completed', 'cancelled'"],
        ["scheduledAt", "DateTime", "NOT NULL", "None", "Scheduled date and start time for the classroom"],
        ["durationMin", "Integer", "NOT NULL", "60", "Planned session duration in minutes (standard: 60 min)"]
    ]
    add_table(s26, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.0), headers26, rows26, [Inches(1.8), Inches(1.8), Inches(2.5), Inches(1.2), Inches(4.433)])

    # -------------------------------------------------------------
    # SLIDE 27: Data Dictionary — Transaction Table
    # -------------------------------------------------------------
    s27 = prs.slides.add_slide(blank_layout)
    add_header(s27, "Data Dictionary — Token Transaction Table (`Transaction`)")
    add_footer(s27, 27)

    headers27 = ["Field Name", "Data Type", "Constraint", "Description & Field Purpose"]
    rows27 = [
        ["id", "String (UUID)", "Primary Key", "Unique identifier for the financial ledger transaction"],
        ["userId", "String (UUID)", "Foreign Key -> User.id", "User account associated with this token movement (ON DELETE CASCADE)"],
        ["amount", "Integer", "NOT NULL", "Number of tokens moved (+1 for teaching credit, -1 for learning debit)"],
        ["type", "VarChar(20)", "NOT NULL", "Transaction category: 'earned', 'spent', 'escrow_hold', 'refund', 'bonus'"],
        ["description", "VarChar(255)", "NOT NULL", "Audit note (e.g. 'Completed 1 hr React session with Patel Happy')"],
        ["createdAt", "DateTime", "NOT NULL, now()", "Immutable timestamp of ledger settlement"]
    ]
    add_table(s27, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.0), headers27, rows27, [Inches(1.8), Inches(2.0), Inches(2.5), Inches(5.433)])

    # -------------------------------------------------------------
    # SLIDE 28: Data Dictionary — Review Table
    # -------------------------------------------------------------
    s28 = prs.slides.add_slide(blank_layout)
    add_header(s28, "Data Dictionary — Review Table (`Review`)")
    add_footer(s28, 28)

    headers28 = ["Field Name", "Data Type", "Constraint", "Description & Field Purpose"]
    rows28 = [
        ["id", "String (UUID)", "Primary Key", "Unique identifier for the review entry"],
        ["sessionId", "String (UUID)", "Unique, FK -> Session.id", "Links review to verified completed session (prevents fake reviews)"],
        ["reviewerId", "String (UUID)", "Foreign Key -> User.id", "User submitting the feedback rating"],
        ["revieweeId", "String (UUID)", "Foreign Key -> User.id", "User receiving the rating (mentor or student)"],
        ["rating", "Integer", "NOT NULL (1 to 5)", "Numerical satisfaction score awarded (1=Poor to 5=Excellent)"],
        ["comment", "Text", "NULLABLE", "Written qualitative review and feedback notes"],
        ["createdAt", "DateTime", "NOT NULL, now()", "Timestamp when feedback was submitted"]
    ]
    add_table(s28, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.0), headers28, rows28, [Inches(1.8), Inches(2.2), Inches(2.5), Inches(5.233)])

    # -------------------------------------------------------------
    # SLIDE 29: Data Dictionary — Message Table
    # -------------------------------------------------------------
    s29 = prs.slides.add_slide(blank_layout)
    add_header(s29, "Data Dictionary — Direct Message Table (`Message`)")
    add_footer(s29, 29)

    headers29 = ["Field Name", "Data Type", "Constraint", "Description & Field Purpose"]
    rows29 = [
        ["id", "String (UUID)", "Primary Key", "Unique identifier for the chat message"],
        ["senderId", "String (UUID)", "Foreign Key -> User.id", "User transmitting the message"],
        ["receiverId", "String (UUID)", "Foreign Key -> User.id", "Recipient user account"],
        ["content", "Text", "NOT NULL", "Encrypted or sanitized text content of the message"],
        ["isRead", "Boolean", "NOT NULL, default false", "Status indicator for delivery and read receipts"],
        ["createdAt", "DateTime", "NOT NULL, now()", "Timestamp when message was stored and relayed"]
    ]
    add_table(s29, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.0), headers29, rows29, [Inches(1.8), Inches(2.2), Inches(2.5), Inches(5.233)])

    # -------------------------------------------------------------
    # SLIDE 30: System UI Walkthrough — Overview & Hierarchy
    # -------------------------------------------------------------
    s30 = prs.slides.add_slide(blank_layout)
    add_header(s30, "System UI Walkthrough — Overview & Screen Layout Hierarchy")
    add_footer(s30, 30)

    add_card(s30, Inches(0.8), Inches(1.6), Inches(11.733), Inches(2.4), "UI / UX Design Philosophy", [
        ("Tailwind CSS Precision", "Clean modern aesthetics with an Emerald / Deep Slate theme, responsive breakpoints for desktop and mobile, and micro-interactions via Framer Motion."),
        ("Information Density with Clarity", "Designed specifically for intensive academic tasks: quick-glance token badges, prominent video feeds, and clutter-free sidebar navigation."),
        ("Zero Latency Feedback", "Instant toast notifications for incoming invites, token updates, and connection statuses.")
    ])

    add_card(s30, Inches(0.8), Inches(4.3), Inches(11.733), Inches(2.4), "Presentation of 7 Key Functional Screens", [
        ("Screen 1: Landing & Value Proposition", "Hero section, statistics counter, and feature highlights."),
        ("Screen 2: Authentication & Google SSO", "Secure credential entry and single sign-on modal."),
        ("Screen 3: Peer Discovery & Matchmaker", "Dual skill filter cards with mutual compatibility indicators."),
        ("Screen 4: Booking & .ics Calendar", "Schedule picker with token escrow indicator and calendar export."),
        ("Screen 5: Live P2P Virtual Classroom", "WebRTC video/audio feeds with in-room chat sidebar."),
        ("Screen 6: Collaborative Whiteboard & Code", "Dual canvas drawing board and live syntax-highlighted code editor."),
        ("Screen 7: Admin Analytics & Governance", "User management, token velocity charts, and dispute console.")
    ])

    # -------------------------------------------------------------
    # SLIDE 31: Screen 1 — Home & Landing Page
    # -------------------------------------------------------------
    s31 = prs.slides.add_slide(blank_layout)
    add_header(s31, "Screen 1 — Landing Page & Platform Feature Showcase")
    add_footer(s31, 31)

    ui1_img = os.path.abspath("diagrams/ui_landing.png")
    if os.path.exists(ui1_img):
        s31.shapes.add_picture(ui1_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        add_card(s31, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.0), "Interface Component Breakdown", [
            ("Hero Navigation Bar", "Displays Mindroot branding, Live Session count, Token Balance counter, and Navigation links (Explore, Sessions, Messages, Profile)."),
            ("Value Proposition Banner", "Prominent headline: 'Trade Knowledge, Not Money — Learn Anything From Peers in Real Time'."),
            ("Live Ecosystem Counter", "Dynamic counters showcasing Total Active Students, Sessions Delivered, and Skill Categories."),
            ("Skill Taxonomy Carousel", "Quick category filters: Web Development, Machine Learning, UI/UX Design, Data Structures, Languages.")
        ])

        add_card(s31, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.0), "Key Operational Highlights", [
            ("Responsive Layout", "Built with Tailwind CSS grid for flawless rendering on laptops, tablets, and smartphones."),
            ("Instant Call-To-Action", "'Find a Mentor' and 'Start Teaching' buttons route directly to onboarded match filters."),
            ("Zero Marketing Clutter", "Focused entirely on immediate student utility, upcoming scheduled sessions, and token rewards.")
        ], bg_color=WHITE, border_color=PRIMARY)

    # -------------------------------------------------------------
    # SLIDE 32: Screen 2 — Authentication & Google OAuth SSO
    # -------------------------------------------------------------
    s32 = prs.slides.add_slide(blank_layout)
    add_header(s32, "Screen 2 — Authentication & Google OAuth 2.0 Single Sign-On")
    add_footer(s32, 32)

    add_card(s32, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.0), "Dual Authentication Architecture", [
        ("Google OAuth 2.0 Integration", "One-click institutional or personal Google login using `@react-oauth/google` and backend `google-auth-library` verification."),
        ("Zero Password Friction", "Cryptographically verifies Google ID tokens, extracts user avatar and verified email, eliminating forgotten passwords."),
        ("Standard Credential Fallback", "Includes Bcrypt-hashed email/password authentication for environments without Google Client ID configuration.")
    ])

    add_card(s32, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.0), "Security & Session Handling", [
        ("JWT Token Generation", "Signs stateless JSON Web Tokens containing `userId` and `role` with 7-day expiration."),
        ("Automatic Welcome Bonus", "New student registrations automatically receive 4 initial Skill Tokens in their wallet."),
        ("Role Protection", "Route guards automatically redirect unauthorized users from protected classroom views.")
    ], bg_color=WHITE, border_color=SECONDARY)

    # -------------------------------------------------------------
    # SLIDE 33: Screen 3 — Peer Discovery & Skill Matchmaker
    # -------------------------------------------------------------
    s33 = prs.slides.add_slide(blank_layout)
    add_header(s33, "Screen 3 — Peer Discovery & Reciprocal Matchmaker")
    add_footer(s33, 33)

    ui2_img = os.path.abspath("diagrams/ui_matchmaker.png")
    if os.path.exists(ui2_img):
        s33.shapes.add_picture(ui2_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        add_card(s33, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.0), "Peer Card UI Elements", [
            ("Mentor Identity & Trust", "Displays student name, avatar, university department, and dynamic trust rating badge (e.g. '★ 4.9 (18 reviews)')."),
            ("Skills Offered ('Teaches')", "Highlighted green pill badges displaying technical or academic competencies."),
            ("Skills Desired ('Wants to Learn')", "Outlined blue pill badges showing topics the peer wants to receive tutoring in."),
            ("Mutual Match Indicator", "Golden '100% Mutual Match' badge highlighted when both users have reciprocal complementary skills.")
        ])

        add_card(s33, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.0), "Search & Filter Mechanics", [
            ("Instant Keyword Search", "Debounced search bar filtering across mentor names, skills, and topic tags."),
            ("Domain Category Filter", "Quick toggle between Software & AI, Design & 3D, Languages, and Business."),
            ("Direct Action Buttons", "'Book Session' launches the scheduling modal; 'Message' initiates direct chat.")
        ], bg_color=WHITE, border_color=PRIMARY)

    # -------------------------------------------------------------
    # SLIDE 34: Screen 4 — Booking & Calendar Integration
    # -------------------------------------------------------------
    s34 = prs.slides.add_slide(blank_layout)
    add_header(s34, "Screen 4 — Session Booking, Escrow & .ics Calendar Sync")
    add_footer(s34, 34)

    add_card(s34, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.0), "Booking Workflow & Token Escrow", [
        ("Slot Selection Modal", "Interactive date picker and time slot selector with timezone awareness."),
        ("Token Cost Notice", "Explicitly warns: '1 Skill Token will be held in escrow until session completion'."),
        ("Topic & Agenda Notes", "Student inputs session objectives (e.g. 'Help me debug my binary search tree in C++')."),
        ("Instant Real-Time Confirmation", "Emits Socket.io event to mentor with Accept/Decline prompts.")
    ])

    add_card(s34, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.0), "Automated .ics Calendar Export", [
        ("RFC 5545 Compliance", "Backend generates downloadable `.ics` calendar invitation file with unique UID."),
        ("Pre-Filled Meeting Link", "Calendar invite contains direct classroom URL (`/classroom?session=...`)."),
        ("Universal Compatibility", "One-click sync with Google Calendar, Microsoft Outlook, and Apple Calendar.")
    ], bg_color=WHITE, border_color=SECONDARY)

    # -------------------------------------------------------------
    # SLIDE 35: Screen 5 — Live P2P Virtual Classroom
    # -------------------------------------------------------------
    s35 = prs.slides.add_slide(blank_layout)
    add_header(s35, "Screen 5 — Live Virtual Classroom (P2P Video, Audio & Chat)")
    add_footer(s35, 35)

    ui3_img = os.path.abspath("diagrams/ui_classroom.png")
    if os.path.exists(ui3_img):
        s35.shapes.add_picture(ui3_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        add_card(s35, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.0), "Media Stream Architecture", [
            ("Dual Video Tiles", "Teacher and student video streams displayed side-by-side with picture-in-picture capability."),
            ("Media Controls Bar", "One-click toggle buttons for Microphone Mute, Camera On/Off, and Screen Sharing."),
            ("Active Speaker Highlighting", "Visual border pulsing when peer audio is active."),
            ("Connection Quality Indicator", "Real-time ping monitor showing WebRTC P2P latency.")
        ])

        add_card(s35, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.0), "In-Room Integrated Chat", [
            ("Live Text Messaging", "Allows sharing code snippets, references, and hyperlinks during video call."),
            ("Session Timer", "Live countdown timer showing remaining classroom minutes."),
            ("End Session & Settle Button", "Mentor triggers completion; unlocks token escrow and presents review modal.")
        ], bg_color=WHITE, border_color=PRIMARY)

    # -------------------------------------------------------------
    # SLIDE 36: Screen 6 — Whiteboard & Live Code Editor
    # -------------------------------------------------------------
    s36 = prs.slides.add_slide(blank_layout)
    add_header(s36, "Screen 6 — Collaborative Whiteboard & Synchronized Code Editor")
    add_footer(s36, 36)

    add_card(s36, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.0), "Interactive Vector Whiteboard", [
        ("Real-Time Drawing Canvas", "HTML5 canvas synchronized over WebRTC DataChannels or WebSocket events."),
        ("Tool Palette", "Pen, Highlighter, Geometric Shapes (Rectangle, Circle, Arrow), Text annotations, and Eraser."),
        ("Color & Stroke Controls", "Custom color picker and line thickness adjustments for engineering diagrams.")
    ])

    add_card(s36, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.0), "In-Browser Synchronized Code Editor", [
        ("Multi-Language Support", "Syntax highlighting for JavaScript, TypeScript, Python, C++, and HTML/CSS."),
        ("Pair Programming Mode", "Simultaneous cursor and text streaming for live collaborative debugging."),
        ("Zero External Tools", "Eliminates the need for external screensharing or heavy desktop IDE pairing.")
    ], bg_color=WHITE, border_color=SECONDARY)

    # -------------------------------------------------------------
    # SLIDE 37: Screen 7 — Admin Dashboard & Governance
    # -------------------------------------------------------------
    s37 = prs.slides.add_slide(blank_layout)
    add_header(s37, "Platform Analytics & Token Circulation Metrics")
    add_footer(s37, 37)

    analytics_img = os.path.abspath("diagrams/analytics_graphs.png")
    if os.path.exists(analytics_img):
        s37.shapes.add_picture(analytics_img, Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3))
    else:
        add_card(s37, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.0), "Administrative Telemetry", [
            ("Total User Metrics", "Card counters showing registered students, active mentors, and new signups."),
            ("Session Velocity Tracker", "Live charts tracking completed vs active classroom sessions."),
            ("Token Circulation Audit", "Monitors total minted, spent, and escrowed Skill Tokens across the network."),
            ("System Health Monitor", "Real-time status of Express REST API, PostgreSQL database, and Socket.io server.")
        ])

        add_card(s37, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.0), "Moderation & Governance Actions", [
            ("User Table Management", "Search, inspect, and freeze or delete abusive accounts with one click."),
            ("Skill Taxonomy Editor", "Add, merge, or deprecate subject categories in real time."),
            ("Dispute Arbitration Console", "Review disputed session reports and trigger manual token reimbursements.")
        ], bg_color=WHITE, border_color=DARK_BG)

    # -------------------------------------------------------------
    # SLIDE 38: Security & Trust Measures
    # -------------------------------------------------------------
    s38 = prs.slides.add_slide(blank_layout)
    add_header(s38, "Security, Trust & Data Integrity Measures")
    add_footer(s38, 38)

    sec_cards = [
        ("Stateless JWT Authentication", [
            ("Secure Signature", "Tokens signed using SHA-256 with environment secret keys."),
            ("Role Verification", "Middleware protects `/api/admin/*` and private session routes.")
        ]),
        ("End-to-End Media Privacy", [
            ("WebRTC DTLS / SRTP", "All audio, video, and whiteboard streams encrypted peer-to-peer."),
            ("No Media Snooping", "Signaling server relays connection handshakes without inspecting media.")
        ]),
        ("Atomic Escrow Transactions", [
            ("Double-Spend Prevention", "Database row locks ensure tokens cannot be spent concurrently."),
            ("Guaranteed Settlement", "Unfulfilled or interrupted sessions automatically refund escrowed tokens.")
        ]),
        ("Dynamic Trust Scoring", [
            ("Bayesian Weighting", "Prevents review bombing; gives higher weight to seasoned peer ratings."),
            ("Verified Reviews Only", "Reviews can only be authored after completing a verified 60-minute session.")
        ])
    ]
    for idx, (s_t, s_items) in enumerate(sec_cards):
        col = idx % 2
        row = idx // 2
        left = Inches(0.8 + col * 6.0)
        top = Inches(1.6 + row * 2.65)
        add_card(s38, left, top, Inches(5.7), Inches(2.45), s_t, s_items, header_color=PRIMARY_DARK)

    # -------------------------------------------------------------
    # SLIDE 39: Future Enhancements & Scope
    # -------------------------------------------------------------
    s39 = prs.slides.add_slide(blank_layout)
    add_header(s39, "Future Enhancements & Research Scope")
    add_footer(s39, 39)

    futures = [
        ("AI-Powered Semantic Matchmaker", "Implement vector embeddings (OpenAI / Gemini) to analyze student syllabi and match peers with complementary learning speeds."),
        ("Cross-Platform Mobile Application", "Build dedicated iOS and Android mobile apps using React Native with push notifications for instant session alerts."),
        ("Multi-Peer Group Study Cohorts", "Expand 1-on-1 WebRTC rooms into multi-student study circles using Selective Forwarding Units (SFU) architecture."),
        ("Automated AI Session Notes", "Integrate automated speech-to-text (Whisper) to generate key concept summaries and action items after each session."),
        ("Verifiable On-Chain Skill Badges", "Mint verifiable digital credentials or Soulbound NFT badges for students who complete milestone hours of peer teaching.")
    ]
    for idx, (f_t, f_d) in enumerate(futures):
        top_f = Inches(1.6 + idx * 1.05)
        add_card(s39, Inches(0.8), top_f, Inches(11.733), Inches(0.95), "", [(f_t, f_d)], bg_color=CARD_BG, border_color=PRIMARY)

    # -------------------------------------------------------------
    # SLIDE 40: Conclusion
    # -------------------------------------------------------------
    s40 = prs.slides.add_slide(blank_layout)
    add_header(s40, "Conclusion & Project Impact")
    add_footer(s40, 40)

    add_card(s40, Inches(0.8), Inches(1.6), Inches(11.733), Inches(2.5), "Project Conclusion & Synthesis", [
        ("Transformation of Peer Learning", "The Mindroot ('Student to Student') platform successfully solves the financial and logistical bottlenecks of traditional student mentorship. By synthesizing a Time-Banking Token Economy with zero-latency browser WebRTC audio/video, collaborative whiteboarding, live coding, and automated calendar export, it establishes a truly self-sustaining, democratic learning micro-economy."),
        ("Elimination of Educational Debt", "Students are empowered to monetize their strongest competencies into learning credits rather than paying expensive hourly fees to commercial tutors."),
        ("Reliability & Accountability", "Token escrow guarantees that scheduled sessions are delivered faithfully, reducing absentee rates and ghosting to zero.")
    ])

    add_card(s40, Inches(0.8), Inches(4.3), Inches(11.733), Inches(2.4), "Societal & Academic Benefits", [
        ("Institutional Community Growth", "Strengthens student-to-student bonding and cross-departmental collaboration across colleges and universities."),
        ("Comprehensive Academic Portfolio", "Provides an immutable, verified record of hours taught and trust ratings, serving as tangible proof of leadership and communication skills."),
        ("Extensibility for Future Research", "Architected with modular microservices and clean API contracts, ready for AI-powered semantic matching and mobile application deployment.")
    ], bg_color=WHITE, border_color=PRIMARY)

    # -------------------------------------------------------------
    # SLIDE 41: Bibliography & References
    # -------------------------------------------------------------
    s41 = prs.slides.add_slide(blank_layout)
    add_header(s41, "Bibliography & References")
    add_footer(s41, 41)

    headers41 = ["No.", "Resource Title", "Authors / Organization", "Publisher / Edition", "Domain Focus"]
    rows41 = [
        ["1", "Learning React: Modern Patterns for Developing React Apps", "Alex Banks & Eve Porcello", "O'Reilly Media, 2nd Edition", "Client-Side UI & State Management"],
        ["2", "WebRTC: APIs and RTCWEB Protocols of the HTML5 Real-Time Web", "Alan B. Johnston & Daniel C. Burnett", "Digital Media Advisors, 4th Edition", "P2P Video, Audio & ICE Signaling"],
        ["3", "Node.js Design Patterns: Design and implement production apps", "Mario Casciaro & Luciano Mammino", "Packt Publishing, 3rd Edition", "Asynchronous Backend & Architecture"],
        ["4", "Prisma ORM & PostgreSQL Official Architecture Guides", "Prisma Data, Inc. / The PostgreSQL Global Group", "Official Technical Documentation (2024)", "Database Modeling & Query Optimization"],
        ["5", "Internet Calendaring & Scheduling Core Object Spec (RFC 5545)", "B. Desruisseaux (Ed.)", "Internet Engineering Task Force (IETF)", "Automated .ics Calendar Synchronization"],
        ["6", "Tailwind CSS: Rapid Modern UI Design Patterns", "Adam Wathan & Steve Schoger", "Tailwind Labs Documentation", "Responsive Utility Grid & UX"]
    ]
    add_table(s41, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.0), headers41, rows41, [Inches(0.8), Inches(4.2), Inches(2.5), Inches(2.4), Inches(1.833)])

    # -------------------------------------------------------------
    # SLIDE 42: Thank You Slide
    # -------------------------------------------------------------
    s42 = prs.slides.add_slide(blank_layout)
    bg42 = s42.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg42.fill.solid()
    bg42.fill.fore_color.rgb = DARK_BG
    bg42.line.fill.background()

    # Top accent bar
    bar42 = s42.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.2))
    bar42.fill.solid()
    bar42.fill.fore_color.rgb = PRIMARY
    bar42.line.fill.background()

    # Center card
    card42 = s42.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(2.0), Inches(1.5), Inches(9.333), Inches(4.5))
    card42.fill.solid()
    card42.fill.fore_color.rgb = RGBColor(30, 41, 59)
    card42.line.color.rgb = PRIMARY
    card42.line.width = Pt(2)

    tb42 = s42.shapes.add_textbox(Inches(2.4), Inches(2.0), Inches(8.533), Inches(3.5))
    tf42 = tb42.text_frame
    tf42.word_wrap = True
    
    p = tf42.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "THANK YOU!"
    set_font(p.runs[0], size=40, bold=True, color=PRIMARY)
    p.space_after = Pt(14)

    p2 = tf42.add_paragraph()
    p2.alignment = PP_ALIGN.CENTER
    p2.text = "Mindroot — Peer-to-Peer Skill Exchange Platform"
    set_font(p2.runs[0], size=16, bold=True, color=WHITE)
    p2.space_after = Pt(8)

    p3 = tf42.add_paragraph()
    p3.alignment = PP_ALIGN.CENTER
    p3.text = "Any Questions or Suggestions?"
    set_font(p3.runs[0], size=14, bold=False, color=SECONDARY)
    p3.space_after = Pt(20)

    p4 = tf42.add_paragraph()
    p4.alignment = PP_ALIGN.CENTER
    p4.text = "Department of Computer Science & Applications | Academic Year 2024–2026"
    set_font(p4.runs[0], size=11, bold=False, color=TEXT_MUTED)

    # Save to a fresh version if previous ones are open in PowerPoint
    saved_path = None
    target_names = [
        "Mindroot_Project_Presentation_v2.pptx",
        "Mindroot_Project_Presentation_Master.pptx",
        "Mindroot_Project_Presentation.pptx"
    ]
    for name in target_names:
        p = os.path.abspath(name)
        try:
            prs.save(p)
            print(f"Presentation successfully saved to: {p}")
            saved_path = p
            break
        except Exception as e:
            print(f"Note: {name} is locked (open in PowerPoint), trying next filename...")

    if not saved_path:
        # Generate timestamped filename if all standard ones are open
        import time
        ts_name = f"Mindroot_Project_Presentation_{int(time.time())}.pptx"
        p = os.path.abspath(ts_name)
        prs.save(p)
        print(f"Presentation saved as timestamped file: {p}")

if __name__ == "__main__":
    create_deck()
