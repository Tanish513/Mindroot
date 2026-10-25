import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def build_v3():
    prs = Presentation()
    # 16:9 Widescreen dimensions: 12192000 x 6858000 EMU
    prs.slide_width = Inches(13.333333)
    prs.slide_height = Inches(7.5)

    blank_layout = prs.slide_layouts[6] # Blank layout

    # Color Palette matching reference.pptx
    PURPLE = RGBColor(160, 43, 147)       # Brand Purple #A02B93
    TEXT_BLACK = RGBColor(0, 0, 0)        # Pure Black
    TEXT_DARK = RGBColor(30, 41, 59)      # Charcoal
    WHITE = RGBColor(255, 255, 255)       # White
    GRAY_BORDER = RGBColor(203, 213, 225) # Border gray

    PROJECT_TITLE = "MINDROOT — PEER SKILL EXCHANGE PLATFORM"

    def set_font(run, size=20, bold=False, color=TEXT_BLACK, name="Calibri"):
        run.font.name = name
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color

    def add_footer(slide):
        # Full-width purple band along the bottom
        footer = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(6.73), Inches(13.333333), Inches(0.77))
        footer.fill.solid()
        footer.fill.fore_color.rgb = PURPLE
        footer.line.fill.background()

        tf = footer.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = PROJECT_TITLE
        set_font(r, size=24, bold=True, color=WHITE)

    def add_title_pill(slide, title_text, width=Inches(7.0)):
        # Centered purple pill at the top
        left = (Inches(13.333333) - width) / 2
        top = Inches(0.2)
        height = Inches(0.68)
        
        pill = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
        pill.fill.solid()
        pill.fill.fore_color.rgb = PURPLE
        pill.line.fill.background()

        tf = pill.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = title_text
        set_font(r, size=24, bold=True, color=WHITE)

    def add_section_divider(title_text):
        slide = prs.slides.add_slide(blank_layout)
        add_footer(slide)

        # Centered purple box for section title
        width = Inches(8.5)
        height = Inches(1.1)
        left = (Inches(13.333333) - width) / 2
        top = Inches(2.7)

        box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
        box.fill.solid()
        box.fill.fore_color.rgb = PURPLE
        box.line.fill.background()

        tf = box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = title_text
        set_font(r, size=40, bold=True, color=WHITE)
        return slide

    def add_bullets_slide(title_text, bullet_items, title_width=Inches(7.0)):
        slide = prs.slides.add_slide(blank_layout)
        add_title_pill(slide, title_text, width=title_width)
        add_footer(slide)

        # Content text box below title pill and above footer
        tb = slide.shapes.add_textbox(Inches(0.8), Inches(1.2), Inches(11.733), Inches(5.2))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

        for idx, (label, text) in enumerate(bullet_items):
            p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
            p.space_after = Pt(14)
            p.line_spacing = 1.15
            
            # Bold lead-in label (e.g. Process:- ...)
            r_label = p.add_run()
            r_label.text = f"{label}:- "
            set_font(r_label, size=18, bold=True, color=TEXT_BLACK)

            r_text = p.add_run()
            r_text.text = text
            set_font(r_text, size=18, bold=False, color=TEXT_DARK)

        return slide

    def add_image_slide(title_text, image_path, title_width=Inches(7.0)):
        slide = prs.slides.add_slide(blank_layout)
        add_title_pill(slide, title_text, width=title_width)
        add_footer(slide)

        if os.path.exists(image_path):
            # Place image centered, below title (top=1.1 in) and above footer (height <= 5.4 in)
            slide.shapes.add_picture(image_path, Inches(0.8), Inches(1.1), Inches(11.733), Inches(5.35))
        return slide

    def add_table_slide(title_text, headers, rows, col_widths=None, title_width=Inches(7.0)):
        slide = prs.slides.add_slide(blank_layout)
        add_title_pill(slide, title_text, width=title_width)
        add_footer(slide)

        num_rows = len(rows) + 1
        num_cols = len(headers)
        table_shape = slide.shapes.add_table(num_rows, num_cols, Inches(0.8), Inches(1.2), Inches(11.733), Inches(5.1))
        table = table_shape.table

        if col_widths and len(col_widths) == num_cols:
            for idx, w in enumerate(col_widths):
                table.columns[idx].width = w

        # Header Row: Purple fill, White bold text
        for col_idx, h_text in enumerate(headers):
            cell = table.cell(0, col_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = PURPLE
            tf = cell.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT
            r = p.add_run()
            r.text = h_text
            set_font(r, size=13, bold=True, color=WHITE)

        # Data Rows: White fill, black text, thin borders
        for row_idx, row_data in enumerate(rows):
            for col_idx, val in enumerate(row_data):
                cell = table.cell(row_idx + 1, col_idx)
                cell.fill.solid()
                cell.fill.fore_color.rgb = WHITE
                tf = cell.text_frame
                tf.word_wrap = True
                p = tf.paragraphs[0]
                p.alignment = PP_ALIGN.LEFT
                r = p.add_run()
                r.text = str(val)
                is_first_col = (col_idx == 0)
                set_font(r, size=12, bold=is_first_col, color=TEXT_BLACK if is_first_col else TEXT_DARK)

        return slide

    print("Building presentation v3 matching reference.pptx...")

    # =============================================================
    # SLIDE 1: Title Slide (Exact match to reference.pptx)
    # =============================================================
    s1 = prs.slides.add_slide(blank_layout)
    # Plain white background
    bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333333), Inches(7.5))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = WHITE
    bg1.line.fill.background()

    # Top text: A PROJECT REPORT ON
    tb_top = s1.shapes.add_textbox(Inches(1.67), Inches(0.14), Inches(10.0), Inches(0.9))
    tf_top = tb_top.text_frame
    p_top = tf_top.paragraphs[0]
    p_top.alignment = PP_ALIGN.CENTER
    r_top = p_top.add_run()
    r_top.text = "A PROJECT REPORT ON"
    set_font(r_top, size=32, bold=True, color=TEXT_BLACK)

    # Full-width Purple Banner: Project Name
    banner1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(1.15), Inches(13.333333), Inches(0.95))
    banner1.fill.solid()
    banner1.fill.fore_color.rgb = PURPLE
    banner1.line.fill.background()

    tf_b1 = banner1.text_frame
    p_b1 = tf_b1.paragraphs[0]
    p_b1.alignment = PP_ALIGN.CENTER
    r_b1 = p_b1.add_run()
    r_b1.text = "MINDROOT — PEER SKILL EXCHANGE PLATFORM"
    set_font(r_b1, size=34, bold=True, color=WHITE)

    # Subtitle: SUBMITTED TO
    tb_sub = s1.shapes.add_textbox(Inches(4.5), Inches(2.25), Inches(4.33), Inches(0.45))
    tf_sub = tb_sub.text_frame
    p_sub = tf_sub.paragraphs[0]
    p_sub.alignment = PP_ALIGN.CENTER
    r_sub = p_sub.add_run()
    r_sub.text = "-: SUBMITTED TO :-"
    set_font(r_sub, size=20, bold=True, color=TEXT_BLACK)

    # College & University
    tb_inst = s1.shapes.add_textbox(Inches(1.5), Inches(2.7), Inches(10.33), Inches(1.1))
    tf_inst = tb_inst.text_frame
    p_inst1 = tf_inst.paragraphs[0]
    p_inst1.alignment = PP_ALIGN.CENTER
    r_inst1 = p_inst1.add_run()
    r_inst1.text = "Grow More Institute of BCA, Himatnagar"
    set_font(r_inst1, size=26, bold=True, color=TEXT_BLACK)

    p_inst2 = tf_inst.add_paragraph()
    p_inst2.alignment = PP_ALIGN.CENTER
    r_inst2 = p_inst2.add_run()
    r_inst2.text = "H. N. G. U. , PATAN"
    set_font(r_inst2, size=22, bold=True, color=TEXT_BLACK)

    # Left: Internal Guidance
    tb_gui = s1.shapes.add_textbox(Inches(1.0), Inches(4.1), Inches(3.8), Inches(1.8))
    tf_gui = tb_gui.text_frame
    p_g1 = tf_gui.paragraphs[0]
    r_g1 = p_g1.add_run()
    r_g1.text = "-: INTERNAL GUIDANCE :-"
    set_font(r_g1, size=18, bold=True, color=TEXT_BLACK)
    p_g2 = tf_gui.add_paragraph()
    p_g2.space_before = Pt(8)
    r_g2 = p_g2.add_run()
    r_g2.text = "MS. NILAM SUTHAR\n(ASST. PROFESSOR)\nDepartment of BCA"
    set_font(r_g2, size=18, bold=True, color=TEXT_DARK)

    # Center: College Logo
    logo_path = os.path.abspath("college_logo.png")
    if os.path.exists(logo_path):
        s1.shapes.add_picture(logo_path, Inches(5.95), Inches(4.1), Inches(1.4), Inches(2.0))

    # Right: Presented By
    tb_pre = s1.shapes.add_textbox(Inches(8.5), Inches(4.1), Inches(3.8), Inches(1.8))
    tf_pre = tb_pre.text_frame
    p_p1 = tf_pre.paragraphs[0]
    r_p1 = p_p1.add_run()
    r_p1.text = "-: PRESENTED BY :-"
    set_font(r_p1, size=18, bold=True, color=TEXT_BLACK)
    p_p2 = tf_pre.add_paragraph()
    p_p2.space_before = Pt(8)
    r_p2 = p_p2.add_run()
    r_p2.text = "PATEL HAPPY\nPATEL TANVI"
    set_font(r_p2, size=18, bold=True, color=TEXT_DARK)

    add_footer(s1)

    # =============================================================
    # SLIDE 2: Project Profile (Matching Reference Table)
    # =============================================================
    headers2 = ["Project Attribute", "Specification Details"]
    rows2 = [
        ["Project Title", "MINDROOT — PEER SKILL EXCHANGE PLATFORM"],
        ["Organization", "Grow More Institute of BCA, Himatnagar (Department of BCA)"],
        ["Project Guide", "MS. NILAM SUTHAR (ASST. PROFESSOR)"],
        ["Group Size", "2 Students"],
        ["Group Member Name", "PATEL HAPPY, PATEL TANVI"],
        ["Project Duration", "120 HOURS (Academic Project Lifecycle)"],
        ["Front End Technologies", "React 19, TypeScript, Vite, Tailwind CSS, Framer Motion"],
        ["Back End & Real-Time", "Node.js, Express.js, Socket.io (Signaling & Network Sync)"],
        ["Database & ORM", "PostgreSQL Database, Prisma ORM"],
        ["Audio/Video Engine", "WebRTC Peer-to-Peer Engine (SimplePeer, MediaStream APIs)"],
        ["Tools Used", "VISUAL STUDIO CODE, Git, GitHub, Docker, Postman"]
    ]
    add_table_slide("Project Profile", headers2, rows2, [Inches(3.2), Inches(8.533)], title_width=Inches(5.0))

    # =============================================================
    # SLIDE 3: Table of Contents / Presentation Outline
    # =============================================================
    toc_items = [
        ("Foundation & System Analysis", "Background, Problem Statement, Disadvantages, and Need For The System."),
        ("System Architecture & Design", "Multi-Tier Topology, Hardware & Software Requirements, and High-Level Architecture."),
        ("Diagrams & Workflows", "E-R Diagram & Cardinalities, System Flowcharts, DFD Symbols, and DFD Levels 0 & 1."),
        ("Data Dictionary", "User, Skill, UserSkill, Session, Transaction Ledger, Review, and Message Tables."),
        ("System UI Screenshots", "Landing Page, Auth/Google SSO, Matchmaker, Booking, Live WebRTC Room, and Analytics."),
        ("Security & Conclusion", "Security Measures, Future Enhancements, Conclusion, and Bibliography.")
    ]
    add_bullets_slide("Presentation Outline", toc_items, title_width=Inches(6.5))

    # =============================================================
    # SLIDE 4: Project Introduction & Background (Part 1)
    # =============================================================
    intro1 = [
        ("The Academic Skill Gap", "In university environments, students often excel in specific technical domains (such as React, Python, UI Design, or French) while requiring urgent guidance in others (such as Data Structures, Machine Learning, or Cloud)."),
        ("The Traditional Tutoring Dilemma", "Commercial tutoring services charge steep hourly fees ($25 to $80/hr) which are financially prohibitive for full-time college students."),
        ("The Barter Solution", "Mindroot introduces a bilateral peer-to-peer knowledge exchange model where student time and expertise serve as the primary currency, enabling learners to barter knowledge without financial barriers.")
    ]
    add_bullets_slide("Introduction & Background", intro1, title_width=Inches(7.5))

    # =============================================================
    # SLIDE 5: Project Introduction & Background (Part 2)
    # =============================================================
    intro2 = [
        ("System Concept", "Mindroot ('Student to Student') is a decentralized web platform operating on an egalitarian Time-Banking model where 1 hour of teaching mints 1 Skill Token."),
        ("Integrated Virtual Workspace", "Unifies WebRTC high-definition peer-to-peer video, audio, collaborative drawing whiteboard, and synchronized live code runner inside a single browser room."),
        ("Trust & Verification", "Features automated Google OAuth 2.0 single sign-on, verified email authentication, dynamic peer review ratings (1.0 to 5.0), and .ics calendar synchronization.")
    ]
    add_bullets_slide("What is Mindroot?", intro2, title_width=Inches(5.5))

    # =============================================================
    # SLIDE 6: Existing System (Part 1 - Process & User Management)
    # =============================================================
    exist1 = [
        ("Process", "At present, students rely on unstructured WhatsApp groups, Discord servers, college noticeboards, or expensive third-party tutoring websites. Session records, study resources, and schedules are maintained manually or haphazardly."),
        ("User Management", "Student qualifications and peer competencies are stored manually without verified profiles, making it difficult to search trustworthy mentors, evaluate past teaching history, or verify skill proficiency."),
        ("Time Consumption", "Learners spend hours messaging back and forth to negotiate meeting times, confirm video links, and agree on study syllabi, consuming valuable study time during exam seasons.")
    ]
    add_bullets_slide("Existing System", exist1, title_width=Inches(5.0))

    # =============================================================
    # SLIDE 7: Existing System (Part 2 - Tool Fragmentation & Costs)
    # =============================================================
    exist2 = [
        ("Financial Burden", "Commercial tutoring platforms charge high subscription and per-hour rates that full-time undergraduate students cannot afford, locking out economically disadvantaged peers."),
        ("Tool Fragmentation", "Collaborative learning requires switching across multiple disjointed applications: Google Meet for video, Google Docs for notes, Replit for coding, and WhatsApp for chat."),
        ("Human Errors & Ghosting", "Informal study commitments lead to frequent unpunctuality, forgotten bookings, mismatched calendar timezones, and no accountability for missed tutoring hours.")
    ]
    add_bullets_slide("Existing System Limitations", exist2, title_width=Inches(7.5))

    # =============================================================
    # SLIDE 8: Disadvantages of Existing System
    # =============================================================
    disadv = [
        ("Monetary Exclusivity", "Commercial tutoring models favor students with high disposable income, preventing talented but financially constrained students from receiving mentorship."),
        ("Lack of Reciprocity", "Traditional platforms operate strictly as one-way financial transactions, failing to recognize that a learner can also be an expert instructor in another domain."),
        ("Free-Rider Dilemma", "In informal student study groups, one diligent student frequently does all the teaching while others contribute nothing, leading to group burnout."),
        ("Zero Centralized Record Keeping", "No persistent ledger of hours taught or learned, making it impossible to showcase verified peer mentoring on academic resumes or portfolios.")
    ]
    add_bullets_slide("Disadvantages of Existing System", disadv, title_width=Inches(8.5))

    # =============================================================
    # SLIDE 9: Proposed System Overview (Part 1)
    # =============================================================
    prop1 = [
        ("Dual Role Model", "Every user account functions seamlessly as both a Teacher and a Student with zero profile-switching friction, fostering reciprocal peer learning."),
        ("Time-Banking Token Economy", "Built on a cashless micro-economy: teaching 1 hour earns 1 Skill Token, while spending 1 token unlocks 1 hour of 1-on-1 personalized tutoring in any subject."),
        ("Smart Escrow Security", "Skill Tokens are automatically placed in escrow upon booking confirmation and only released to the mentor after both parties complete the session.")
    ]
    add_bullets_slide("Proposed System Overview", prop1, title_width=Inches(7.5))

    # =============================================================
    # SLIDE 10: Proposed System Overview (Part 2)
    # =============================================================
    prop2 = [
        ("Browser-Native WebRTC Classroom", "Integrates peer-to-peer HD video, noise-suppressed audio, interactive vector whiteboard, and live pair-programming code runner into a single tab with zero downloads."),
        ("Mutual Matchmaking Algorithm", "Matches peers whose teaching repertoire fulfills another user's learning objectives, highlighting mutual matches with golden compatibility badges."),
        ("Automated Calendar Sync", "Generates RFC 5545 standard .ics calendar invitations for one-click import into Google Calendar, Microsoft Outlook, and Apple iCal.")
    ]
    add_bullets_slide("Proposed System Features", prop2, title_width=Inches(7.5))

    # =============================================================
    # SLIDE 11: Need For The System
    # =============================================================
    needs = [
        ("System Overview", "The new system is a web-based Peer Skill Exchange Platform developed to replace unstructured, fee-heavy, and fragmented study habits with an automated, equitable digital ecosystem."),
        ("Democratized Accessibility", "Ensures every student has equal access to high-caliber personal tutoring regardless of financial status by converting individual knowledge into an actionable currency."),
        ("Efficient Booking & Escrow", "The system manages scheduling, token wallets, classroom rooms, and calendar invitations automatically in digital form."),
        ("Verified Academic Quality", "Maintains high educational standards through Google OAuth verification, institutional login, and dynamic peer reviews (1.0 to 5.0).")
    ]
    add_bullets_slide("Need For The System", needs, title_width=Inches(6.0))

    # =============================================================
    # SLIDE 12: Objectives
    # =============================================================
    objs = [
        ("Error Reduction & Reliability", "The system eliminates scheduling confusion, attendance ghosting, and mismatched meeting links by automating room generation and token escrow."),
        ("Time Efficiency", "Saves time by providing instant mentor search, automated reciprocal matchmaking, and quick booking confirmations with downloadable .ics calendar files."),
        ("Record Tracking & Ledger", "Maintains an immutable digital ledger of Skill Token transactions, session histories, hours taught, and qualitative peer feedback."),
        ("Improved Service Quality", "Enables students to learn interactively through real-time audio, video, whiteboard diagrams, and live code pairing.")
    ]
    add_bullets_slide("Objectives", objs, title_width=Inches(4.5))

    # =============================================================
    # SLIDE 13: Hardware & Software Requirements
    # =============================================================
    headers13 = ["Component Type", "Hardware / Software Item", "Minimum Requirement", "Recommended Specification"]
    rows13 = [
        ["Client Machine", "Processor & CPU", "Intel Core i3 8th Gen / AMD Ryzen 3", "Intel Core i5 / AMD Ryzen 5 or higher"],
        ["Client Machine", "RAM / Memory", "4 GB RAM", "8 GB DDR4 RAM or higher"],
        ["Client Machine", "Peripherals", "Integrated Webcam & Microphone", "720p HD Webcam & Noise-cancelling Headset"],
        ["Client Machine", "Web Browser", "Google Chrome 90+ / Microsoft Edge", "Latest Google Chrome or Microsoft Edge"],
        ["Client Machine", "Network Speed", "1.5 Mbps broadband connection", "10+ Mbps high-speed Wi-Fi / Ethernet"],
        ["Server Machine", "Runtime Environment", "Node.js v18.0.0 or higher", "Node.js v20 LTS / v22 Current"],
        ["Server Machine", "Database Engine", "PostgreSQL 14+ or SQLite dev", "PostgreSQL 16 with Connection Pooling"],
        ["Server Machine", "Development Tools", "VS Code, Git, npm, Postman", "VS Code, Git, Docker, Postman"]
    ]
    add_table_slide("Hardware & Software", headers13, rows13, [Inches(2.2), Inches(2.5), Inches(3.5), Inches(3.533)], title_width=Inches(6.5))

    # =============================================================
    # SLIDE 14: High-Level System Architecture (Diagram)
    # =============================================================
    add_image_slide("System Architecture", "diagrams/architecture_diagram.png", title_width=Inches(6.0))

    # =============================================================
    # SLIDE 15: SECTION DIVIDER — E-R DIAGRAM
    # =============================================================
    add_section_divider("E-R DIAGRAM")

    # =============================================================
    # SLIDE 16: E-R Diagram (Diagram Image)
    # =============================================================
    add_image_slide("E-R Diagram", "diagrams/er_diagram.png", title_width=Inches(5.0))

    # =============================================================
    # SLIDE 17: E-R Diagram Cardinalities & Constraints
    # =============================================================
    headers17 = ["Primary Entity", "Related Entity", "Cardinality", "Relationship Description", "Integrity Rule"]
    rows17 = [
        ["User", "Session (as Teacher)", "1 : M (One-to-Many)", "One user can mentor multiple sessions over time", "ON DELETE RESTRICT"],
        ["User", "Session (as Student)", "1 : M (One-to-Many)", "One user can enroll in multiple learning sessions", "ON DELETE RESTRICT"],
        ["User", "UserSkill", "1 : M (One-to-Many)", "One user can possess multiple skills taught or wanted", "ON DELETE CASCADE"],
        ["Skill", "UserSkill", "1 : M (One-to-Many)", "One skill can be referenced by many student profiles", "ON DELETE RESTRICT"],
        ["User", "Transaction", "1 : M (One-to-Many)", "One user account owns multiple token ledger entries", "ON DELETE CASCADE"],
        ["Session", "Review", "1 : 1 (One-to-One)", "Each completed session generates exactly one verified review", "ON DELETE CASCADE"],
        ["User", "Message", "1 : M (One-to-Many)", "One user sends/receives multiple direct chat messages", "ON DELETE CASCADE"]
    ]
    add_table_slide("E-R Cardinalities", headers17, rows17, [Inches(1.8), Inches(2.2), Inches(1.8), Inches(3.933), Inches(2.0)], title_width=Inches(5.5))

    # =============================================================
    # SLIDE 18: SECTION DIVIDER — SYSTEM FLOW CHART
    # =============================================================
    add_section_divider("SYSTEM FLOW CHART")

    # =============================================================
    # SLIDE 19: System Flowchart (Diagram Image)
    # =============================================================
    add_image_slide("System Flow Chart", "diagrams/system_flowchart.png", title_width=Inches(6.0))

    # =============================================================
    # SLIDE 20: Teacher & Mentor Workflow
    # =============================================================
    teach_flow = [
        ("Step 1: Skill Registration", "Mentor defines subjects of expertise, self-assessed proficiency, bio, and weekly availability slots."),
        ("Step 2: Request Notification", "Receives real-time Socket.io invite when a peer requests a tutoring session."),
        ("Step 3: Confirmation & Schedule", "Accepts the proposed date and topic agenda; session state transitions to confirmed."),
        ("Step 4: Live Mentorship Delivery", "Instructs inside the WebRTC virtual room using HD video, interactive whiteboard, and live coding."),
        ("Step 5: Completion & Payout", "Marks session as completed; 1 Skill Token is instantly credited to mentor's wallet.")
    ]
    add_bullets_slide("Mentor Workflow", teach_flow, title_width=Inches(5.0))

    # =============================================================
    # SLIDE 21: Administrator Management Workflow
    # =============================================================
    admin_flow = [
        ("Step 1: Admin Authentication", "Administrator logs in through protected portal with elevated role permissions."),
        ("Step 2: Platform Analytics", "Inspects active user counts, completed session velocity, and token circulation health."),
        ("Step 3: User Moderation", "Reviews flagged accounts, verifies institutional emails, and suspends abusive users."),
        ("Step 4: Skill Taxonomy Governance", "Curates course topics, approves new subject categories, and merges duplicate tags."),
        ("Step 5: Dispute Resolution", "Arbitrates interrupted sessions or connection disputes and triggers manual token refunds.")
    ]
    add_bullets_slide("Admin Workflow", admin_flow, title_width=Inches(5.0))

    # =============================================================
    # SLIDE 22: Symbols of Data Flow Diagram (DFD Image)
    # =============================================================
    add_image_slide("Symbols of DFD", "diagrams/dfd_symbols.png", title_width=Inches(5.5))

    # =============================================================
    # SLIDE 23: SECTION DIVIDER — DATA FLOW DIAGRAM
    # =============================================================
    add_section_divider("DATA FLOW DIAGRAM")

    # =============================================================
    # SLIDE 24: Context Level DFD (Level 0 Image)
    # =============================================================
    add_image_slide("DFD Context Level (Level 0)", "diagrams/dfd_level_0.png", title_width=Inches(7.5))

    # =============================================================
    # SLIDE 25: DFD Level 1 — User Perspective (Image)
    # =============================================================
    add_image_slide("DFD Level 1 (User Perspective)", "diagrams/dfd_user_level1.png", title_width=Inches(7.5))

    # =============================================================
    # SLIDE 26: DFD Level 1 — Admin Perspective (Image)
    # =============================================================
    add_image_slide("DFD Level 1 (Admin Perspective)", "diagrams/dfd_admin_level1.png", title_width=Inches(7.5))

    # =============================================================
    # SLIDE 27: DFD Level 1 — Process 3.0 (Booking & Escrow)
    # =============================================================
    proc3 = [
        ("Process 3.1: Session Request Handler", "Learner selects desired time slot; system validates calendar availability against mentor's active timetable."),
        ("Process 3.2: Atomic Token Escrow Lock", "Verifies Student has >= 1 token; decrements visible wallet balance and locks 1 token in pending escrow."),
        ("Process 3.3: Socket Notification Dispatch", "Emits real-time WebSocket invitation to Mentor; updates session status to 'confirmed' upon acceptance."),
        ("Process 3.4: iCalendar (.ics) Generator", "Formats standard RFC 5545 calendar invitation file with direct classroom URL for one-click calendar import.")
    ]
    add_bullets_slide("DFD Process 3.0: Booking & Escrow", proc3, title_width=Inches(8.5))

    # =============================================================
    # SLIDE 28: WebRTC P2P Signaling & Media Flow (Image)
    # =============================================================
    add_image_slide("WebRTC P2P Architecture", "diagrams/webrtc_diagram.png", title_width=Inches(7.0))

    # =============================================================
    # SLIDE 29: SECTION DIVIDER — DATA DICTIONARY
    # =============================================================
    add_section_divider("DATA DICTIONARY")

    # =============================================================
    # SLIDE 30: Data Dictionary Overview (Part 1 - Principles)
    # =============================================================
    dd1 = [
        ("Schema Architecture", "All database tables are modeled declaratively using Prisma ORM with strict type-safety, non-nullable constraints, and default value generators for PostgreSQL."),
        ("Referential Integrity", "Foreign key constraints preserve relational validity: deleting a user cascades to join records and logs while restricting deletion of active sessions."),
        ("Auditability & Immutability", "Every Skill Token transaction and peer review is permanently timestamped with UTC precision, ensuring financial transparency.")
    ]
    add_bullets_slide("Data Dictionary Overview", dd1, title_width=Inches(6.5))

    # =============================================================
    # SLIDE 31: Data Dictionary Overview (Part 2 - Models)
    # =============================================================
    dd2 = [
        ("User Table (`User`)", "Stores student and mentor profiles, password hashes, token balances, and dynamic trust ratings."),
        ("Skill & UserSkill Tables", "Normalizes skill taxonomies and associates students with subjects they teach or want to learn."),
        ("Session Table (`Session`)", "Tracks scheduled 1-on-1 classrooms, lifecycle states, dates, and durations."),
        ("Transaction Table (`Transaction`)", "Provides an immutable ledger tracking earned, spent, and escrowed Skill Tokens."),
        ("Review & Message Tables", "Stores post-session qualitative ratings and real-time direct chat messages.")
    ]
    add_bullets_slide("Database Models Summary", dd2, title_width=Inches(6.5))

    # =============================================================
    # SLIDE 32: Customer / User Table (`User`)
    # =============================================================
    headers32 = ["Field Name", "Data Type", "Constraint", "Default", "Description & Field Purpose"]
    rows32 = [
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
    add_table_slide("User Table", headers32, rows32, [Inches(1.8), Inches(1.8), Inches(2.0), Inches(1.5), Inches(4.633)], title_width=Inches(4.5))

    # =============================================================
    # SLIDE 33: Skill & UserSkill Join Tables
    # =============================================================
    headers33 = ["Field Name", "Data Type", "Constraint", "Description & Field Purpose"]
    rows33 = [
        ["id", "String (UUID)", "Primary Key", "Unique identifier for the skill entity"],
        ["name", "VarChar(100)", "Unique, NOT NULL", "Human-readable skill title (e.g., Python, React, UI Design)"],
        ["category", "VarChar(100)", "NOT NULL", "Domain category (e.g., 'Software & AI', 'Design', 'Languages')"],
        ["userId (Join)", "String (UUID)", "Foreign Key -> User.id", "References the associated user (ON DELETE CASCADE)"],
        ["skillId (Join)", "String (UUID)", "Foreign Key -> Skill.id", "References the associated skill (ON DELETE RESTRICT)"],
        ["type (Join)", "VarChar(20)", "NOT NULL", "Specifies capability: 'teaches' OR 'wants_to_learn'"]
    ]
    add_table_slide("Skill & UserSkill Tables", headers33, rows33, [Inches(2.0), Inches(2.2), Inches(2.8), Inches(4.733)], title_width=Inches(6.5))

    # =============================================================
    # SLIDE 34: Booking / Session Table (`Session`)
    # =============================================================
    headers34 = ["Field Name", "Data Type", "Constraint", "Default", "Description & Field Purpose"]
    rows34 = [
        ["id", "String (UUID)", "Primary Key", "uuid()", "Unique identifier for the booked classroom session"],
        ["title", "VarChar(150)", "NOT NULL", "None", "Session topic summary (e.g. 'React ↔ Python Skill Swap')"],
        ["teacherId", "String (UUID)", "Foreign Key -> User.id", "None", "User ID of the mentor conducting the session"],
        ["studentId", "String (UUID)", "Foreign Key -> User.id", "None", "User ID of the learner attending the session"],
        ["skillId", "String (UUID)", "Foreign Key -> Skill.id", "None", "Optional specific skill being taught"],
        ["status", "VarChar(20)", "NOT NULL", "'pending'", "State: 'pending', 'confirmed', 'live', 'completed'"],
        ["scheduledAt", "DateTime", "NOT NULL", "None", "Scheduled date and start time for the classroom"],
        ["durationMin", "Integer", "NOT NULL", "60", "Planned session duration in minutes (standard: 60 min)"]
    ]
    add_table_slide("Session Table", headers34, rows34, [Inches(1.8), Inches(1.8), Inches(2.5), Inches(1.2), Inches(4.433)], title_width=Inches(4.5))

    # =============================================================
    # SLIDE 35: Payment / Transaction Table (`Transaction`)
    # =============================================================
    headers35 = ["Field Name", "Data Type", "Constraint", "Description & Field Purpose"]
    rows35 = [
        ["id", "String (UUID)", "Primary Key", "Unique identifier for the financial ledger transaction"],
        ["userId", "String (UUID)", "Foreign Key -> User.id", "User account associated with this token movement (ON DELETE CASCADE)"],
        ["amount", "Integer", "NOT NULL", "Number of tokens moved (+1 for teaching credit, -1 for learning debit)"],
        ["type", "VarChar(20)", "NOT NULL", "Transaction category: 'earned', 'spent', 'escrow_hold', 'refund', 'bonus'"],
        ["description", "VarChar(255)", "NOT NULL", "Audit note (e.g. 'Completed 1 hr React session with Patel Happy')"],
        ["createdAt", "DateTime", "NOT NULL, now()", "Immutable timestamp of ledger settlement"]
    ]
    add_table_slide("Transaction Table", headers35, rows35, [Inches(1.8), Inches(2.0), Inches(2.5), Inches(5.433)], title_width=Inches(5.0))

    # =============================================================
    # SLIDE 36: Review & Message Tables
    # =============================================================
    headers36 = ["Field Name", "Data Type", "Constraint", "Description & Field Purpose"]
    rows36 = [
        ["id (Review)", "String (UUID)", "Primary Key", "Unique identifier for the review entry"],
        ["sessionId", "String (UUID)", "Unique, FK -> Session", "Links review to verified completed session (prevents fake reviews)"],
        ["rating", "Integer", "NOT NULL (1 to 5)", "Numerical satisfaction score awarded (1=Poor to 5=Excellent)"],
        ["comment", "Text", "NULLABLE", "Written qualitative review and feedback notes"],
        ["id (Message)", "String (UUID)", "Primary Key", "Unique identifier for direct chat message"],
        ["content", "Text", "NOT NULL", "Encrypted or sanitized text content of the message"],
        ["isRead", "Boolean", "NOT NULL, default false", "Delivery status indicator and read receipts"]
    ]
    add_table_slide("Review & Message Tables", headers36, rows36, [Inches(2.0), Inches(2.2), Inches(2.8), Inches(4.733)], title_width=Inches(6.5))

    # =============================================================
    # SLIDE 37: SECTION DIVIDER — SCREEN SHOT
    # =============================================================
    add_section_divider("SCREEN SHOT")

    # =============================================================
    # SLIDE 38: Screen 1 — Landing Page & Platform Showcase (Image)
    # =============================================================
    add_image_slide("Screen 1: Landing Page", "diagrams/ui_landing.png", title_width=Inches(6.5))

    # =============================================================
    # SLIDE 39: Screen 2 — Authentication & Google OAuth SSO (Image)
    # =============================================================
    add_image_slide("Screen 2: User Sign In", "diagrams/ui_auth.png", title_width=Inches(6.0))

    # =============================================================
    # SLIDE 40: Screen 3 — Peer Discovery & Matchmaker (Image)
    # =============================================================
    add_image_slide("Screen 3: Peer Discovery", "diagrams/ui_matchmaker.png", title_width=Inches(6.5))

    # =============================================================
    # SLIDE 41: Screen 4 — Session Booking & Calendar Sync (Image)
    # =============================================================
    add_image_slide("Screen 4: Booking & Escrow", "diagrams/ui_booking.png", title_width=Inches(6.5))

    # =============================================================
    # SLIDE 42: Screen 5 — Live Virtual Classroom (Image)
    # =============================================================
    add_image_slide("Screen 5: Live Classroom", "diagrams/ui_classroom.png", title_width=Inches(6.5))

    # =============================================================
    # SLIDE 43: Screen 6 — Whiteboard & Code Editor (Image)
    # =============================================================
    add_image_slide("Screen 6: Collaborative Tools", "diagrams/ui_whiteboard.png", title_width=Inches(7.0))

    # =============================================================
    # SLIDE 44: Screen 7 — Platform Analytics & Metrics (Image)
    # =============================================================
    add_image_slide("Screen 7: System Analytics", "diagrams/analytics_graphs.png", title_width=Inches(6.5))

    # =============================================================
    # SLIDE 45: Security & Trust Measures (Part 1)
    # =============================================================
    sec1 = [
        ("Stateless JWT Authentication", "Tokens signed securely with HMAC-SHA256 and stored in secure browser storage; middleware protects administrative and private classroom endpoints."),
        ("Google OAuth 2.0 Security", "Validates cryptographic signatures of Google ID tokens on the backend using official google-auth-library, preventing credential spoofing."),
        ("WebRTC DTLS / SRTP Encryption", "All live audio, video, and whiteboard data streams are encrypted end-to-end between peer browsers; the signaling server never inspects media payloads.")
    ]
    add_bullets_slide("Security & Privacy Measures", sec1, title_width=Inches(7.0))

    # =============================================================
    # SLIDE 46: Security & Trust Measures (Part 2)
    # =============================================================
    sec2 = [
        ("Atomic Token Escrow Locks", "Database row-level locks prevent double-spending; tokens remain locked in smart escrow until verified classroom completion."),
        ("Dynamic Trust Rating Algorithm", "Calculates a Bayesian weighted reputation score (1.0 to 5.0) that gives higher credibility to seasoned peer evaluations, preventing review inflation."),
        ("Dispute Arbitration Console", "Enables administrators to audit session logs, handle unfulfilled booking complaints, and trigger automated token refunds.")
    ]
    add_bullets_slide("Trust & Escrow Integrity", sec2, title_width=Inches(6.5))

    # =============================================================
    # SLIDE 47: Future Enhancement (Matching Reference Slide)
    # =============================================================
    fe = [
        ("AI-Powered Skill Matchmaker", "Implement LLM vector embeddings to analyze student syllabi and recommend mentors with complementary learning speeds."),
        ("Mobile Application", "Develop cross-platform mobile apps for Android and iOS using React Native with push notifications for instant session invites."),
        ("Group Study Cohorts", "Expand 1-on-1 WebRTC rooms into multi-peer study circles using Selective Forwarding Units (SFU) media architecture."),
        ("Automated Session Transcripts", "Integrate AI speech-to-text models to generate automated session notes and key concept summaries after every class."),
        ("Verifiable Digital Badges", "Issue cryptographically verifiable digital certificates for students completing milestone hours of peer teaching.")
    ]
    add_bullets_slide("Future Enhancement", fe, title_width=Inches(6.0))

    # =============================================================
    # SLIDE 48: Conclusion (Part 1 - Synthesis & Impact)
    # =============================================================
    conc1 = [
        ("System Achievement", "The Mindroot ('Student to Student') platform successfully solves the financial and logistical bottlenecks of traditional student tutoring by replacing fee-heavy services with a computerized barter ecosystem."),
        ("Operational Efficiency", "The system helps manage customer profiles, skill taxonomies, bookings, escrow tokens, calendar sync, and live classrooms in an organized and efficient digital format."),
        ("Elimination of Paperwork & Friction", "It eliminates manual coordination, reduces human error in booking dates, and saves valuable study time for both mentors and learners.")
    ]
    add_bullets_slide("Conclusion", conc1, title_width=Inches(4.5))

    # =============================================================
    # SLIDE 49: Conclusion (Part 2 - Academic Benefits)
    # =============================================================
    conc2 = [
        ("Equitable Education", "Students can easily search peer skills and book tutoring sessions without monetary constraints, while mentors build verified academic portfolios."),
        ("Quality of Service", "The platform enhances overall learning quality by providing instant booking confirmations, secure token escrows, sub-150ms WebRTC video, and interactive tools."),
        ("Summary", "Overall, the Mindroot Peer Skill Exchange Platform makes peer-to-peer education more reliable, accessible, user-friendly, and secure for modern university students.")
    ]
    add_bullets_slide("Conclusion Summary", conc2, title_width=Inches(5.5))

    # =============================================================
    # SLIDE 50: Bibliography & References
    # =============================================================
    headers50 = ["No.", "Book / Reference Name", "Author / Organization", "Publisher / Edition", "Domain Focus"]
    rows50 = [
        ["1.", "Learning React: Modern Patterns for Developing React Apps", "Alex Banks & Eve Porcello", "O'Reilly Media, 2nd Edition", "Frontend UI Architecture"],
        ["2.", "WebRTC: APIs and RTCWEB Protocols of the HTML5 Real-Time Web", "Alan B. Johnston & Daniel C. Burnett", "Digital Media Advisors, 4th Edition", "Real-Time P2P Video & Signaling"],
        ["3.", "Node.js Design Patterns: Design and implement production apps", "Mario Casciaro & Luciano Mammino", "Packt Publishing, 3rd Edition", "Backend REST & WebSockets"],
        ["4.", "Prisma ORM & PostgreSQL Official Architecture Guides", "Prisma Data, Inc. / PostgreSQL Group", "Official Technical Documentation", "Relational Database Modeling"],
        ["5.", "Internet Calendaring & Scheduling Core Object Spec (RFC 5545)", "B. Desruisseaux (Ed.)", "Internet Engineering Task Force (IETF)", "Automated .ics Calendar Sync"],
        ["6.", "Tailwind CSS: Rapid Modern UI Design Patterns", "Adam Wathan & Steve Schoger", "Tailwind Labs Documentation", "Responsive Component Styling"]
    ]
    add_table_slide("Bibliography", headers50, rows50, [Inches(0.8), Inches(4.2), Inches(2.5), Inches(2.4), Inches(1.833)], title_width=Inches(5.0))

    # =============================================================
    # SLIDE 51: Thank You (Closing Slide Matching Reference)
    # =============================================================
    s_end = prs.slides.add_slide(blank_layout)
    bg_end = s_end.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333333), Inches(7.5))
    bg_end.fill.solid()
    bg_end.fill.fore_color.rgb = WHITE
    bg_end.line.fill.background()

    # Centered Purple Pill: "Thank You"
    width_end = Inches(6.5)
    height_end = Inches(1.1)
    box_end = s_end.shapes.add_shape(MSO_SHAPE.RECTANGLE, (Inches(13.333333)-width_end)/2, Inches(1.8), width_end, height_end)
    box_end.fill.solid()
    box_end.fill.fore_color.rgb = PURPLE
    box_end.line.fill.background()

    tf_end = box_end.text_frame
    p_e = tf_end.paragraphs[0]
    p_e.alignment = PP_ALIGN.CENTER
    r_e = p_e.add_run()
    r_e.text = "Thank You"
    set_font(r_e, size=48, bold=True, color=WHITE)

    # College Logo below Thank You
    if os.path.exists(logo_path):
        s_end.shapes.add_picture(logo_path, Inches(5.8), Inches(3.2), Inches(1.7), Inches(2.4))

    # Academic Year & Dept
    tb_dept = s_end.shapes.add_textbox(Inches(2.0), Inches(5.8), Inches(9.333), Inches(0.6))
    tf_dept = tb_dept.text_frame
    p_d = tf_dept.paragraphs[0]
    p_d.alignment = PP_ALIGN.CENTER
    r_d = p_d.add_run()
    r_d.text = "Grow More Institute of BCA | Department of BCA | Academic Year 2025–2026"
    set_font(r_d, size=18, bold=True, color=TEXT_DARK)

    add_footer(s_end)

    # Save to Mindroot_Project_Presentation_v3.pptx
    out_v3 = os.path.abspath("Mindroot_Project_Presentation_v3.pptx")
    prs.save(out_v3)
    print(f"Mindroot_Project_Presentation_v3.pptx created successfully! Total slides: {len(prs.slides)}")

    # Ensure XML slide size tag is screen16x9
    fix_slide_size_tag(out_v3)

def fix_slide_size_tag(pptx_path):
    import zipfile
    import xml.etree.ElementTree as ET

    # Read zip, patch presentation.xml, write back
    tmp_path = pptx_path + ".tmp"
    with zipfile.ZipFile(pptx_path, 'r') as zin:
        with zipfile.ZipFile(tmp_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "ppt/presentation.xml":
                    # Replace type="screen4x3" or whatever with type="screen16x9"
                    data_str = data.decode('utf-8')
                    if 'type="screen4x3"' in data_str:
                        data_str = data_str.replace('type="screen4x3"', 'type="screen16x9"')
                    elif 'type="custom"' in data_str:
                        data_str = data_str.replace('type="custom"', 'type="screen16x9"')
                    elif '<p:sldSz' in data_str and 'type=' not in data_str.split('<p:sldSz')[1].split('/>')[0]:
                        data_str = data_str.replace('<p:sldSz', '<p:sldSz type="screen16x9"')
                    data = data_str.encode('utf-8')
                zout.writestr(item, data)
    os.replace(tmp_path, pptx_path)
    print("Fixed slide size tag in presentation.xml to screen16x9.")

if __name__ == "__main__":
    build_v3()
