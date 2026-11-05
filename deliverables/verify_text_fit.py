import pptx
from pptx.util import Inches, Pt
import sys
sys.stdout.reconfigure(encoding='utf-8')

prs = pptx.Presentation('deliverables/Mindroot_Design_Thinking.pptx')
EMU = 914400.0

print('Checking theoretical text box capacity vs character counts...')
potential_overflows = []

for idx, slide in enumerate(prs.slides):
    s_num = idx + 1
    for s_idx, shape in enumerate(slide.shapes):
        if shape.has_text_frame:
            tf = shape.text_frame
            text = tf.text.strip()
            if not text:
                continue
            
            w_in = shape.width / EMU
            h_in = shape.height / EMU
            
            font_sizes = []
            for p in tf.paragraphs:
                if p.font.size:
                    font_sizes.append(p.font.size.pt)
                for r in p.runs:
                    if r.font.size:
                        font_sizes.append(r.font.size.pt)
            
            avg_fs = sum(font_sizes) / len(font_sizes) if font_sizes else 9.0
            
            chars = len(text)
            chars_per_line = max(10, (w_in * 72) / (avg_fs * 0.52))
            lines_needed = sum(max(1, len(p.text) / chars_per_line) for p in tf.paragraphs if p.text.strip())
            h_needed = (lines_needed * (avg_fs * 1.3)) / 72.0
            
            if h_needed > h_in * 1.25 and h_in > 0.3:
                potential_overflows.append((s_num, s_idx, shape.name, f'{w_in:.2f}x{h_in:.2f}', f'needed {h_needed:.2f}', f'fs {avg_fs:.1f}', text[:40].replace('\n', ' ')))

print(f'Total potential overflows: {len(potential_overflows)}')
for po in potential_overflows:
    print(f'Slide {po[0]:02d}, Shape {po[1]} ({po[2]} {po[3]} in): {po[4]} in (fs {po[5]}): "{po[6]}..."')
