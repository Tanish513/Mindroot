import pptx
from pptx.util import Inches, Pt
import os

prs = pptx.Presentation('deliverables/Mindroot_Design_Thinking.pptx')
slide_w = prs.slide_width
slide_h = prs.slide_height

print(f"Presentation width: {slide_w.inches:.2f}\", height: {slide_h.inches:.2f}\"")
print(f"Checking {len(prs.slides)} slides for shape boundaries, text length, and speaker notes...")

total_issues = 0

for idx, slide in enumerate(prs.slides):
    slide_num = idx + 1
    issues = []
    text_blocks = 0
    total_words = 0
    
    for s_idx, shape in enumerate(slide.shapes):
        r = shape.left + shape.width
        b = shape.top + shape.height
        if r > slide_w + Inches(0.05):
            issues.append(f"Shape {s_idx} ({shape.name}) overflows right: {r.inches:.2f} in > {slide_w.inches:.2f} in")
        if b > slide_h + Inches(0.05):
            issues.append(f"Shape {s_idx} ({shape.name}) overflows bottom: {b.inches:.2f} in > {slide_h.inches:.2f} in")
            
        if shape.has_text_frame:
            text = shape.text.strip()
            if text:
                text_blocks += 1
                words = len(text.split())
                total_words += words
                for p in shape.text_frame.paragraphs:
                    p_words = len(p.text.split())
                    if p_words > 65:
                        issues.append(f"Shape {s_idx} paragraph has {p_words} words (exceeds 60-word limit): '{p.text[:40]}...'")

    notes = slide.notes_slide.notes_text_frame.text if slide.has_notes_slide else "NO NOTES"
    notes_words = len(notes.split()) if notes != "NO NOTES" else 0
    if notes_words < 15:
        issues.append(f"Speaker notes too brief or missing ({notes_words} words)")
    
    status = "OK" if not issues else "ISSUES: " + "; ".join(issues)
    if issues:
        total_issues += len(issues)
    print(f"Slide {slide_num:02d}: {status} (Shapes: {len(slide.shapes)}, Total Words: {total_words}, Notes Words: {notes_words})")

print(f"\nTotal issues detected: {total_issues}")
