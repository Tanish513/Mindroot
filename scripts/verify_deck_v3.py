
import pptx
from pptx.util import Inches

prs = pptx.Presentation('Mindroot_Project_Presentation_v3.pptx')
slides = list(prs.slides)
print(f'Total slides: {len(slides)}')

# 1. Backtick check
backticks = []
for idx, s in enumerate(slides, 1):
    for sp in s.shapes:
        if sp.has_text_frame and chr(96) in sp.text_frame.text:
            backticks.append(idx)
        if sp.has_table:
            for row in sp.table.rows:
                for c in row.cells:
                    if chr(96) in c.text:
                        backticks.append(idx)
print('Slides with literal backticks:', set(backticks))

# 2. Check footer clearance across slides 2-41
footer_clearance_issues = []
for idx in range(2, 42):
    s = slides[idx-1]
    for sp in s.shapes:
        if sp.top >= Inches(6.9):
            continue
        bottom = sp.top + sp.height
        if bottom > Inches(6.80):
            footer_clearance_issues.append((idx, round(bottom / 914400, 2)))
print('Footer clearance violations (bottom > 6.80 in):', footer_clearance_issues)

# 3. Check Slide 13 & 14 ending
s13_shapes = [sp for sp in slides[12].shapes if sp.top < Inches(6.9)]
s13_bottom = max(sp.top + sp.height for sp in s13_shapes)
print(f'Slide 13 content bottom: {s13_bottom / 914400:.2f} in (clearance to 7.0 footer: {(Inches(7.0)-s13_bottom)/914400:.2f} in)')

s14_shapes = [sp for sp in slides[13].shapes if sp.top < Inches(6.9)]
s14_bottom = max(sp.top + sp.height for sp in s14_shapes)
print(f'Slide 14 content bottom: {s14_bottom / 914400:.2f} in (clearance to 7.0 footer: {(Inches(7.0)-s14_bottom)/914400:.2f} in)')

# 4. Check Slide 30 ending
s30_shapes = [sp for sp in slides[29].shapes if sp.top < Inches(6.9)]
s30_bottom = max(sp.top + sp.height for sp in s30_shapes)
print(f'Slide 30 content bottom: {s30_bottom / 914400:.2f} in (clearance to 7.0 footer: {(Inches(7.0)-s30_bottom)/914400:.2f} in)')

# 5. Check Slide 42 center
s42 = slides[41]
for sp in s42.shapes:
    print(f'Slide 42 shape: left={sp.left/914400:.2f}, top={sp.top/914400:.2f}, width={sp.width/914400:.2f}, height={sp.height/914400:.2f}')
