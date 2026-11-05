import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
import os

def set_cell_background(cell, fill_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_table_borders(table, color="B0B0B0", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="none"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def build_index_document():
    doc = docx.Document()

    # Set 1 inch margins all around
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Set normal style font to Times New Roman
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(12)
    font.color.rgb = RGBColor(0x22, 0x22, 0x22)

    # ==========================================
    # PAGE 1: TITLE / COVER PAGE
    # ==========================================
    p_a = doc.add_paragraph()
    p_a.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_a.paragraph_format.space_before = Pt(0)
    p_a.paragraph_format.space_after = Pt(2)
    run_a = p_a.add_run("A")
    run_a.font.size = Pt(14)
    run_a.font.bold = True

    p_rep = doc.add_paragraph()
    p_rep.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_rep.paragraph_format.space_after = Pt(8)
    run_rep = p_rep.add_run("PROJECT REPORT ON")
    run_rep.font.size = Pt(16)
    run_rep.font.bold = True

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_after = Pt(4)
    run_title = p_title.add_run("MINDROOT: PEER SKILL EXCHANGE PLATFORM")
    run_title.font.size = Pt(20)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D) # Academic Navy

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(14)
    run_sub = p_sub.add_run("(STUDENT-TO-STUDENT COLLABORATIVE LEARNING & TOKEN ECONOMY SYSTEM)")
    run_sub.font.size = Pt(11)
    run_sub.font.bold = True
    run_sub.font.italic = True
    run_sub.font.color.rgb = RGBColor(0x44, 0x55, 0x66)

    p_subm = doc.add_paragraph()
    p_subm.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_subm.paragraph_format.space_after = Pt(2)
    run_subm = p_subm.add_run("SUBMITTED IN PARTIAL FULFILLMENT FOR AWARD OF")
    run_subm.font.size = Pt(11)

    p_deg = doc.add_paragraph()
    p_deg.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_deg.paragraph_format.space_after = Pt(2)
    run_deg = p_deg.add_run("DEGREE IN")
    run_deg.font.size = Pt(11)
    run_deg.font.bold = True

    p_bca = doc.add_paragraph()
    p_bca.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_bca.paragraph_format.space_after = Pt(2)
    run_bca = p_bca.add_run("Bachelor of Computer Applications (BCA) Semester-6")
    run_bca.font.size = Pt(13)
    run_bca.font.bold = True

    p_yr = doc.add_paragraph()
    p_yr.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_yr.paragraph_format.space_after = Pt(14)
    run_yr = p_yr.add_run("(YEAR 2025-2026)")
    run_yr.font.size = Pt(11)
    run_yr.font.bold = True

    p_by = doc.add_paragraph()
    p_by.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_by.paragraph_format.space_after = Pt(4)
    run_by = p_by.add_run("By")
    run_by.font.size = Pt(12)
    run_by.font.bold = True

    p_st = doc.add_paragraph()
    p_st.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_st.paragraph_format.space_after = Pt(14)
    run_s1 = p_st.add_run("Nayak Pragati (BCA33424041036)\n")
    run_s1.font.size = Pt(12)
    run_s1.font.bold = True
    run_s2 = p_st.add_run("Prajapati Vidhi (BCA33424041079)")
    run_s2.font.size = Pt(12)
    run_s2.font.bold = True

    p_subto = doc.add_paragraph()
    p_subto.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_subto.paragraph_format.space_after = Pt(8)
    run_subto = p_subto.add_run("SUBMITTED TO")
    run_subto.font.size = Pt(12)
    run_subto.font.bold = True

    # Logo
    if os.path.exists("college_logo.png"):
        p_logo = doc.add_paragraph()
        p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_logo.paragraph_format.space_after = Pt(8)
        p_logo.add_run().add_picture("college_logo.png", width=Inches(1.5))

    p_inst = doc.add_paragraph()
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst.paragraph_format.space_after = Pt(2)
    run_inst = p_inst.add_run("GROW MORE GROUP OF INSTITUTIONS")
    run_inst.font.size = Pt(13)
    run_inst.font.bold = True

    p_loc1 = doc.add_paragraph()
    p_loc1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_loc1.paragraph_format.space_after = Pt(2)
    run_loc1 = p_loc1.add_run("HIMATNAGAR, GUJARAT – 383001")
    run_loc1.font.size = Pt(11)

    p_aff = doc.add_paragraph()
    p_aff.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_aff.paragraph_format.space_after = Pt(4)
    run_aff = p_aff.add_run("(AFFILIATED TO HEMCHANDRACHARYA NORTH GUJARAT UNIVERSITY, PATAN)")
    run_aff.font.size = Pt(10)
    run_aff.font.italic = True

    p_bca_inst = doc.add_paragraph()
    p_bca_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_bca_inst.paragraph_format.space_after = Pt(2)
    run_bca_inst = p_bca_inst.add_run("GROW MORE INSTITUTE OF BCA")
    run_bca_inst.font.size = Pt(13)
    run_bca_inst.font.bold = True

    p_loc2 = doc.add_paragraph()
    p_loc2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_loc2.paragraph_format.space_after = Pt(0)
    run_loc2 = p_loc2.add_run("HIMATNAGAR, GUJARAT – 383001")
    run_loc2.font.size = Pt(11)

    # Page Break
    doc.add_page_break()

    # ==========================================
    # PAGE 2: CERTIFICATE
    # ==========================================
    if os.path.exists("college_logo.png"):
        p_c_logo = doc.add_paragraph()
        p_c_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_c_logo.paragraph_format.space_before = Pt(0)
        p_c_logo.paragraph_format.space_after = Pt(8)
        p_c_logo.add_run().add_picture("college_logo.png", width=Inches(1.4))

    p_cert = doc.add_paragraph()
    p_cert.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert.paragraph_format.space_after = Pt(14)
    run_cert = p_cert.add_run("C E R T I F I C A T E")
    run_cert.font.size = Pt(18)
    run_cert.font.bold = True
    run_cert.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    p_cert_text1 = doc.add_paragraph()
    p_cert_text1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert_text1.paragraph_format.space_after = Pt(6)
    run_ct1 = p_cert_text1.add_run("This is to certify that the project entitled")
    run_ct1.font.size = Pt(12)

    p_cert_title = doc.add_paragraph()
    p_cert_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert_title.paragraph_format.space_after = Pt(8)
    run_ctitle = p_cert_title.add_run("MINDROOT: PEER SKILL EXCHANGE PLATFORM\n(STUDENT TO STUDENT)")
    run_ctitle.font.size = Pt(15)
    run_ctitle.font.bold = True
    run_ctitle.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    p_cert_sub = doc.add_paragraph()
    p_cert_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert_sub.paragraph_format.space_after = Pt(2)
    run_csub = p_cert_sub.add_run("SUBMITTED IN PARTIAL FULFILLMENT FOR AWARD OF")
    run_csub.font.size = Pt(11)

    p_cert_deg = doc.add_paragraph()
    p_cert_deg.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert_deg.paragraph_format.space_after = Pt(2)
    run_cdeg = p_cert_deg.add_run("DEGREE IN")
    run_cdeg.font.size = Pt(11)
    run_cdeg.font.bold = True

    p_cert_sem = doc.add_paragraph()
    p_cert_sem.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert_sem.paragraph_format.space_after = Pt(2)
    run_csem = p_cert_sem.add_run("BCA Department Semester-06")
    run_csem.font.size = Pt(13)
    run_csem.font.bold = True

    p_cert_univ = doc.add_paragraph()
    p_cert_univ.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert_univ.paragraph_format.space_after = Pt(10)
    run_cuniv = p_cert_univ.add_run("H.N.G.U., PATAN")
    run_cuniv.font.size = Pt(12)
    run_cuniv.font.bold = True

    p_cert_bona = doc.add_paragraph()
    p_cert_bona.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert_bona.paragraph_format.space_after = Pt(6)
    run_cbona = p_cert_bona.add_run("Is a result of the Bonafide work carried out by")
    run_cbona.font.size = Pt(12)

    p_cert_st = doc.add_paragraph()
    p_cert_st.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert_st.paragraph_format.space_after = Pt(8)
    run_cst1 = p_cert_st.add_run("Nayak Pragati (BCA33424041036)\n")
    run_cst1.font.size = Pt(13)
    run_cst1.font.bold = True
    run_cst2 = p_cert_st.add_run("Prajapati Vidhi (BCA33424041079)")
    run_cst2.font.size = Pt(13)
    run_cst2.font.bold = True

    p_cert_dur = doc.add_paragraph()
    p_cert_dur.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert_dur.paragraph_format.space_after = Pt(36)
    run_cdur = p_cert_dur.add_run("During the year 2025-2026")
    run_cdur.font.size = Pt(12)
    run_cdur.font.bold = True

    # Signature Table
    sig_table = doc.add_table(rows=2, cols=2)
    sig_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_table.autofit = False

    sig_table.columns[0].width = Inches(3.2)
    sig_table.columns[1].width = Inches(3.2)

    cell_guide_head = sig_table.cell(0, 0)
    cell_guide_head.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_gh = cell_guide_head.paragraphs[0].add_run("Internal Guide / Mentor")
    r_gh.font.size = Pt(12)
    r_gh.font.bold = True

    cell_princ_head = sig_table.cell(0, 1)
    cell_princ_head.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_ph = cell_princ_head.paragraphs[0].add_run("I/C Principal / HOD")
    r_ph.font.size = Pt(12)
    r_ph.font.bold = True

    cell_guide_val = sig_table.cell(1, 0)
    p_gv = cell_guide_val.paragraphs[0]
    p_gv.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_gv.paragraph_format.space_before = Pt(32)
    r_gv1 = p_gv.add_run("Prof. Ronak Joshi\n")
    r_gv1.font.size = Pt(12)
    r_gv1.font.bold = True
    r_gv2 = p_gv.add_run("(Project Mentor / Assistant Professor)")
    r_gv2.font.size = Pt(11)

    cell_princ_val = sig_table.cell(1, 1)
    p_pv = cell_princ_val.paragraphs[0]
    p_pv.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_pv.paragraph_format.space_before = Pt(32)
    r_pv1 = p_pv.add_run("Mr. Shailesh Makani\n")
    r_pv1.font.size = Pt(12)
    r_pv1.font.bold = True
    r_pv2 = p_pv.add_run("(Head of Department, BCA)")
    r_pv2.font.size = Pt(11)

    # Page Break
    doc.add_page_break()

    # ==========================================
    # PAGE 3: PREFACE
    # ==========================================
    p_pref_h = doc.add_paragraph()
    p_pref_h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_pref_h.paragraph_format.space_before = Pt(0)
    p_pref_h.paragraph_format.space_after = Pt(16)
    r_prh = p_pref_h.add_run("PREFACE")
    r_prh.font.size = Pt(16)
    r_prh.font.bold = True
    r_prh.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    pref_paras = [
        "The project report entitled “Mindroot: Peer Skill Exchange Platform (Student to Student)” is submitted as partial fulfillment of the requirements for the award of the degree of Bachelor of Computer Applications (BCA) under Hemchandracharya North Gujarat University (H.N.G.U.), Patan, through Grow More Institute of BCA, Himatnagar.",
        "In modern higher education institutions, students possess diverse and complementary talents. A student excelling in modern web technologies, React, or Python machine learning may simultaneously seek guidance in Data Structures, Database Management, or UI/UX Design. However, conventional learning mechanisms present significant barriers: commercial tutoring services charge steep hourly rates ($20–$80/hr) that full-time undergraduate students cannot afford, while ad-hoc informal study groups formed on WhatsApp or Discord suffer from high scheduling friction, lack of commitment, and unreliability.",
        "To overcome these fundamental challenges, this project conceptualizes, designs, and implements “Mindroot” — a student-to-student peer knowledge and skill barter platform. Mindroot introduces an equalized Time-Banking Skill Token Economy: one hour of teaching earns one Skill Token, which can subsequently be redeemed to book one hour of personalized learning from another peer. By eliminating monetary barriers, the system democratizes academic help and fosters a collaborative campus culture.",
        "The platform delivers a comprehensive, zero-install virtual learning environment featuring peer-to-peer WebRTC video and audio conferencing, a synchronized real-time drawing whiteboard, a collaborative live coding editor, an automated escrow token locking system to prevent disputes, and standard RFC-5545 calendar (.ics) invitation export for seamless timetable integration.",
        "This project integrates the theoretical knowledge of software engineering, database management, distributed architectures, and real-time network synchronization gained throughout our BCA curriculum into a production-grade, responsive web application. We trust that this project report will provide a clear, comprehensive, and in-depth view of the system’s design, engineering methodologies, and real-world implementation."
    ]

    for text in pref_paras:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(8)
        run = p.add_run(text)
        run.font.size = Pt(11.5)

    # Page Break
    doc.add_page_break()

    # ==========================================
    # PAGE 4: ACKNOWLEDGEMENT
    # ==========================================
    p_ack_h = doc.add_paragraph()
    p_ack_h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_ack_h.paragraph_format.space_before = Pt(0)
    p_ack_h.paragraph_format.space_after = Pt(16)
    r_akh = p_ack_h.add_run("ACKNOWLEDGEMENT")
    r_akh.font.size = Pt(16)
    r_akh.font.bold = True
    r_akh.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    ack_paras = [
        "We take immense pride and pleasure in presenting this project report on “Mindroot: Peer Skill Exchange Platform”, developed as an essential part of the curriculum for the Bachelor of Computer Applications (BCA) program.",
        "First and foremost, we express our deep sense of gratitude and sincere thanks to Prof. Shailesh Makani (Head of Department & I/C Principal, BCA, Grow More Institute of BCA) for providing the state-of-the-art computer laboratories, infrastructural support, and an encouraging academic environment essential for the successful completion of this project.",
        "We are profoundly thankful to Hemchandracharya North Gujarat University (H.N.G.U.), Patan, for designing a forward-thinking curriculum that includes practical system development, allowing us to bridge academic theory with industry-standard engineering practices.",
        "We extend our heartfelt gratitude and warmest appreciation to our respected internal project guide and mentor, Prof. Ronak Joshi (Assistant Professor, BCA Department), for his patient guidance, constant encouragement, valuable technical advice, and insightful critiques throughout the design, implementation, and documentation phases of Mindroot. His mentorship has been an invaluable asset in shaping this project.",
        "We also convey our sincere thanks to all faculty and staff members of the BCA Department for their cooperation, knowledge sharing, and timely assistance.",
        "Finally, we wish to express our heartfelt indebtedness to our parents, family members, and classmates for their moral support, understanding, and persistent encouragement throughout the tenure of this work."
    ]

    for text in ack_paras:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(8)
        run = p.add_run(text)
        run.font.size = Pt(11.5)

    p_ack_sig = doc.add_paragraph()
    p_ack_sig.paragraph_format.space_before = Pt(20)
    p_ack_sig.paragraph_format.space_after = Pt(4)
    run_as1 = p_ack_sig.add_run("Nayak Pragati (BCA33424041036)\n")
    run_as1.font.size = Pt(12)
    run_as1.font.bold = True
    run_as2 = p_ack_sig.add_run("Prajapati Vidhi (BCA33424041079)")
    run_as2.font.size = Pt(12)
    run_as2.font.bold = True

    # Page Break
    doc.add_page_break()

    # ==========================================
    # PAGE 5: DECLARATION
    # ==========================================
    p_dec_h = doc.add_paragraph()
    p_dec_h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_dec_h.paragraph_format.space_before = Pt(0)
    p_dec_h.paragraph_format.space_after = Pt(16)
    r_dch = p_dec_h.add_run("DECLARATION")
    r_dch.font.size = Pt(16)
    r_dch.font.bold = True
    r_dch.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    dec_paras = [
        "We, NAYAK PRAGATI (Seat No: BCA33424041036) and PRAJAPATI VIDHI (Seat No: BCA33424041079), students of Bachelor of Computer Applications (BCA Semester-VI), hereby declare that the project report entitled “MINDROOT: PEER SKILL EXCHANGE PLATFORM (STUDENT TO STUDENT)” submitted to Grow More Institute of BCA, Himatnagar, affiliated with Hemchandracharya North Gujarat University (H.N.G.U.), Patan, is a record of authentic and original work carried out by us under the internal guidance and mentorship of Prof. Ronak Joshi.",
        "We solemnly declare that the system architecture, source code, data dictionary, system designs, and documentation presented in this project report reflect our own original work and efforts, except where explicit acknowledgments and citations have been made to open-source libraries and standard technical documentation.",
        "We further state that this project has not been submitted, either in whole or in part, to any other university, institute, or board for the award of any degree, diploma, or academic certificate."
    ]

    for text in dec_paras:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(10)
        run = p.add_run(text)
        run.font.size = Pt(11.5)

    # Signature layout table
    p_dec_space = doc.add_paragraph()
    p_dec_space.paragraph_format.space_before = Pt(36)

    dec_table = doc.add_table(rows=1, cols=2)
    dec_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    dec_table.columns[0].width = Inches(3.2)
    dec_table.columns[1].width = Inches(3.2)

    c0 = dec_table.cell(0, 0)
    p0 = c0.paragraphs[0]
    p0.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r0_name = p0.add_run("NAYAK PRAGATI\n")
    r0_name.font.size = Pt(12)
    r0_name.font.bold = True
    r0_seat = p0.add_run("Seat No: BCA33424041036")
    r0_seat.font.size = Pt(11)

    c1 = dec_table.cell(0, 1)
    p1 = c1.paragraphs[0]
    p1.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r1_name = p1.add_run("PRAJAPATI VIDHI\n")
    r1_name.font.size = Pt(12)
    r1_name.font.bold = True
    r1_seat = p1.add_run("Seat No: BCA33424041079")
    r1_seat.font.size = Pt(11)

    # Page Break
    doc.add_page_break()

    # ==========================================
    # PAGE 6: INDEX (TABLE OF CONTENTS)
    # ==========================================
    p_idx_h = doc.add_paragraph()
    p_idx_h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_idx_h.paragraph_format.space_before = Pt(0)
    p_idx_h.paragraph_format.space_after = Pt(14)
    r_ixh = p_idx_h.add_run("INDEX")
    r_ixh.font.size = Pt(16)
    r_ixh.font.bold = True
    r_ixh.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    # Table of contents data matching the structure from reference
    index_items = [
        ("1", "About University (Hemchandracharya North Gujarat University)", "1", True),
        ("2", "About Institute (Grow More Institute of BCA)", "2", True),
        ("3", "Project Profile & Metadata", "3", True),
        ("4", "Technical Specification", "4", True),
        ("", "4.1 Hardware Specification", "4", False),
        ("", "4.2 Software Specification", "4", False),
        ("5", "Project Description & Problem Statement", "5", True),
        ("", "5.1 Existing System & Current Practices", "5", False),
        ("", "5.2 Need For New System (Democratizing Peer Tutoring)", "5", False),
        ("", "5.3 Proposed System & Core Objectives", "6", False),
        ("6", "Functional Specification & Modules", "7", True),
        ("", "6.1 User Authentication & Role Management (JWT / Google SSO)", "7", False),
        ("", "6.2 Skill Catalog & Smart Bilateral Matching Engine", "8", False),
        ("", "6.3 Session Booking & Atomic Token Escrow Lock", "8", False),
        ("", "6.4 WebRTC Virtual Classroom (P2P Audio/Video)", "9", False),
        ("", "6.5 Real-Time Interactive Whiteboard & Code Editor", "9", False),
        ("", "6.6 Real-Time Messaging & Socket.io Event Dispatch", "10", False),
        ("", "6.7 Peer Reviews, Ratings & Trust Scoring Algorithm", "10", False),
        ("", "6.8 Admin Control Panel & Platform Metrics", "11", False),
        ("7", "Feasibility Study", "12", True),
        ("", "7.1 Technical Feasibility", "12", False),
        ("", "7.2 Operational Feasibility", "12", False),
        ("", "7.3 Economic Feasibility", "13", False),
        ("8", "Timeline Chart (Gantt Chart)", "14", True),
        ("9", "System Flowcharts", "15", True),
        ("", "9.1 User Onboarding & Profile Verification Flow", "15", False),
        ("", "9.2 Skill Matching & Session Booking Flow", "16", False),
        ("", "9.3 WebRTC Virtual Classroom & Escrow Release Flow", "17", False),
        ("10", "Data Flow Diagram (DFD)", "18", True),
        ("", "10.1 Context Level DFD (Level 0)", "18", False),
        ("", "10.2 First Level DFD (Level 1) - Admin Perspective", "19", False),
        ("", "10.3 First Level DFD (Level 1) - User Perspective", "20", False),
        ("", "10.4 Second Level DFD (Level 2) - Escrow & Session Scheduling", "21", False),
        ("11", "Data Dictionary & Relational Schema", "22", True),
        ("", "11.1 User Master Table (User)", "22", False),
        ("", "11.2 Skill Master Table (Skill)", "23", False),
        ("", "11.3 UserSkill Relational Join Table (UserSkill)", "23", False),
        ("", "11.4 Session Master Table (Session)", "24", False),
        ("", "11.5 Transaction & Escrow Table (Transaction)", "25", False),
        ("", "11.6 Review & Rating Table (Review)", "25", False),
        ("", "11.7 Chat Message Table (Message)", "26", False),
        ("12", "E-R (Entity-Relationship) Diagram", "27", True),
        ("13", "User Interface Design & Screen Layouts", "28", True),
        ("", "13.1 Landing & Hero Page", "28", False),
        ("", "13.2 Peer Discovery & Skill Match Search", "29", False),
        ("", "13.3 Session Booking & iCal Calendar Export Modal", "30", False),
        ("", "13.4 WebRTC Live Classroom (Video, Whiteboard, Code Editor)", "31", False),
        ("", "13.5 Wallet & Skill Token Transaction Ledger", "32", False),
        ("", "13.6 User Profile & Competency Management", "33", False),
        ("", "13.7 Admin Metrics & Supervision Dashboard", "34", False),
        ("14", "Future Enhancements & Scalability", "35", True),
        ("15", "Bibliography & Web References", "37", True),
    ]

    # Create table for index
    table = doc.add_table(rows=len(index_items) + 1, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    # Set column widths
    col_widths = [Inches(1.0), Inches(4.5), Inches(1.0)]
    for row in table.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = width

    # Format Header Row
    hdr_cells = table.rows[0].cells
    hdr_titles = ["Sr. No.", "Title", "Page No."]
    for idx, title in enumerate(hdr_titles):
        hdr_cells[idx].text = title
        p = hdr_cells[idx].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if idx != 1 else WD_ALIGN_PARAGRAPH.LEFT
        p.runs[0].font.bold = True
        p.runs[0].font.size = Pt(11.5)
        p.runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_background(hdr_cells[idx], "1B365D") # Navy background
        set_cell_margins(hdr_cells[idx], top=140, bottom=140, left=150, right=150)

    # Fill rows
    for row_idx, item in enumerate(index_items, start=1):
        sr_no, title, page_no, is_main = item
        cells = table.rows[row_idx].cells

        # Sr No
        cells[0].text = sr_no
        p0 = cells[0].paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if is_main and p0.runs:
            p0.runs[0].font.bold = True
            p0.runs[0].font.size = Pt(11)
        elif p0.runs:
            p0.runs[0].font.size = Pt(10.5)

        # Title
        cells[1].text = title
        p1 = cells[1].paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.LEFT
        if is_main and p1.runs:
            p1.runs[0].font.bold = True
            p1.runs[0].font.size = Pt(11)
            p1.runs[0].font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)
        elif p1.runs:
            p1.runs[0].font.size = Pt(10.5)
            # Indent subtopics slightly
            p1.paragraph_format.left_indent = Inches(0.2)

        # Page No
        cells[2].text = page_no
        p2 = cells[2].paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if is_main and p2.runs:
            p2.runs[0].font.bold = True
            p2.runs[0].font.size = Pt(11)
        elif p2.runs:
            p2.runs[0].font.size = Pt(10.5)

        # Subtle zebra striping for alternating rows
        bg_color = "F7F9FB" if row_idx % 2 == 1 else "FFFFFF"
        for c in cells:
            set_cell_background(c, bg_color)
            set_cell_margins(c, top=80, bottom=80, left=120, right=120)

    # Apply borders
    set_table_borders(table, color="D0D5DD", sz="4", val="single")

    output_path = "index.docx"
    try:
        doc.save(output_path)
        print(f"Document successfully created and saved to {output_path}")
    except PermissionError:
        alt_path = "index_updated.docx"
        doc.save(alt_path)
        print(f"Notice: '{output_path}' is currently open in Word. Saved to '{alt_path}' instead.")

if __name__ == "__main__":
    build_index_document()
