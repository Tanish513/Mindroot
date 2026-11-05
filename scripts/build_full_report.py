import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_table_borders(table, color="D0D5DD", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:right w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def add_heading_1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.size = Pt(15)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)
    return p

def add_heading_2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.size = Pt(12.5)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
    return p

def add_body_p(doc, text, bold_prefix=None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(6)
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.font.size = Pt(11)
        r_pre.font.bold = True
    run = p.add_run(text)
    run.font.size = Pt(11)
    return p

def add_bullet_p(doc, text, bold_title=None):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    if bold_title:
        r_b = p.add_run(bold_title)
        r_b.font.size = Pt(11)
        r_b.font.bold = True
    run = p.add_run(text)
    run.font.size = Pt(11)
    return p

def add_image_safe(doc, img_path, width_inches=6.2, caption=None):
    if os.path.exists(img_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        p_img.add_run().add_picture(img_path, width=Inches(width_inches))
        if caption:
            p_cap = doc.add_paragraph()
            p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_cap.paragraph_format.space_after = Pt(10)
            r_cap = p_cap.add_run(caption)
            r_cap.font.size = Pt(10)
            r_cap.font.italic = True
            r_cap.font.bold = True
            r_cap.font.color.rgb = RGBColor(0x55, 0x66, 0x77)

def build_data_dict_table(doc, title, headers, rows):
    p_t = doc.add_paragraph()
    p_t.paragraph_format.space_before = Pt(12)
    p_t.paragraph_format.space_after = Pt(4)
    r_t = p_t.add_run(title)
    r_t.font.bold = True
    r_t.font.size = Pt(12)
    r_t.font.color.rgb = RGBColor(0x93, 0x33, 0xEA)

    tbl = doc.add_table(rows=len(rows)+1, cols=len(headers))
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False

    hdr_cells = tbl.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = h
        p = hdr_cells[i].paragraphs[0]
        p.runs[0].font.bold = True
        p.runs[0].font.size = Pt(10)
        p.runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_background(hdr_cells[i], "9333EA")
        set_cell_margins(hdr_cells[i], top=90, bottom=90, left=110, right=110)

    for r_idx, row in enumerate(rows, start=1):
        cells = tbl.rows[r_idx].cells
        bg = "FAF5FF" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row):
            cells[c_idx].text = str(val)
            p = cells[c_idx].paragraphs[0]
            if p.runs:
                p.runs[0].font.size = Pt(9.5)
            set_cell_background(cells[c_idx], bg)
            set_cell_margins(cells[c_idx], top=60, bottom=60, left=90, right=90)

    set_table_borders(tbl, color="E9D5FF")
    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_after = Pt(6)

def generate_complete_project_report():
    doc = docx.Document()

    # Set 1 inch margins all around
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Base font: Times New Roman
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(11)
    font.color.rgb = RGBColor(0x22, 0x22, 0x22)

    # ==========================================
    # FRONT MATTER: PAGE 1 (COVER)
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
    run_title.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

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

    doc.add_page_break()

    # ==========================================
    # FRONT MATTER: CERTIFICATE
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

    doc.add_page_break()

    # ==========================================
    # FRONT MATTER: PREFACE
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
        add_body_p(doc, text)

    doc.add_page_break()

    # ==========================================
    # FRONT MATTER: ACKNOWLEDGEMENT
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
        add_body_p(doc, text)

    p_ack_sig = doc.add_paragraph()
    p_ack_sig.paragraph_format.space_before = Pt(20)
    p_ack_sig.paragraph_format.space_after = Pt(4)
    run_as1 = p_ack_sig.add_run("Nayak Pragati (BCA33424041036)\n")
    run_as1.font.size = Pt(12)
    run_as1.font.bold = True
    run_as2 = p_ack_sig.add_run("Prajapati Vidhi (BCA33424041079)")
    run_as2.font.size = Pt(12)
    run_as2.font.bold = True

    doc.add_page_break()

    # ==========================================
    # FRONT MATTER: DECLARATION
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
        add_body_p(doc, text)

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

    doc.add_page_break()

    # ==========================================
    # FRONT MATTER: INDEX
    # ==========================================
    p_idx_h = doc.add_paragraph()
    p_idx_h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_idx_h.paragraph_format.space_before = Pt(0)
    p_idx_h.paragraph_format.space_after = Pt(14)
    r_ixh = p_idx_h.add_run("INDEX")
    r_ixh.font.size = Pt(16)
    r_ixh.font.bold = True
    r_ixh.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

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

    tbl_idx = doc.add_table(rows=len(index_items) + 1, cols=3)
    tbl_idx.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_idx.autofit = False

    col_widths = [Inches(1.0), Inches(4.5), Inches(1.0)]
    for row in tbl_idx.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = width

    hdr_cells = tbl_idx.rows[0].cells
    hdr_titles = ["Sr. No.", "Title", "Page No."]
    for idx, title in enumerate(hdr_titles):
        hdr_cells[idx].text = title
        p = hdr_cells[idx].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if idx != 1 else WD_ALIGN_PARAGRAPH.LEFT
        p.runs[0].font.bold = True
        p.runs[0].font.size = Pt(11)
        p.runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_background(hdr_cells[idx], "1B365D")
        set_cell_margins(hdr_cells[idx], top=120, bottom=120, left=140, right=140)

    for row_idx, item in enumerate(index_items, start=1):
        sr_no, title, page_no, is_main = item
        cells = tbl_idx.rows[row_idx].cells

        cells[0].text = sr_no
        p0 = cells[0].paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if is_main and p0.runs:
            p0.runs[0].font.bold = True
            p0.runs[0].font.size = Pt(10.5)

        cells[1].text = title
        p1 = cells[1].paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.LEFT
        if is_main and p1.runs:
            p1.runs[0].font.bold = True
            p1.runs[0].font.size = Pt(10.5)
            p1.runs[0].font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)
        elif p1.runs:
            p1.runs[0].font.size = Pt(10)
            p1.paragraph_format.left_indent = Inches(0.2)

        cells[2].text = page_no
        p2 = cells[2].paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if is_main and p2.runs:
            p2.runs[0].font.bold = True

        bg_color = "F7F9FB" if row_idx % 2 == 1 else "FFFFFF"
        for c in cells:
            set_cell_background(c, bg_color)
            set_cell_margins(c, top=70, bottom=70, left=100, right=100)

    set_table_borders(tbl_idx, color="D0D5DD", sz="4", val="single")
    doc.add_page_break()

    # ==========================================
    # CHAPTER 1: ABOUT UNIVERSITY
    # ==========================================
    add_heading_1(doc, "CHAPTER – 1 ABOUT UNIVERSITY")
    add_image_safe(doc, "hngu_building.jpg", width_inches=6.0, caption="Sardar Vallabhbhai Patel Prashasnik Bhavan — Hemchandracharya North Gujarat University, Patan")

    add_body_p(doc, "Hemchandracharya North Gujarat University (HNGU) is a prominent public state university located in the historical city of Patan, Gujarat, India. It was established in the year 1986 under Gujarat Ordinance No. 5 of 1986, which was later passed as Gujarat Act No. 22 of 1986 by the Legislative Assembly of Gujarat. The university was established to cater to the higher educational requirements of the North Gujarat region covering five major districts: Patan, Mehsana, Banaskantha, Sabarkantha, and Aravalli.")
    add_body_p(doc, "The university is respectfully named after the illustrious 12th-century Jain scholar, philosopher, grammarian, and polymath Acharya Hemachandra, whose monumental literary contributions earned him the title “Kalikalasarvajna” (the omniscient of the modern era). The institution draws eternal inspiration from his quest for multifaceted knowledge and wisdom.")
    add_body_p(doc, "HNGU is accredited with an 'A' grade by the National Assessment and Accreditation Council (NAAC) and offers an expansive spectrum of academic disciplines spanning Undergraduate, Postgraduate, Professional, M.Phil., and Ph.D. degrees. Key faculties include Computer Applications & Information Technology, Management, Science, Life Sciences, Arts, Commerce, Education, Medicine, and Law.")
    add_body_p(doc, "The university campus spans over 225 acres of lush green grounds equipped with state-of-the-art technological infrastructure, high-speed campus-wide fiber-optic connectivity, advanced scientific research laboratories, modern multimedia auditoriums, central computerized libraries, and dedicated sports arenas. HNGU is deeply committed to academic excellence, innovative pedagogy, entrepreneurial incubation, and ethical research that transforms students into socially responsible, industry-ready professionals.")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 2: ABOUT INSTITUTE
    # ==========================================
    add_heading_1(doc, "CHAPTER – 2 ABOUT INSTITUTE")
    add_image_safe(doc, "growmore_building.jpg", width_inches=6.0, caption="Grow More Group of Institutions Campus — Himatnagar, Gujarat")

    add_body_p(doc, "Grow More Institute of BCA, situated in the educational hub of Himatnagar, Sabarkantha, Gujarat, is a premier higher education institution dedicated to delivering excellence in Computer Applications and Information Technology. The institute is affiliated with Hemchandracharya North Gujarat University, Patan, and approved by the Government of Gujarat.")
    add_body_p(doc, "The institute operates under the esteemed Grow More Group of Institutions (Grow More Foundation), a benchmark educational conglomerate founded with the visionary motto “Kelavanino Kabir Vad” (The Great Banyan Tree of Education). The foundation fosters holistic student growth by combining rigorous academic curricula with hands-on technical workshops, industrial internships, hackathons, and innovative project incubators.")
    add_body_p(doc, "The Bachelor of Computer Applications (BCA) curriculum at Grow More is specifically tailored to equip undergraduate scholars with deep theoretical foundations and bleeding-edge practical proficiency. Key curricular focal points include Full-Stack Web Engineering, Object-Oriented Software Design, Distributed Database Management Systems, Data Structures & Algorithms, Network Architectures, and Cloud Computing.")
    add_body_p(doc, "Campus infrastructure boasts air-conditioned high-performance computer laboratories, gigabit internet connectivity, modern audio-visual smart lecture halls, an extensive digital library with access to leading IEEE and ACM research journals, and active student innovation cells. Under the proactive guidance of experienced faculty mentors and visionary leadership, Grow More Institute of BCA continuously produces skilled IT professionals who excel in top multinational software companies and prestigious postgraduate programs.")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 3: PROJECT PROFILE
    # ==========================================
    add_heading_1(doc, "CHAPTER – 3 PROJECT PROFILE")

    profile_data = [
        ("Project Title", "MINDROOT: PEER SKILL EXCHANGE PLATFORM\n(Student-to-Student Collaborative Learning & Token Economy)"),
        ("Organization / College", "Grow More Institute of BCA, Himatnagar"),
        ("Affiliated University", "Hemchandracharya North Gujarat University (H.N.G.U.), Patan"),
        ("Internal Project Guide", "Prof. Ronak Joshi (Project Mentor / Assistant Professor)"),
        ("Department Head / Principal", "Mr. Shailesh Makani (I/C Principal & Head of Department, BCA)"),
        ("Group Size", "2 Members"),
        ("Team Members", "1. Nayak Pragati (BCA33424041036)\n2. Prajapati Vidhi (BCA33424041079)"),
        ("Academic Year & Degree", "BCA Department Semester-6 (Year 2025–2026)"),
        ("Project Duration", "120 Hours (Academic Semester Project Lifecycle)"),
        ("Project Type", "Full-Stack Real-Time Web Application (P2P Barter & Video Classroom)"),
        ("Front-End Stack", "React 19, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion, Lucide Icons"),
        ("Back-End Stack", "Node.js, Express.js, TypeScript, Socket.io Real-Time Signaling Server"),
        ("Database & ORM", "PostgreSQL Database, Prisma ORM (with in-memory JSON fallback store)"),
        ("Real-Time Media Engine", "WebRTC Peer-to-Peer Engine (Audio/Video, DataChannels, STUN/TURN)"),
        ("Development Tools", "Visual Studio Code, Git, GitHub, Postman, Vite CLI, Docker")
    ]

    p_tbl = doc.add_table(rows=len(profile_data), cols=2)
    p_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    p_tbl.columns[0].width = Inches(2.2)
    p_tbl.columns[1].width = Inches(4.3)

    for r_i, (k, v) in enumerate(profile_data):
        c0 = p_tbl.cell(r_i, 0)
        c1 = p_tbl.cell(r_i, 1)
        c0.text = k
        c1.text = v
        p0 = c0.paragraphs[0]
        p1 = c1.paragraphs[0]
        p0.runs[0].font.bold = True
        p0.runs[0].font.size = Pt(10)
        p0.runs[0].font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)
        p1.runs[0].font.size = Pt(10)
        bg = "F8FAFC" if r_i % 2 == 1 else "FFFFFF"
        set_cell_background(c0, bg)
        set_cell_background(c1, bg)
        set_cell_margins(c0, top=70, bottom=70, left=90, right=90)
        set_cell_margins(c1, top=70, bottom=70, left=90, right=90)

    set_table_borders(p_tbl, color="CBD5E1")

    p_desc_h = doc.add_paragraph()
    p_desc_h.paragraph_format.space_before = Pt(12)
    p_desc_h.paragraph_format.space_after = Pt(4)
    r_dh = p_desc_h.add_run("Project Description:")
    r_dh.font.bold = True
    r_dh.font.size = Pt(11.5)
    r_dh.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    add_body_p(doc, "Mindroot is an innovative, real-time peer-to-peer knowledge and skill exchange ecosystem engineered specifically for university students. The platform replaces expensive traditional tutoring with an equitable Time-Banking economy where 1 hour of teaching earns 1 Skill Token, which can be spent to learn any other subject from a fellow student. It integrates a zero-install virtual classroom with WebRTC video/audio, an interactive synchronized drawing whiteboard, live collaborative code editor, atomic token escrow locking, and standard RFC-5545 (.ics) calendar sync.")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 4: TECHNICAL SPECIFICATION
    # ==========================================
    add_heading_1(doc, "CHAPTER – 4 TECHNICAL SPECIFICATION")

    add_heading_2(doc, "4.1 Hardware Specification")
    add_body_p(doc, "To ensure optimal development, compilation, and high-fidelity real-time WebRTC media streaming, the recommended hardware configuration is outlined below:")
    add_bullet_p(doc, " Intel Core i3 / AMD Ryzen 3 or higher (Core i5 / Ryzen 5 recommended for multi-stream encoding).", "Processor: ")
    add_bullet_p(doc, " Minimum 8 GB DDR4 RAM (16 GB recommended for concurrent Docker and dev servers).", "System Memory (RAM): ")
    add_bullet_p(doc, " Minimum 256 GB NVMe / SATA SSD with at least 20 GB free space for Node modules and database files.", "Storage (Hard Disk): ")
    add_bullet_p(doc, " Standard HD / Full HD Display (1920 × 1080 resolution recommended for dashboard testing).", "Display Monitor: ")
    add_bullet_p(doc, " Standard 720p/1080p Web Camera & Microphone required for WebRTC live video/audio classroom testing.", "Peripherals: ")
    add_bullet_p(doc, " High-speed broadband / Wi-Fi LAN connection (Minimum 10 Mbps) for peer-to-peer signaling.", "Network Connectivity: ")

    add_heading_2(doc, "4.2 Software Specification")
    add_body_p(doc, "The software stack incorporates enterprise-grade open-source tools and frameworks across client and server tiers:")
    add_bullet_p(doc, " Windows 10 / Windows 11 / Linux (Ubuntu 22.04 LTS) / macOS.", "Operating System: ")
    add_bullet_p(doc, " React 19, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion, Lucide React.", "Front-End Frameworks: ")
    add_bullet_p(doc, " Node.js (v18.0.0+ / v20 LTS), Express.js (TypeScript), Socket.io v4 Server.", "Back-End Technologies: ")
    add_bullet_p(doc, " PostgreSQL 15+ (Relational Database) with Prisma ORM v5 for type-safe queries.", "Database Tier: ")
    add_bullet_p(doc, " WebRTC P2P (SimplePeer, MediaStream APIs, STUN servers for NAT traversal).", "Real-Time Media Engine: ")
    add_bullet_p(doc, " Visual Studio Code (VS Code) with ESLint, Prettier, and Tailwind CSS IntelliSense.", "Development IDE: ")
    add_bullet_p(doc, " Google Chrome (v110+), Mozilla Firefox (v110+), or Microsoft Edge (Chromium).", "Testing Browsers: ")
    add_bullet_p(doc, " Git, GitHub, Postman (API testing), Docker & Docker-Compose (containerization).", "Supporting Tools: ")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 5: PROJECT DESCRIPTION
    # ==========================================
    add_heading_1(doc, "CHAPTER – 5 PROJECT DESCRIPTION")

    add_body_p(doc, "In the current higher education landscape, university students face a fundamental paradox: individual students possess advanced competencies in specific domains (e.g., modern JavaScript frameworks, Python data analytics, graphic design, algorithmic problem solving) while urgently needing academic assistance in others. However, existing options are severely flawed.")

    add_heading_2(doc, "5.1 Existing System & Current Practices")
    add_body_p(doc, "The current methods of seeking academic assistance within college campuses suffer from multiple structural handicaps:")
    add_bullet_p(doc, " Students resort to unorganized WhatsApp groups, Discord servers, or college noticeboards to search for study partners, leading to high search friction and fragmented communication.", "Informal & Ad-Hoc Searching: ")
    add_bullet_p(doc, " Commercial tutoring platforms (Chegg, Wyzant, private tutors) charge between $25 to $80 per hour, which is financially out of reach for full-time undergraduate students.", "Prohibitive Commercial Costs: ")
    add_bullet_p(doc, " Informal tutoring arrangements frequently suffer from tardiness, last-minute ghosting, and lack of accountability because no formal commitment or escrow mechanism exists.", "High Cancellation & Ghosting Rates: ")
    add_bullet_p(doc, " Students have no reliable way to verify a peer's competence or reliability beforehand. Previous tutoring records and feedback are lost across personal chat threads.", "No Standardized Reputation: ")
    add_bullet_p(doc, " Existing video tools (Zoom, Google Meet) require external links, have time restrictions, and lack integrated student tools like synchronized code editors and drawing whiteboards.", "Fragmented Tooling: ")

    add_heading_2(doc, "5.2 Need For New System")
    add_body_p(doc, "To overcome these persistent limitations, a modern, purpose-built peer learning platform is needed that provides:")
    add_bullet_p(doc, " Replacing currency with a Time-Banking Token Model where one hour of teaching earns one token, directly redeemable for one hour of learning.", "Equitable Knowledge Barter: ")
    add_bullet_p(doc, " Automatically matches students based on complementary 'Teaches' and 'Wants to Learn' skill tags.", "Bilateral Skill Matching: ")
    add_bullet_p(doc, " Tokens are automatically locked in escrow when a session is booked and released only upon successful session completion, preventing ghosting.", "Zero-Risk Escrow Mechanics: ")
    add_bullet_p(doc, " A unified browser workspace combining WebRTC audio/video, an interactive real-time whiteboard, and a collaborative code runner.", "All-in-One Virtual Classroom: ")
    add_bullet_p(doc, " Built-in RFC-5545 calendar export (.ics) for Google Calendar, Outlook, and Apple iCal integration.", "Seamless Timetable Integration: ")

    add_heading_2(doc, "5.3 Proposed System & Core Objectives")
    add_body_p(doc, "Mindroot: Peer Skill Exchange Platform delivers an end-to-end, zero-cost digital ecosystem. The core objectives achieved by the system are:")
    add_bullet_p(doc, " Provide seamless user onboarding via email/password and official Google OAuth 2.0 Single Sign-On.", "Secure Authentication: ")
    add_bullet_p(doc, " Maintain normalized skill taxonomy across Engineering, Design, AI, and Science disciplines.", "Dynamic Skill Directory: ")
    add_bullet_p(doc, " Establish a transparent ledger of token credits, debits, and pending escrow holds.", "Auditable Financial Ledger: ")
    add_bullet_p(doc, " Dynamic rating calculations (1.0 to 5.0) based on peer evaluations following each completed session.", "Trust Scoring Algorithm: ")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 6: FUNCTIONAL SPECIFICATION
    # ==========================================
    add_heading_1(doc, "CHAPTER – 6 FUNCTIONAL SPECIFICATION")
    add_body_p(doc, "The Functional Specification defines the core operational modules of the Mindroot platform:")

    modules = [
        ("1. User Authentication & Profile Module: ", "Supports dual-mode onboarding using standard bcrypt-hashed credentials and official Google OAuth 2.0 ID tokens. Users configure customized profiles containing bios, academic branches, skills they teach, and skills they wish to learn."),
        ("2. Skill Catalog & Bilateral Matching Engine: ", "Indexes competencies across Computer Science, Engineering, Design, and Sciences. The matchmaker algorithm performs bilateral cross-matching to immediately display peers whose teaching skills align with the logged-in student’s learning needs."),
        ("3. Session Booking & iCal Generator: ", "Enables students to select available date/time slots with peers. Upon booking, the system creates an RFC-5545 compliant `.ics` calendar invitation that imports directly into Google Calendar, Outlook, and Apple Calendar with the direct classroom URL."),
        ("4. Atomic Token Escrow Subsystem: ", "Guarantees fair play. When a session is scheduled, 1 Skill Token is decremented from the learner’s available wallet and placed into a secure escrow state. Upon session conclusion, the token is atomically transferred into the tutor’s wallet."),
        ("5. WebRTC Peer-to-Peer Virtual Classroom: ", "Establishes browser-to-browser audio and video communication via STUN signaling with zero plugin installation. Features microphone toggles, camera switching, screen sharing, and connection health monitors."),
        ("6. Real-Time Collaborative Whiteboard: ", "A shared vector canvas synchronized via WebSocket events. Students can sketch diagrams, annotate code logic, draw flowcharts, choose brush colors, and clear strokes in real time."),
        ("7. Synchronized Live Code Editor: ", "Built-in syntax-highlighted code editor supporting JavaScript, Python, TypeScript, and HTML/CSS. Peer edits synchronize bidirectionally with sub-50ms latency."),
        ("8. In-Platform Chat & Notifications: ", "Enables instant peer messaging before and during sessions. Employs Socket.io event dispatching to alert users of session confirmations, cancellations, and token credits."),
        ("9. Peer Review & Trust Scoring: ", "Post-session evaluation system where students rate peers on punctuality, knowledge depth, and communication skills. The system calculates a weighted trust score between 1.0 and 5.0."),
        ("10. Admin Supervision & Analytics: ", "Administrative dashboard displaying platform-wide metrics: total active learners, verified skills, circulating tokens, escrow velocity, and session dispute resolution tools.")
    ]

    for title, desc in modules:
        add_body_p(doc, desc, bold_prefix=title)

    doc.add_page_break()

    # ==========================================
    # CHAPTER 7: FEASIBILITY STUDY
    # ==========================================
    add_heading_1(doc, "CHAPTER – 7 FEASIBILITY STUDY")
    add_body_p(doc, "A comprehensive Feasibility Study was conducted prior to system implementation to evaluate the viability of the proposed system across key dimensions:")

    add_heading_2(doc, "7.1 Technical Feasibility")
    add_body_p(doc, "Technical feasibility assesses whether the necessary software technologies, developer competencies, and infrastructure are readily available:")
    add_bullet_p(doc, " Built on established, enterprise-ready web standards: React 19, TypeScript, Node.js, Express, Socket.io, and WebRTC.", "Modern Tech Stack: ")
    add_bullet_p(doc, " WebRTC is natively supported by modern Chromium, Gecko, and WebKit browsers, requiring no paid third-party SDKs or native desktop installations.", "Zero-Install Architecture: ")
    add_bullet_p(doc, " Prisma ORM provides strict schema validation and compile-time type safety with PostgreSQL, supported by an in-memory JSON fallback store for offline development.", "Data Persistence: ")
    add_bullet_p(doc, " The development team possesses strong academic and practical experience in JavaScript/TypeScript, React state management, and RESTful API engineering.", "Developer Competence: ")
    add_body_p(doc, "Conclusion: The project is highly technically feasible using open-source web technologies.", bold_prefix="Assessment: ")

    add_heading_2(doc, "7.2 Economic Feasibility")
    add_body_p(doc, "Economic feasibility evaluates development costs, operational expenses, and value generation:")
    add_bullet_p(doc, " Node.js, React, Vite, Tailwind CSS, PostgreSQL, and VS Code are 100% open-source and free of licensing fees.", "Zero Software Licensing: ")
    add_bullet_p(doc, " Standard development laptops and university computer laboratories provided adequate compute for full development and testing.", "Hardware Investment: ")
    add_bullet_p(doc, " Because peer video streams flow directly peer-to-peer (P2P) via WebRTC, video data bypasses the central server, dramatically reducing cloud bandwidth expenses.", "Bandwidth Efficiency: ")
    add_bullet_p(doc, " The internal Time-Banking model provides thousands of dollars in academic tutoring value to students without requiring financial capital.", "Value Delivery: ")
    add_body_p(doc, "Conclusion: The project is economically superior to commercial tutoring solutions with near-zero overhead.", bold_prefix="Assessment: ")

    add_heading_2(doc, "7.3 Operational Feasibility")
    add_body_p(doc, "Operational feasibility examines user adoption and day-to-day usability:")
    add_bullet_p(doc, " Designed with clean, accessible Tailwind CSS components and intuitive navigational paradigms suitable for college students.", "Intuitive User Experience: ")
    add_bullet_p(doc, " The platform addresses a genuine, urgent student need: finding reliable, verified peers to learn and teach academic subjects without financial friction.", "Strong User Demand: ")
    add_bullet_p(doc, " Standard calendar file export (.ics) fits seamlessly into students' existing Google Calendar and Apple Calendar workflows.", "Workflow Compatibility: ")
    add_body_p(doc, "Conclusion: The system is operationally viable and readily adoptable across any academic campus.", bold_prefix="Assessment: ")

    add_heading_2(doc, "7.4 Schedule Feasibility")
    add_body_p(doc, "The project lifecycle was strictly scheduled and successfully completed within the allocated 120 academic project hours through modular agile iterations.")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 8: TIMELINE CHART
    # ==========================================
    add_heading_1(doc, "CHAPTER – 8 TIMELINE CHART")
    add_body_p(doc, "The development lifecycle of the Mindroot platform was executed across six distinct phases totaling 120 hours. Each phase was systematically completed according to software engineering principles:")

    time_rows = [
        ("1. Requirement Analysis & Problem Study", "Literature review, problem identification, student user surveys, and feasibility analysis", "12 Hours"),
        ("2. System Design & Architectural Planning", "Entity-Relationship design, DFD Level 0/1/2, database schema, WebRTC topology", "18 Hours"),
        ("3. Full-Stack Development & DB Migration", "React 19 frontend, Express REST APIs, Prisma schema, Socket.io signaling", "45 Hours"),
        ("4. WebRTC Video & Classroom Integration", "P2P video streaming, STUN configuration, collaborative whiteboard, live code editor", "20 Hours"),
        ("5. Deployment & System Testing", "Unit testing, multi-device LAN testing, Playwright E2E verification, Docker packaging", "15 Hours"),
        ("6. Academic Documentation & Reporting", "Report authoring, diagram generation, slides creation, and presentation prep", "10 Hours"),
        ("Total Project Duration", "Comprehensive Full-Stack Semester Project Lifecycle", "120 Hours")
    ]

    tbl_time = doc.add_table(rows=len(time_rows)+1, cols=3)
    tbl_time.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_time.autofit = False
    tbl_time.columns[0].width = Inches(2.2)
    tbl_time.columns[1].width = Inches(3.3)
    tbl_time.columns[2].width = Inches(1.0)

    thdr = tbl_time.rows[0].cells
    thdr[0].text = "Project Phase"
    thdr[1].text = "Activities & Key Deliverables"
    thdr[2].text = "Duration"
    for c in thdr:
        p = c.paragraphs[0]
        p.runs[0].font.bold = True
        p.runs[0].font.size = Pt(10.5)
        p.runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_background(c, "1B365D")
        set_cell_margins(c, top=80, bottom=80, left=100, right=100)

    for r_i, (p_name, p_act, p_dur) in enumerate(time_rows, start=1):
        cells = tbl_time.rows[r_i].cells
        cells[0].text = p_name
        cells[1].text = p_act
        cells[2].text = p_dur
        is_tot = (r_i == len(time_rows))
        for c_i, c in enumerate(cells):
            p = c.paragraphs[0]
            if is_tot:
                p.runs[0].font.bold = True
                set_cell_background(c, "E2E8F0")
            else:
                set_cell_background(c, "F8FAFC" if r_i % 2 == 1 else "FFFFFF")
            set_cell_margins(c, top=60, bottom=60, left=90, right=90)

    set_table_borders(tbl_time, color="CBD5E1")

    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(8)

    add_image_safe(doc, "diagrams/gantt_chart.png", width_inches=6.2, caption="Project Gantt Chart — 120-Hour Development Lifecycle")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 9: FLOW CHART
    # ==========================================
    add_heading_1(doc, "CHAPTER – 9 FLOW CHART")
    add_body_p(doc, "The System Flowchart depicts the comprehensive user journey, decision logic, and role pathways across Students (Learners/Tutors) and Administrators:")
    add_bullet_p(doc, " Upon arrival, the system checks whether the visitor is an authenticated student or administrator. Unregistered users proceed through registration with password hashing or Google SSO.", "1. Authentication Pathway: ")
    add_bullet_p(doc, " Authenticated students search the skill taxonomy. The matchmaker evaluates bilateral compatibility and displays peer profiles.", "2. Matching & Booking Pathway: ")
    add_bullet_p(doc, " When a session is booked, the escrow module verifies the student has >= 1 token. It locks 1 token in pending escrow and dispatches an invite to the tutor.", "3. Atomic Escrow Pathway: ")
    add_bullet_p(doc, " Both peers enter the WebRTC classroom. The signaling server exchanges SDP offers, answers, and ICE candidates to establish direct P2P video, audio, shared whiteboard, and code editor streams.", "4. Classroom & Release Pathway: ")
    add_bullet_p(doc, " Administrators inspect platform analytics, verify skill master catalogs, resolve flagged disputes, and manage user trust metrics.", "5. Administration Pathway: ")

    add_image_safe(doc, "diagrams/system_flowchart.png", width_inches=6.0, caption="System Flowchart — Mindroot End-to-End User & Administration Workflow")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 10: DATA FLOW DIAGRAM (DFD)
    # ==========================================
    add_heading_1(doc, "CHAPTER – 10 DATA FLOW DIAGRAM (DFD)")
    add_body_p(doc, "Data Flow Diagrams (DFDs) graphically illustrate the flow of data through the Mindroot system, detailing how information is transformed by processes and stored in persistent repositories.")

    add_heading_2(doc, "10.1 DFD Standard Notations & Symbols")
    add_image_safe(doc, "diagrams/dfd_symbols.png", width_inches=5.8, caption="Standard DFD Notations: External Entity, Process, Data Store, and Data Flow")

    add_heading_2(doc, "10.2 Context Level DFD (Level 0)")
    add_body_p(doc, "The Level 0 Context Diagram represents the entire Mindroot ecosystem as a single high-level process interacting with three external entities: Student/Learner, Peer Mentor/Tutor, and System Administrator.")
    add_image_safe(doc, "diagrams/dfd_level_0.png", width_inches=6.0, caption="Context Level DFD (Level 0) — High-Level Entity Boundary & System Data Flows")

    add_heading_2(doc, "10.3 First Level DFD (Level 1) – Admin Perspective")
    add_body_p(doc, "The Admin Level 1 DFD decomposes administrative management into discrete sub-processes: User Verification, Skill Taxonomy Curation, Session Dispute Auditing, Financial Ledger Monitoring, and Analytics Aggregation.")
    add_image_safe(doc, "diagrams/dfd_admin_level1.png", width_inches=6.0, caption="DFD Level 1 (Admin Perspective) — Management & Governance Processes")

    add_heading_2(doc, "10.4 First Level DFD (Level 1) – User Perspective")
    add_body_p(doc, "The User Level 1 DFD delineates student-facing operations: Registration & Authentication, Profile & Competency Management, Bilateral Peer Search, Session Scheduling with Escrow Hold, Live Classroom Media Streams, and Post-Session Reviews.")
    add_image_safe(doc, "diagrams/dfd_user_level1.png", width_inches=6.0, caption="DFD Level 1 (User Perspective) — Core Student Lifecycle & Data Store Operations")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 11: DATA DICTIONARY
    # ==========================================
    add_heading_1(doc, "CHAPTER – 11 DATA DICTIONARY")
    add_body_p(doc, "The Data Dictionary provides formal definitions, storage specifications, data types, and integrity constraints for all relational entities implemented in the PostgreSQL database via Prisma ORM:")

    # Table 1: User
    build_data_dict_table(
        doc,
        "1. User Table (User)",
        ["Field Name", "Data Type", "Constraint", "Description"],
        [
            ["id", "String (UUID)", "Primary Key, Default uuid()", "Unique system identifier for the student"],
            ["name", "VarChar(100)", "NOT NULL", "Full legal or display name of student"],
            ["email", "VarChar(150)", "Unique, NOT NULL", "Verified institutional or personal email address"],
            ["password", "VarChar(255)", "NULLABLE", "Bcrypt password hash (null for Google SSO)"],
            ["avatar", "VarChar(255)", "NULLABLE", "URL to student avatar image"],
            ["bio", "Text", "NULLABLE", "Personal academic bio and learning interests"],
            ["tokenBalance", "Integer", "Default: 3, NOT NULL", "Available Skill Tokens for booking sessions"],
            ["trustScore", "Float", "Default: 5.0, NOT NULL", "Average post-session rating (1.0 to 5.0)"],
            ["createdAt", "DateTime", "Default: now(), NOT NULL", "Account creation timestamp"],
            ["updatedAt", "DateTime", "Updated automatically", "Last profile update timestamp"]
        ]
    )

    # Table 2: Skill
    build_data_dict_table(
        doc,
        "2. Skill Master Table (Skill)",
        ["Field Name", "Data Type", "Constraint", "Description"],
        [
            ["id", "String (UUID)", "Primary Key", "Unique identifier for skill entity"],
            ["name", "VarChar(100)", "Unique, NOT NULL", "Canonical skill name (e.g. React, Python, UI Design)"],
            ["category", "VarChar(100)", "NOT NULL", "Domain category (Software, Design, Science, Languages)"],
            ["description", "Text", "NULLABLE", "Brief description of skill topic"]
        ]
    )

    # Table 3: UserSkill
    build_data_dict_table(
        doc,
        "3. UserSkill Relational Join Table (UserSkill)",
        ["Field Name", "Data Type", "Constraint", "Description"],
        [
            ["id", "String (UUID)", "Primary Key", "Join record identifier"],
            ["userId", "String (UUID)", "Foreign Key (User.id)", "Reference to associated user"],
            ["skillId", "String (UUID)", "Foreign Key (Skill.id)", "Reference to associated skill master"],
            ["type", "Enum", "'TEACH' / 'LEARN'", "Designates whether user teaches or learns this skill"],
            ["level", "VarChar(50)", "Beginner / Intermediate / Pro", "Proficiency level self-assessment"]
        ]
    )

    # Table 4: Session
    build_data_dict_table(
        doc,
        "4. Session Master Table (Session)",
        ["Field Name", "Data Type", "Constraint", "Description"],
        [
            ["id", "String (UUID)", "Primary Key", "Unique identifier for tutoring session"],
            ["learnerId", "String (UUID)", "Foreign Key (User.id)", "Student booking and receiving instruction"],
            ["tutorId", "String (UUID)", "Foreign Key (User.id)", "Peer student providing instruction"],
            ["skillId", "String (UUID)", "Foreign Key (Skill.id)", "Skill topic covered during session"],
            ["status", "Enum", "Pending / Confirmed / Completed", "Current operational state of session"],
            ["startTime", "DateTime", "NOT NULL", "Scheduled session start date and time"],
            ["endTime", "DateTime", "NOT NULL", "Scheduled session end date and time"],
            ["meetingUrl", "VarChar(255)", "NOT NULL", "Unique virtual classroom room URL"],
            ["tokensCost", "Integer", "Default: 1, NOT NULL", "Skill tokens locked in escrow for session"]
        ]
    )

    # Table 5: Transaction
    build_data_dict_table(
        doc,
        "5. Transaction & Escrow Ledger Table (Transaction)",
        ["Field Name", "Data Type", "Constraint", "Description"],
        [
            ["id", "String (UUID)", "Primary Key", "Unique financial audit transaction ID"],
            ["userId", "String (UUID)", "Foreign Key (User.id)", "Account balance being debited or credited"],
            ["sessionId", "String (UUID)", "Foreign Key (Session.id)", "Related session reference"],
            ["amount", "Integer", "NOT NULL", "Token quantity moved (+1 credit / -1 debit)"],
            ["type", "Enum", "INITIAL / ESCROW_LOCK / SETTLE", "Classification of token lifecycle movement"],
            ["timestamp", "DateTime", "Default: now(), NOT NULL", "Immutable transaction completion timestamp"]
        ]
    )

    # Table 6: Review
    build_data_dict_table(
        doc,
        "6. Review & Rating Table (Review)",
        ["Field Name", "Data Type", "Constraint", "Description"],
        [
            ["id", "String (UUID)", "Primary Key", "Unique review identifier"],
            ["sessionId", "String (UUID)", "Foreign Key (Session.id)", "Associated completed learning session"],
            ["authorId", "String (UUID)", "Foreign Key (User.id)", "Student submitting rating"],
            ["recipientId", "String (UUID)", "Foreign Key (User.id)", "Peer student receiving rating"],
            ["rating", "Integer", "Check (1 <= rating <= 5)", "Numerical rating from 1 (Poor) to 5 (Excellent)"],
            ["comment", "Text", "NULLABLE", "Written qualitative evaluation and feedback"],
            ["createdAt", "DateTime", "Default: now(), NOT NULL", "Submission timestamp"]
        ]
    )

    # Table 7: Message
    build_data_dict_table(
        doc,
        "7. Chat Message Table (Message)",
        ["Field Name", "Data Type", "Constraint", "Description"],
        [
            ["id", "String (UUID)", "Primary Key", "Unique message identifier"],
            ["senderId", "String (UUID)", "Foreign Key (User.id)", "Sender student reference"],
            ["receiverId", "String (UUID)", "Foreign Key (User.id)", "Recipient student reference"],
            ["content", "Text", "NOT NULL", "Encrypted or sanitized chat message payload"],
            ["isRead", "Boolean", "Default: false, NOT NULL", "Message delivery/read confirmation state"],
            ["timestamp", "DateTime", "Default: now(), NOT NULL", "Real-time dispatch timestamp"]
        ]
    )

    doc.add_page_break()

    # ==========================================
    # CHAPTER 12: E-R DIAGRAM
    # ==========================================
    add_heading_1(doc, "CHAPTER – 12 E-R (ENTITY-RELATIONSHIP) DIAGRAM")
    add_body_p(doc, "The Entity-Relationship (E-R) diagram models the conceptual and logical schema of Mindroot. It documents entity types, attributes, primary/foreign keys, and relational cardinalities:")
    add_bullet_p(doc, " A student can possess many skills to teach (1:N) and many skills to learn (1:N) mediated through the UserSkill associative entity.", "User to Skill (M:N): ")
    add_bullet_p(doc, " A student participates in many sessions as a Learner (1:N) and many sessions as a Tutor (1:N).", "User to Session (1:N): ")
    add_bullet_p(doc, " Each booking creates atomic audit records in the Transaction ledger tracking Escrow Holds and Releases.", "Session to Transaction (1:N): ")
    add_bullet_p(doc, " Each completed session produces bilateral ratings that dynamically recompute user trust scores.", "Session to Review (1:N): ")

    add_image_safe(doc, "diagrams/er_diagram.png", width_inches=6.0, caption="Entity-Relationship (E-R) Diagram — Relational Entities, Keys, and Cardinalities")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 13: USER INTERFACE DESIGN
    # ==========================================
    add_heading_1(doc, "CHAPTER – 13 USER INTERFACE DESIGN")
    add_body_p(doc, "This chapter showcases the user interface of the live Mindroot application. Each view is captured directly from the running web application:")

    add_heading_2(doc, "13.1 Landing & Hero Page")
    add_body_p(doc, "The homepage introduces the platform with a modern hero layout, key value propositions, active user counts, and quick-action buttons to explore skills or sign in.")
    add_image_safe(doc, "screenshots/01_landing.png", width_inches=6.0, caption="Screen 1: Mindroot Landing & Hero Page")

    add_heading_2(doc, "13.2 User Authentication & Single Sign-On")
    add_body_p(doc, "The authentication portal provides dual-mode onboarding: standard email and password authentication with client-side validation, alongside one-click Google OAuth 2.0 Single Sign-On.")
    add_image_safe(doc, "screenshots/02_auth.png", width_inches=6.0, caption="Screen 2: User Sign-In & Google SSO Portal")

    add_heading_2(doc, "13.3 Peer Discovery & Bilateral Matchmaker")
    add_body_p(doc, "The Matchmaker interface cross-analyzes student competency tags, displaying peer match cards with trust scores, taught skills, hourly rates (1 Token/hr), and direct 'Book Session' actions.")
    add_image_safe(doc, "screenshots/03_matchmaker.png", width_inches=6.0, caption="Screen 3: Peer Discovery & Smart Matchmaker View")

    add_heading_2(doc, "13.4 Session Booking & Calendar Modal")
    add_body_p(doc, "The interactive booking modal lets students select date and time slots, inspect token escrow terms, and download RFC-5545 standard `.ics` calendar invitation files for instant synchronization.")
    add_image_safe(doc, "screenshots/04_booking.png", width_inches=6.0, caption="Screen 4: Session Booking & iCal Calendar Export Modal")

    add_heading_2(doc, "13.5 WebRTC Live Classroom")
    add_body_p(doc, "The live virtual classroom delivers low-latency peer-to-peer video and audio conferencing with camera/mic controls, screen sharing, meeting duration timers, and instant chat.")
    add_image_safe(doc, "screenshots/05_classroom.png", width_inches=6.0, caption="Screen 5: WebRTC Live P2P Video Classroom")

    add_heading_2(doc, "13.6 Collaborative Whiteboard & Synchronized Code Editor")
    add_body_p(doc, "The interactive learning workspace integrates a real-time drawing whiteboard with multiple brush tools alongside an in-browser code runner supporting syntax highlighting and live execution.")
    add_image_safe(doc, "screenshots/06_whiteboard_code.png", width_inches=6.0, caption="Screen 6: Real-Time Collaborative Whiteboard & Code Editor")

    add_heading_2(doc, "13.7 Skill Token Wallet & Transaction Ledger")
    add_body_p(doc, "The financial wallet tracks available token balances, pending escrow reserves, lifetime earnings, and an auditable ledger detailing every debit and credit.")
    add_image_safe(doc, "screenshots/08_wallet.png", width_inches=6.0, caption="Screen 7: Skill Token Wallet & Escrow Ledger")

    add_heading_2(doc, "13.8 Admin Supervision & Platform Analytics")
    add_body_p(doc, "The administrative dashboard provides administrators with real-time operational oversight: active user metrics, token velocity, verified skill catalogs, and session dispute resolution.")
    add_image_safe(doc, "screenshots/07_admin.png", width_inches=6.0, caption="Screen 8: Administrator Control & Analytics Dashboard")

    add_heading_2(doc, "13.9 Daily Learning Streak Tracker & Gamification")
    add_body_p(doc, "Gamification mechanics including daily study streak trackers, motivational badges, and visual activity heatmaps to encourage continuous student learning engagement.")
    add_image_safe(doc, "screenshots/streak-tracker-dark.png", width_inches=6.0, caption="Screen 9: Learning Streak Tracker & Gamification UI (Dark Mode)")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 14: FUTURE ENHANCEMENT
    # ==========================================
    add_heading_1(doc, "CHAPTER – 14 FUTURE ENHANCEMENTS & SCALABILITY")
    add_body_p(doc, "While Mindroot delivers a robust, feature-complete web application for peer skill exchange, future developments will expand its capabilities across multiple horizons:")

    enhancements = [
        ("1. Native Mobile Applications (iOS & Android): ", "Develop cross-platform native applications using React Native or Flutter to provide push notifications, mobile video calls, and offline access to study notes."),
        ("2. AI-Powered Recommendation Engine: ", "Integrate machine learning algorithms to analyze student curriculum syllabi and recommend optimal study partners based on examination schedules and historical learning patterns."),
        ("3. Automated Meeting Transcription & AI Summaries: ", "Employ Whisper speech-to-text models to automatically generate searchable session transcripts, chapter bookmarks, and AI study notes for every completed classroom call."),
        ("4. Multi-Peer Study Rooms & Group Workshops: ", "Expand beyond 1-on-1 sessions to support multi-peer group classrooms (up to 8 students) powered by SFU (Selective Forwarding Unit) media servers like MediaSoup or LiveKit."),
        ("5. Institutional Single Sign-On (SAML / Eduroam): ", "Enable university-wide authentication integrating institutional active directories (LDAP/SAML) for verified university enrollment credentials."),
        ("6. Gamified Certification Badges: ", "Award blockchain-verified or digitally verifiable OpenBadges for students who deliver over 50 hours of highly-rated tutoring in specific subject domains.")
    ]

    for title, desc in enhancements:
        add_body_p(doc, desc, bold_prefix=title)

    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(8)

    add_image_safe(doc, "diagrams/analytics_graphs.png", width_inches=6.2, caption="Mindroot Real-Time Analytics & Growth Metrics — Token Circulation, Completion Rates & Distribution")

    doc.add_page_break()

    # ==========================================
    # CHAPTER 15: BIBLIOGRAPHY
    # ==========================================
    add_heading_1(doc, "CHAPTER – 15 BIBLIOGRAPHY & REFERENCES")
    add_body_p(doc, "During the design, architectural modeling, and implementation of “Mindroot: Peer Skill Exchange Platform”, the following academic literature, standard textbooks, technical manuals, and online resources were consulted:")

    add_heading_2(doc, "Technical Books & Publications")
    add_bullet_p(doc, " Full-Stack React, TypeScript, and Node: Build modern web applications from scratch, Packt Publishing, 2023.", "David Choi: ")
    add_bullet_p(doc, " Learning React: Modern Patterns for Developing React Apps (2nd Edition), O'Reilly Media, 2020.", "Alex Banks & Eve Porcello: ")
    add_bullet_p(doc, " Real-Time Communication with WebRTC: Peer-to-Peer in the Browser, O'Reilly Media, 2014.", "Salvatore Loreto & Simon Pietro Romano: ")
    add_bullet_p(doc, " Database System Concepts (7th Edition), McGraw-Hill Education, 2019.", "Abraham Silberschatz, Henry F. Korth, S. Sudarshan: ")
    add_bullet_p(doc, " Software Engineering: A Practitioner's Approach (9th Edition), McGraw-Hill, 2020.", "Roger S. Pressman & Bruce R. Maxim: ")

    add_heading_2(doc, "Official Technical Documentation & Standards")
    add_bullet_p(doc, " https://react.dev", "Official React 19 Documentation: ")
    add_bullet_p(doc, " https://nodejs.org/docs", "Node.js Platform Documentation: ")
    add_bullet_p(doc, " https://webrtc.org & MDN Web Docs (WebRTC API)", "WebRTC W3C Specification: ")
    add_bullet_p(doc, " https://socket.io/docs/v4", "Socket.io Real-Time Engine Documentation: ")
    add_bullet_p(doc, " https://www.prisma.io/docs", "Prisma ORM & PostgreSQL Schema Guide: ")
    add_bullet_p(doc, " https://tailwindcss.com/docs", "Tailwind CSS Utility Styling Framework: ")
    add_bullet_p(doc, " https://datatracker.ietf.org/doc/html/rfc5545", "Internet Calendaring and Scheduling (iCalendar RFC 5545): ")

    add_heading_2(doc, "Academic Guidance & Institutional Support")
    add_bullet_p(doc, " Continuous technical guidance, architectural review, and project critiques provided by internal guide and mentor Prof. Ronak Joshi (Assistant Professor, BCA Department).", "Internal Project Mentor: ")
    add_bullet_p(doc, " Departmental laboratories, server facilities, and high-speed network infrastructure provided by Grow More Institute of BCA, Himatnagar.", "Institutional Facilities: ")
    add_bullet_p(doc, " BCA Semester-6 Project Guidelines and Curriculum framework provided by Hemchandracharya North Gujarat University (H.N.G.U.), Patan.", "University Syllabus: ")

    # Save to both Mindroot_Project_Report.docx and try index.docx / index_updated.docx
    report_path = "Mindroot_Project_Report.docx"
    doc.save(report_path)
    print(f"Full Project Report successfully created and saved to {report_path}")

    # Also update index_updated.docx
    doc.save("index_updated.docx")
    print(f"Also synced to index_updated.docx")

    try:
        doc.save("index.docx")
        print("Also updated index.docx")
    except PermissionError:
        print("Note: index.docx is currently locked by Word; changes are fully saved in Mindroot_Project_Report.docx and index_updated.docx")

if __name__ == "__main__":
    generate_complete_project_report()
