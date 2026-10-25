import pptx
from pptx.util import Inches
import sys

sys.stdout.reconfigure(encoding='utf-8')

prs = pptx.Presentation('Mindroot_Project_Presentation_v4.pptx')
slides = list(prs.slides)
print(f"Total slides in v4: {len(slides)}")

# 1. Slide count assertion
assert len(slides) == 43, f"Expected 43 slides, got {len(slides)}"

# 2. Check footer text and clearance across slides 2-42
footer_issues = []
footer_texts = []
for idx in range(2, 43):
    s = slides[idx - 1]
    # find footer shape
    foot_sp = None
    for sp in s.shapes:
        if sp.top >= Inches(6.9):
            foot_sp = sp
            break
    if foot_sp and foot_sp.has_text_frame:
        txt = foot_sp.text_frame.text.strip()
        expected = f"PAGE {idx} OF 43"
        if expected not in txt:
            footer_issues.append((idx, f"Footer mismatch: '{txt}' (expected '{expected}')"))
            
    # Check clearance of other shapes
    for sp in s.shapes:
        if sp.top >= Inches(6.9):
            continue
        bottom = sp.top + sp.height
        if bottom > Inches(6.80): # clearance < 0.20"
            footer_issues.append((idx, f"Clearance violation: bottom at {bottom/914400:.2f} in"))

print("Footer issues found:", footer_issues)

# 3. Check Slide Titles
print("\nSlide Titles:")
for idx, s in enumerate(slides, 1):
    title = "No Title"
    for sp in s.shapes:
        if sp.has_text_frame:
            for p in sp.text_frame.paragraphs:
                for r in p.runs:
                    if r.font.size and r.font.size.pt >= 17:
                        title = r.text
                        break
                if title != "No Title":
                    break
        if title != "No Title":
            break
    print(f"Slide {idx:2d}: {title}")

# 4. Check Screenshots and Pictures presence
print("\nPicture Check:")
pic_count = 0
for idx, s in enumerate(slides, 1):
    pics = [sp for sp in s.shapes if sp.shape_type == pptx.enum.shapes.MSO_SHAPE_TYPE.PICTURE]
    if pics:
        pic_count += len(pics)
        pic = pics[0]
        print(f"Slide {idx:2d} has picture: left={pic.left/914400:.2f} in, top={pic.top/914400:.2f} in, w={pic.width/914400:.2f} in, h={pic.height/914400:.2f} in, bottom={(pic.top+pic.height)/914400:.2f} in")
print(f"Total pictures across presentation: {pic_count}")
