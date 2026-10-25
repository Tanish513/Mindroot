import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/generate_v3_perfected.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update output filename
code = code.replace("Mindroot_Project_Presentation_v3.pptx", "Mindroot_Project_Presentation_v4.pptx")

# 2. Update default total_slides in add_footer
code = code.replace("def add_footer(slide, slide_num, total_slides=42):", "def add_footer(slide, slide_num, total_slides=43):")

# 3. Add helper functions add_screenshot_full and add_split_screen right after add_centered_image
helper_insert = """
    def add_screenshot_full(slide, image_path, caption_text):
        if not os.path.exists(image_path):
            print(f"Warning: Image {image_path} not found.")
            return
        with Image.open(image_path) as img:
            img_w, img_h = img.size
        aspect = img_w / img_h
        
        max_w = Inches(11.733)
        max_h = Inches(4.70)
        
        target_w = max_w
        target_h = target_w / aspect
        if target_h > max_h:
            target_h = max_h
            target_w = target_h * aspect
            
        left = Inches(0.8) + (max_w - target_w) / 2
        top = Inches(1.55)
        
        # Subtle emerald frame
        frame = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left - Inches(0.04), top - Inches(0.04), target_w + Inches(0.08), target_h + Inches(0.08))
        frame.fill.solid()
        frame.fill.fore_color.rgb = RGBColor(0xEC, 0xFD, 0xF5)
        frame.line.color.rgb = PRIMARY
        frame.line.width = Pt(1.5)
        if len(frame.adjustments) > 0:
            frame.adjustments[0] = 0.04
            
        slide.shapes.add_picture(image_path, left, top, width=target_w, height=target_h)
        
        # Caption box
        cap_top = top + target_h + Inches(0.08)
        cap_box = slide.shapes.add_textbox(Inches(0.8), cap_top, Inches(11.733), Inches(0.35))
        tf = cap_box.text_frame
        tf.word_wrap = True
        tf.margin_top = tf.margin_bottom = tf.margin_left = tf.margin_right = 0
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = caption_text
        set_font(r, size=10.5, bold=True, color=DARK_BG, font_name="Segoe UI")

    def add_split_screen(slide, left_cards, image_path, caption_text):
        # Left side: 45% width (left=0.8", width=5.1", top=1.55", height=4.85")
        if len(left_cards) == 1:
            c_title, c_items = left_cards[0]
            add_card(slide, Inches(0.8), Inches(1.55), Inches(5.1), Inches(4.85), c_title, c_items, base_size=11.5, space_after=10)
        elif len(left_cards) == 2:
            c1_title, c1_items = left_cards[0]
            c2_title, c2_items = left_cards[1]
            add_card(slide, Inches(0.8), Inches(1.55), Inches(5.1), Inches(2.35), c1_title, c1_items, base_size=10.5, space_after=5)
            add_card(slide, Inches(0.8), Inches(4.05), Inches(5.1), Inches(2.35), c2_title, c2_items, bg_color=WHITE, border_color=SECONDARY, base_size=10.5, space_after=5)
            
        # Right side: 55% width (left=6.15", width=6.383", max_height=4.40")
        if not os.path.exists(image_path):
            print(f"Warning: Image {image_path} not found.")
            return
        with Image.open(image_path) as img:
            img_w, img_h = img.size
        aspect = img_w / img_h
        
        max_w = Inches(6.383)
        max_h = Inches(4.35)
        
        target_w = max_w
        target_h = target_w / aspect
        if target_h > max_h:
            target_h = max_h
            target_w = target_h * aspect
            
        img_left = Inches(6.15) + (max_w - target_w) / 2
        img_top = Inches(1.55)
        
        frame = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, img_left - Inches(0.04), img_top - Inches(0.04), target_w + Inches(0.08), target_h + Inches(0.08))
        frame.fill.solid()
        frame.fill.fore_color.rgb = RGBColor(0xEC, 0xFD, 0xF5)
        frame.line.color.rgb = PRIMARY
        frame.line.width = Pt(1.5)
        if len(frame.adjustments) > 0:
            frame.adjustments[0] = 0.04
            
        slide.shapes.add_picture(image_path, img_left, img_top, width=target_w, height=target_h)
        
        cap_top = img_top + target_h + Inches(0.08)
        cap_box = slide.shapes.add_textbox(Inches(6.15), cap_top, Inches(6.383), Inches(0.40))
        tf = cap_box.text_frame
        tf.word_wrap = True
        tf.margin_top = tf.margin_bottom = tf.margin_left = tf.margin_right = 0
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = caption_text
        set_font(r, size=9.5, bold=True, color=DARK_BG, font_name="Segoe UI")
"""

anchor = 'slide.shapes.add_picture(image_path, left_pos, top_pos, final_w, final_h)'
idx = code.find(anchor)
if idx != -1:
    end_of_func = code.find('\n\n', idx)
    code = code[:end_of_func] + '\n' + helper_insert + code[end_of_func:]
    print("✓ Added helper functions add_screenshot_full and add_split_screen")
else:
    print("Error: Could not find anchor for helper_insert")

# 4. Replace Slide 31 to 42 definitions
old_slides_start = code.find('    # SLIDE 31:')
old_slides_end = code.find('    # =============================================================\n    # SLIDE 42: Thank You', old_slides_start)

new_slides_code = """    # SLIDE 31: Screen 1 — Landing Page & Platform Feature Showcase
    # =============================================================
    s31 = prs.slides.add_slide(blank_layout)
    add_header(s31, "Screen 1 — Landing Page & Platform Feature Showcase")
    add_footer(s31, 31, 43)
    add_screenshot_full(s31, "screenshots/01_landing.png", "Screen 1: Mindroot Student Dashboard — Active Learning Hours, Skill Token Balance, and Daily Habit Tracking")

    # =============================================================
    # SLIDE 32: Screen 2 — Authentication & Google OAuth (Split Screen)
    # =============================================================
    s32 = prs.slides.add_slide(blank_layout)
    add_header(s32, "Screen 2 — Authentication & Google OAuth 2.0 Single Sign-On")
    add_footer(s32, 32, 43)
    add_split_screen(s32, [
        ("Dual Authentication Architecture", [
            ("Google OAuth 2.0 Integration", "One-click institutional or personal Google login using `@react-oauth/google` and backend `google-auth-library` verification."),
            ("Zero Password Friction", "Cryptographically verifies Google ID tokens, extracts user avatar and verified email, eliminating forgotten passwords."),
            ("Standard Credential Fallback", "Includes Bcrypt-hashed email/password authentication for environments without Google Client ID configuration.")
        ]),
        ("Security & Session Handling", [
            ("JWT Token Generation", "Signs stateless JSON Web Tokens containing `userId` and `role` with 7-day expiration."),
            ("Automatic Welcome Bonus", "New student registrations automatically receive initial Skill Tokens in their wallet."),
            ("Role Protection", "Route guards automatically redirect unauthorized users from protected classroom views.")
        ])
    ], "screenshots/02_auth.png", "Screen 2: Multi-Method Authentication Portal — Google OAuth 2.0 Single Sign-On & Standard Bcrypt Fallback")

    # =============================================================
    # SLIDE 33: Screen 3 — Peer Discovery & Reciprocal Matchmaker
    # =============================================================
    s33 = prs.slides.add_slide(blank_layout)
    add_header(s33, "Screen 3 — Peer Discovery & Reciprocal Matchmaker")
    add_footer(s33, 33, 43)
    add_screenshot_full(s33, "screenshots/03_matchmaker.png", "Screen 3: Peer Discovery Hub — Reciprocal Skill Matchmaking, Competence Filters, and Peer Trust Ratings")

    # =============================================================
    # SLIDE 34: Screen 4 — Session Booking, Escrow & Calendar Sync (Split Screen)
    # =============================================================
    s34 = prs.slides.add_slide(blank_layout)
    add_header(s34, "Screen 4 — Session Booking, Escrow & .ics Calendar Sync")
    add_footer(s34, 34, 43)
    add_split_screen(s34, [
        ("Booking Workflow & Token Escrow", [
            ("Slot Selection Modal", "Interactive date picker and time slot selector with timezone awareness."),
            ("Token Cost Notice", "Explicitly warns: '1 Skill Token will be held in escrow until session completion'."),
            ("Topic & Agenda Notes", "Student inputs session objectives (e.g. 'Help me debug my binary search tree in C++')."),
            ("Instant Real-Time Confirmation", "Emits Socket.io event to mentor with Accept/Decline prompts.")
        ]),
        ("Automated .ics Calendar Export", [
            ("RFC 5545 Compliance", "Backend generates downloadable `.ics` calendar invitation file with unique UID."),
            ("Pre-Filled Meeting Link", "Calendar invite contains direct classroom URL (`/classroom?session=...`)."),
            ("Universal Compatibility", "One-click sync with Google Calendar, Microsoft Outlook, and Apple Calendar.")
        ])
    ], "screenshots/04_booking.png", "Screen 4: Interactive Exchange Proposal Modal — Slot Picker, Escrow Lock Notice, and Conflict Detection")

    # =============================================================
    # SLIDE 35: Screen 5 — Live Virtual Classroom (P2P Video, Audio & Chat)
    # =============================================================
    s35 = prs.slides.add_slide(blank_layout)
    add_header(s35, "Screen 5 — Live Virtual Classroom (P2P Video, Audio & Chat)")
    add_footer(s35, 35, 43)
    add_screenshot_full(s35, "screenshots/05_classroom.png", "Screen 5: Live P2P Virtual Classroom — Dual WebRTC Video Feeds, Low-Latency Audio, and Real-Time Chat")

    # =============================================================
    # SLIDE 36: Screen 6 — Collaborative Whiteboard & Code Editor (Split Screen)
    # =============================================================
    s36 = prs.slides.add_slide(blank_layout)
    add_header(s36, "Screen 6 — Collaborative Whiteboard & Synchronized Code Editor")
    add_footer(s36, 36, 43)
    add_split_screen(s36, [
        ("Interactive Vector Whiteboard", [
            ("Real-Time Drawing Canvas", "HTML5 canvas synchronized over WebRTC DataChannels or WebSocket events."),
            ("Tool Palette", "Pen, Highlighter, Geometric Shapes (Rectangle, Circle, Arrow), Text annotations, and Eraser."),
            ("Color & Stroke Controls", "8 Color swatches, adjustable stroke weights (2px - 12px), and clear canvas."),
            ("Zero-Latency Interaction", "Local optimistic rendering with broadcast updates for lag-free sketching.")
        ]),
        ("Synchronized Collaborative Code Editor", [
            ("Multi-Language Support", "Syntax highlighting for JavaScript, TypeScript, Python, C++, Java, and SQL."),
            ("Live Typing Sync", "Character-level conflict-free synchronization powered by real-time WebRTC DataChannels."),
            ("Integrated Output Console", "Simulates test execution results directly within the active peer room.")
        ])
    ], "screenshots/06_whiteboard_code.png", "Screen 6: In-Room Collaborative Tools — Sub-Second Whiteboard Synchronization & Real-Time Code Editor")

    # =============================================================
    # SLIDE 37: Screen 7 — Admin Analytics & Platform Governance (NEW SLIDE)
    # =============================================================
    s37 = prs.slides.add_slide(blank_layout)
    add_header(s37, "Screen 7 — Admin Analytics & Platform Governance")
    add_footer(s37, 37, 43)
    add_screenshot_full(s37, "screenshots/07_admin.png", "Screen 7: Central Administrator Portal — Multi-User Moderation, Dispute Arbitration, and System Health Telemetry")

    # =============================================================
    # SLIDE 38: Platform Analytics & Token Circulation Metrics
    # =============================================================
    s38 = prs.slides.add_slide(blank_layout)
    add_header(s38, "Platform Analytics & Token Circulation Metrics")
    add_footer(s38, 38, 43)
    add_centered_image(s38, "diagrams/analytics_graphs.png")

    # =============================================================
    # SLIDE 39: Security, Trust & Data Integrity Measures
    # =============================================================
    s39 = prs.slides.add_slide(blank_layout)
    add_header(s39, "Security, Trust & Data Integrity Measures")
    add_footer(s39, 39, 43)

    security_cards = [
        ("Identity & Access Management", [
            ("Cryptographic Passwords", "Bcrypt hashing with salt factor 10."),
            ("Stateless JWT Tokens", "HS256 signed tokens with 7-day expiration."),
            ("Role-Based Middleware", "Strict verification protects `/api/admin/*` and private classroom routes."),
            ("OAuth 2.0 Token Audit", "Official Google public key signature validation.")
        ]),
        ("Ledger & Financial Security", [
            ("Atomic Token Deductions", "Prisma multi-statement transactions prevent race conditions."),
            ("Escrow Holding Pattern", "Tokens locked during booking, eliminating payment fraud."),
            ("Immutable Audit Ledger", "Every token movement permanently recorded with UTC timestamps."),
            ("Double-Claim Prevention", "Strict state guards prevent multiple claims on bounty questions.")
        ]),
        ("Real-Time Communications Security", [
            ("DTLS / SRTP Encryption", "All WebRTC peer video and audio streams end-to-end encrypted."),
            ("Isolated Socket Rooms", "Signaling events strictly scoped to verified session participants."),
            ("STUN / TURN Authorization", "Short-lived credentials prevent unauthorized TURN relay usage."),
            ("Input Sanitization", "DOMPurify protects chat, notes, and discussion markdown.")
        ]),
        ("Data Protection & Integrity", [
            ("PostgreSQL Constraints", "Foreign keys enforce referential integrity across all tables."),
            ("Cascading Account Deletions", "GDPR/Privacy compliant deletion of user profiles."),
            ("Durable Session State", "Automatic ledger rollback if session confirmation encounters errors."),
            ("Rate Limiting Guard", "Brute-force protection on authentication endpoints.")
        ])
    ]
    for idx, (c_title, c_items) in enumerate(security_cards):
        row = idx // 2
        col = idx % 2
        left = Inches(0.8 + col * 6.0)
        top = Inches(1.55 + row * 2.65)
        add_card(s39, left, top, Inches(5.733), Inches(2.35), c_title, c_items,
                 header_color=PRIMARY_DARK, base_size=11, space_after=4)

    # =============================================================
    # SLIDE 40: Future Enhancements & Research Scope
    # =============================================================
    s40 = prs.slides.add_slide(blank_layout)
    add_header(s40, "Future Enhancements & Research Scope")
    add_footer(s40, 40, 43)

    future_left = [
        ("AI-Powered Semantic Matchmaking", "Integrating vector embeddings (pgvector) to semantically match learner syllabus goals with mentor project portfolios beyond simple keyword lookups."),
        ("Automated Session Summarization", "Leveraging speech-to-text models to generate structured lecture notes, flashcards, and action items automatically after each session concludes."),
        ("Multi-Peer Group Workshops", "Extending 1-on-1 WebRTC rooms into Selective Forwarding Unit (SFU) architectures supporting 10-20 student cohort seminars.")
    ]
    add_card(s40, Inches(0.8), Inches(1.55), Inches(5.7), Inches(4.85), "Short-Term Roadmap (6 Months)", 
             future_left, header_color=PRIMARY_DARK, base_size=12, space_after=12)

    future_right = [
        ("Native Mobile Applications", "Developing cross-platform React Native apps for iOS and Android with push notifications for instant session requests and reminders."),
        ("Decentralized Blockchain Credentialing", "Issuing verifiable cryptographic skill badges and micro-credentials on Polygon/Ethereum to provide tamper-proof academic certificates."),
        ("Campus LMS Integration", "LTI (Learning Tools Interoperability) plugins for seamless integration into Canvas, Moodle, and Blackboard university portals.")
    ]
    add_card(s40, Inches(6.833), Inches(1.55), Inches(5.7), Inches(4.85), "Long-Term Vision (12–24 Months)", 
             future_right, bg_color=WHITE, border_color=SECONDARY, header_color=SECONDARY, base_size=12, space_after=12)

    # =============================================================
    # SLIDE 41: Conclusion & Project Impact
    # =============================================================
    s41 = prs.slides.add_slide(blank_layout)
    add_header(s41, "Conclusion & Project Impact")
    add_footer(s41, 41, 43)

    add_card(s41, Inches(0.8), Inches(1.55), Inches(11.733), Inches(2.40), "Project Summary & Achievements", [
        ("Democratized Learning", "Successfully engineered a fully functional peer-to-peer educational ecosystem eliminating financial barriers through time-banking."),
        ("Production-Grade Real-Time Stack", "Integrated React 19, Node/Express, Prisma, PostgreSQL, Socket.io, and WebRTC for zero-install, browser-native learning sessions."),
        ("Auditable Trust & Token Economy", "Built robust atomic token transactions, escrow guarantees, and mutual trust ratings significantly reducing absentee rates and ghosting.")
    ], base_size=11.5, space_after=6)

    add_card(s41, Inches(0.8), Inches(4.15), Inches(11.733), Inches(2.40), "Academic & Societal Value", [
        ("Active Student Pedagogy", "Validates the educational principle that teaching a concept reinforces mastery far more effectively than passive lecture consumption."),
        ("Interdisciplinary Campus Collaboration", "Breaks departmental silos, allowing engineering, design, business, and science students to exchange specialized skills reciprocally."),
        ("Scalable Open Architecture", "Modular microservice-ready codebase adaptable to university departments, hackathons, and corporate mentorship programs.")
    ], bg_color=WHITE, border_color=PRIMARY, base_size=11.5, space_after=6)

    # =============================================================
    # SLIDE 42: Bibliography & References
    # =============================================================
    s42 = prs.slides.add_slide(blank_layout)
    add_header(s42, "Bibliography & References")
    add_footer(s42, 42, 43)

    ref_headers = ["Category / Domain", "Resource / Specification", "Application in Mindroot Platform"]
    ref_rows = [
        ["WebRTC Protocols", "RFC 8825 (Overview) / RFC 8826 (Security Architecture)", "Peer-to-peer browser audio/video streaming, DTLS encryption, and SRTP media integrity"],
        ["Calendar Standards", "RFC 5545 — Internet Calendaring and Scheduling (iCalendar)", "Direct generation of universal .ics meeting invitations with pre-filled classroom URLs"],
        ["Real-Time Networking", "Socket.io Engine & WebSocket Protocol (RFC 6455)", "Full-duplex signaling channel, instant session notifications, and whiteboard drawing synchronization"],
        ["Database Architecture", "Prisma ORM & PostgreSQL Official Documentation", "Declarative schema modeling, ACID transactions for token wallet deductions, and pooling"],
        ["Frontend Engineering", "React 19 Documentation & Zustand Architecture Guides", "High-performance reactive UI rendering, state management, and custom WebRTC hooks"],
        ["Authentication Standards", "RFC 7519 — JSON Web Token (JWT) & Google Identity OAuth 2.0", "Stateless authentication tokens, role verification guards, and single sign-on credential verification"],
        ["UI/UX Design Systems", "Tailwind CSS & Google Material Design 3 Guidelines", "Responsive design, unified slate/emerald color scheme, card-based component hierarchy"]
    ]
    add_table(s42, Inches(0.8), Inches(1.55), Inches(11.733), Inches(4.90), ref_headers, ref_rows,
              col_widths=[Inches(2.4), Inches(4.3), Inches(5.033)], header_size=11.5, data_size=10.0)
"""

code = code[:old_slides_start] + new_slides_code + code[old_slides_end:]

with open('scripts/generate_v4_perfected.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Created scripts/generate_v4_perfected.py successfully!")
