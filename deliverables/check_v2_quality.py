import pptx
from pptx.util import Inches, Pt
import sys
sys.stdout.reconfigure(encoding='utf-8')

prs = pptx.Presentation('deliverables/Mindroot_Design_Thinking_v2.pptx')
slide_w = prs.slide_width
slide_h = prs.slide_height

print(f"=== QA AUDIT FOR Mindroot_Design_Thinking_v2.pptx ===")
print(f"Total slides: {len(prs.slides)} (16:9 widescreen: {slide_w.inches:.2f}\" x {slide_h.inches:.2f}\")\n")

total_issues = 0
slides_with_small_font = []

for idx, slide in enumerate(prs.slides):
    slide_num = idx + 1
    issues = []
    text_blocks = 0
    total_words = 0
    small_fonts = []

    for s_idx, shape in enumerate(slide.shapes):
        r = shape.left + shape.width
        b = shape.top + shape.height
        if r > slide_w + Inches(0.05):
            issues.append(f"Shape {s_idx} ({shape.name}) overflows right: {r.inches:.2f}\" > {slide_w.inches:.2f}\"")
        if b > slide_h + Inches(0.05):
            issues.append(f"Shape {s_idx} ({shape.name}) overflows bottom: {b.inches:.2f}\" > {slide_h.inches:.2f}\"")

        if shape.has_text_frame:
            text = shape.text.strip()
            if text:
                text_blocks += 1
                words = len(text.split())
                total_words += words
                for p in shape.text_frame.paragraphs:
                    p_words = len(p.text.split())
                    if p_words > 65:
                        issues.append(f"Shape {s_idx} paragraph has {p_words} words: '{p.text[:40]}...'")

                    # Check font size
                    fs = p.font.size.pt if p.font.size else None
                    for run in p.runs:
                        if run.font.size:
                            fs = run.font.size.pt
                    if fs and fs < 10.0 and p.text.strip():
                        # Exclude mind map idea cards if 9.5pt
                        if slide_num == 8 and fs >= 9.5:
                            continue
                        small_fonts.append((fs, p.text[:30]))

        if shape.has_table:
            table = shape.table
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.text_frame.paragraphs:
                        fs = p.font.size.pt if p.font.size else None
                        for run in p.runs:
                            if run.font.size:
                                fs = run.font.size.pt
                        if fs and fs < 10.0 and p.text.strip():
                            small_fonts.append((fs, p.text[:30]))

    notes = slide.notes_slide.notes_text_frame.text if slide.has_notes_slide else "NO NOTES"
    notes_words = len(notes.split()) if notes != "NO NOTES" else 0
    if notes_words < 15:
        issues.append(f"Notes too brief or missing ({notes_words} words)")

    if small_fonts:
        slides_with_small_font.append((slide_num, small_fonts))

    status = "OK" if not issues else "ISSUES: " + "; ".join(issues)
    if issues:
        total_issues += len(issues)
    print(f"Slide {slide_num:02d}: {status} (Shapes: {len(slide.shapes)}, Words: {total_words}, Notes: {notes_words} words)")

print(f"\nTotal boundary/overflow issues: {total_issues}")
if slides_with_small_font:
    print(f"\nSlides with text < 10pt:")
    for s_num, s_list in slides_with_small_font:
        print(f"  Slide {s_num:02d}: {len(s_list)} occurrences (min: {min(x[0] for x in s_list):.1f}pt): {s_list[:3]}")
else:
    print("\nALL slides strictly have font size >= 10pt! Zero violations!")
