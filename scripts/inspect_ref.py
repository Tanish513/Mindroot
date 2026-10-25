from pptx import Presentation

prs = Presentation(r'c:\Users\tanis\Downloads\reference.pptx')

def inspect_slide(s_idx):
    slide = prs.slides[s_idx]
    print(f'=== SLIDE {s_idx+1} ===')
    for s in slide.shapes:
        info = f'Shape: {s.name}, Type: {s.shape_type}'
        if s.has_text_frame:
            p0 = s.text_frame.paragraphs[0]
            txt = s.text_frame.text.replace('\n', ' ')[:40]
            font_name = p0.runs[0].font.name if p0.runs and p0.runs[0].font.name else 'None'
            font_size = p0.runs[0].font.size.pt if p0.runs and p0.runs[0].font.size else 'None'
            color = p0.runs[0].font.color.rgb if p0.runs and p0.runs[0].font.color and hasattr(p0.runs[0].font.color, 'rgb') else 'None'
            info += f' | Text: "{txt}" | Font: {font_name} {font_size}pt {color}'
        if hasattr(s, 'fill') and s.fill.type:
            try:
                info += f' | Fill: {s.fill.fore_color.rgb}'
            except: pass
        if s.has_table:
            info += f' | Table: {len(s.table.rows)}x{len(s.table.columns)}'
        print(f'  {info} | Pos: ({s.left.inches:.2f}, {s.top.inches:.2f}, {s.width.inches:.2f}, {s.height.inches:.2f})')

inspect_slide(0)  # Slide 1
inspect_slide(2)  # Slide 3 Existing System
inspect_slide(5)  # Slide 6 Section Divider E-R
inspect_slide(17) # Slide 18 Customer Table
inspect_slide(42) # Slide 43 Thank you

print("=== SLIDE 1 DETAILED ===")
s1 = prs.slides[0]
for s in s1.shapes:
    t = s.text_frame.text.replace('\n', ' -- ') if s.has_text_frame else '[Picture]'
    print(f"Shape: {s.name} | pos: ({s.left}, {s.top}, {s.width}, {s.height}) | text: {t}")

print("=== SLIDE 2 DETAILED ===")
s2 = prs.slides[1]
for s in s2.shapes:
    t = s.text_frame.text.replace('\n', ' -- ') if s.has_text_frame else '[Picture]'
    print(f"Shape: {s.name} | pos: ({s.left}, {s.top}, {s.width}, {s.height}) | text: {t}")
