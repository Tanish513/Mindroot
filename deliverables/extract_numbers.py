import pptx
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

prs = pptx.Presentation('deliverables/Mindroot_Design_Thinking.pptx')

print("Extracting all numbers and statistics across the 15 slides...")

slide_numbers = {}

for idx, slide in enumerate(prs.slides):
    s_num = idx + 1
    found_nums = set()
    for shape in slide.shapes:
        if shape.has_text_frame:
            text = shape.text
            # find numbers, percentages, fractions, scores, currency
            matches = re.findall(r'(?:Rs\s*\d+|\d+/\d+|\d+:\d+|\d+%\b|\b\d+\b)', text)
            for m in matches:
                found_nums.add(m)
    slide_numbers[s_num] = sorted(list(found_nums))

for s_num, nums in slide_numbers.items():
    print(f"Slide {s_num:02d}: {', '.join(nums)}")
